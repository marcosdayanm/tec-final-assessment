from contextlib import asynccontextmanager
from dataclasses import dataclass

from fastapi import Depends, FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from src.auth import create_access_token, decode_access_token, hash_password, verify_password
from src.chat import (
    create_direct_conversation,
    create_message,
    get_user_conversation,
    list_user_conversations,
    search_users,
)
from src.config import Settings
from src.db import User, create_session_factory, ensure_database_exists, get_db, init_db
from src.ml_client import SMSModelClient
from src.realtime import ConnectionManager
from src.schemas import (
    AuthResponse,
    ConversationDetail,
    ConversationsResponse,
    DirectConversationResponse,
    MessageCreateRequest,
    MessageCreatedEvent,
    MessageEnvelope,
    RegisterRequest,
    UserCredentials,
    UsersResponse,
)


bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class ApplicationRuntime:
    settings: Settings
    async_engine: AsyncEngine
    session_maker: async_sessionmaker[AsyncSession]
    connection_manager: ConnectionManager
    model_client: SMSModelClient | None = None

    @classmethod
    def from_settings(cls, settings: Settings) -> "ApplicationRuntime":
        async_engine, session_maker = create_session_factory(settings.database_url)
        return cls(
            settings=settings,
            async_engine=async_engine,
            session_maker=session_maker,
            connection_manager=ConnectionManager(),
        )

    async def initialize(self) -> None:
        await ensure_database_exists(self.settings.database_url)
        await init_db(self.async_engine)
        self.model_client = SMSModelClient(
            settings=self.settings,
            base_url=self.settings.ml_service_url,
            predict_path=self.settings.ml_service_predict_path,
            timeout_seconds=self.settings.ml_service_timeout_seconds,
            fallback_label=self.settings.unclassified_label,
        )

    async def shutdown(self) -> None:
        if self.model_client is not None:
            await self.model_client.aclose()
        await self.async_engine.dispose()


application_runtime = ApplicationRuntime.from_settings(Settings.from_env())


@asynccontextmanager
async def lifespan(application: FastAPI):
    await application_runtime.initialize()
    application.state.runtime = application_runtime
    try:
        yield
    finally:
        await application_runtime.shutdown()


app = FastAPI(
    title="ITChat",
    version="1.0.0",
    description="Direct-message backend with JWT auth, realtime delivery, and SMS classification.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(application_runtime.settings.cors_allow_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_runtime(request: Request) -> ApplicationRuntime:
    return request.app.state.runtime


async def get_session(runtime: ApplicationRuntime = Depends(get_runtime)):
    async for database_session in get_db(runtime.session_maker):
        yield database_session


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_session),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")

    token_payload = decode_access_token(credentials.credentials, request.app.state.runtime.settings)
    user = await db.get(User, int(token_payload["user_id"]))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return user


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    credentials: RegisterRequest,
    runtime: ApplicationRuntime = Depends(get_runtime),
    db: AsyncSession = Depends(get_session),
) -> AuthResponse:
    existing_user = await db.scalar(select(User).where(User.username == credentials.username))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists.")

    existing_email = await db.scalar(select(User).where(User.email == credentials.email))
    if existing_email is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists.")

    user = User(
        username=credentials.username,
        password_hash=hash_password(credentials.password),
        email=credentials.email,
        full_name=credentials.full_name,
        bio=credentials.bio,
        avatar_url=credentials.avatar_url,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token(user.id, user.username, runtime.settings)
    return AuthResponse.from_user(token, user)


@app.post("/v1/login", response_model=AuthResponse)
async def login(
    credentials: UserCredentials,
    runtime: ApplicationRuntime = Depends(get_runtime),
    db: AsyncSession = Depends(get_session),
) -> AuthResponse:
    user = await db.scalar(select(User).where(User.username == credentials.username))
    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password.")

    token = create_access_token(user.id, user.username, runtime.settings)
    return AuthResponse.from_user(token, user)


@app.get("/v1/users/search", response_model=UsersResponse)
async def search_for_users(
    query: str = Query(min_length=1, max_length=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> UsersResponse:
    matching_users = await search_users(db, query, current_user.id)
    return UsersResponse.from_users(matching_users)


@app.get("/v1/conversations", response_model=ConversationsResponse)
async def conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> ConversationsResponse:
    user_conversations = await list_user_conversations(db, current_user.id)
    return ConversationsResponse.from_conversations(user_conversations, current_user.id)


@app.post("/v1/conversations/direct/{target_user_id}", response_model=DirectConversationResponse)
async def create_or_fetch_direct_conversation(
    target_user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> DirectConversationResponse:
    if target_user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot create a conversation with yourself.")

    target_user = await db.get(User, target_user_id)
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found.")

    direct_conversation = await create_direct_conversation(db, current_user, target_user)
    return DirectConversationResponse.from_conversation(direct_conversation, current_user.id)


@app.get("/v1/direct_messages/{conversation_id}", response_model=ConversationDetail)
async def direct_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> ConversationDetail:
    conversation = await get_user_conversation(db, current_user.id, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    return ConversationDetail.from_conversation(conversation, current_user.id)


@app.post("/v1/messages", response_model=MessageEnvelope, status_code=status.HTTP_201_CREATED)
async def send_message(
    payload: MessageCreateRequest,
    runtime: ApplicationRuntime = Depends(get_runtime),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> MessageEnvelope:
    conversation = await get_user_conversation(db, current_user.id, payload.conversation_id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    # Clasifica el contenido con el ML service antes de persistir el mensaje.
    predicted_label = runtime.settings.unclassified_label
    if runtime.model_client is not None:
        predicted_label = await runtime.model_client.predict_label(payload.content)
    stored_message = await create_message(db, conversation, current_user, payload.content, predicted_label)
    recipient_user = next(
        participant.user for participant in conversation.participants if participant.user_id != current_user.id
    )
    message_created_event = MessageCreatedEvent.from_message(stored_message, current_user)
    await runtime.connection_manager.send_to_user(recipient_user.id, message_created_event.model_dump(mode="json"))
    return MessageEnvelope.from_message(stored_message)


@app.websocket("/v1/ws")
async def websocket_messages(websocket: WebSocket, token: str = Query(...)) -> None:
    try:
        token_payload = decode_access_token(token, websocket.app.state.runtime.settings)
    except HTTPException:
        # 4401: código de cierre para token inválido/expirado; el frontend lo detecta y cierra sesión.
        await websocket.close(code=4401, reason="Invalid or expired token.")
        return

    user_id = int(token_payload["user_id"])
    await websocket.app.state.runtime.connection_manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket.app.state.runtime.connection_manager.disconnect(user_id, websocket)
