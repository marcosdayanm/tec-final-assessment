from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db import Conversation, ConversationParticipant, Message, User


async def list_user_conversations(session: AsyncSession, user_id: int) -> list[Conversation]:
    statement = (
        select(Conversation)
        .join(ConversationParticipant)
        .where(ConversationParticipant.user_id == user_id)
        .options(
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user),
            selectinload(Conversation.messages),
        )
    )
    result = await session.scalars(statement)
    return list(result.unique().all())


async def get_user_conversation(session: AsyncSession, user_id: int, conversation_id: int) -> Conversation | None:
    statement = (
        select(Conversation)
        .join(ConversationParticipant)
        .where(
            Conversation.id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
        .options(
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user),
            selectinload(Conversation.messages),
        )
    )
    result = await session.scalars(statement)
    return result.unique().first()


async def find_direct_conversation(session: AsyncSession, first_user_id: int, second_user_id: int) -> Conversation | None:
    # Busca la conversación que tenga exactamente a esos dos participantes, para no crear duplicados.
    participant_ids = sorted([first_user_id, second_user_id])
    statement = (
        select(Conversation)
        .join(ConversationParticipant)
        .where(ConversationParticipant.user_id.in_(participant_ids))
        .group_by(Conversation.id)
        .having(func.count(ConversationParticipant.user_id) == 2)
        .having(
            func.sum(
                case(
                    (ConversationParticipant.user_id.in_(participant_ids), 1),
                    else_=0,
                )
            )
            == 2
        )
        .options(
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user),
            selectinload(Conversation.messages),
        )
    )
    result = await session.scalars(statement)
    return result.unique().first()


async def create_direct_conversation(session: AsyncSession, first_user: User, second_user: User) -> Conversation:
    existing = await find_direct_conversation(session, first_user.id, second_user.id)
    if existing is not None:
        return existing

    conversation = Conversation()
    session.add(conversation)
    await session.flush()
    session.add_all(
        [
            ConversationParticipant(conversation_id=conversation.id, user_id=first_user.id),
            ConversationParticipant(conversation_id=conversation.id, user_id=second_user.id),
        ]
    )
    await session.commit()
    stored_conversation = await get_user_conversation(session, first_user.id, conversation.id)
    if stored_conversation is None:
        raise RuntimeError("Direct conversation was created but could not be reloaded.")
    return stored_conversation


async def create_message(
    session: AsyncSession,
    conversation: Conversation,
    sender: User,
    content: str,
    classification_label: str,
) -> Message:
    message = Message(
        conversation_id=conversation.id,
        sender_id=sender.id,
        content=content,
        classification_label=classification_label,
    )
    session.add(message)
    await session.commit()
    await session.refresh(message)
    return message


async def search_users(session: AsyncSession, query: str, current_user_id: int) -> list[User]:
    normalized_query = query.strip().lower()
    like_query = f"%{normalized_query}%"
    # Ordena por relevancia: coincidencia exacta primero, luego por prefijo, luego cualquier coincidencia.
    rank = case(
        (func.lower(User.username) == normalized_query, 0),
        (func.lower(User.username).like(f"{normalized_query}%"), 1),
        else_=2,
    )
    statement = (
        select(User)
        .where(
            User.id != current_user_id,
            func.lower(User.username).like(like_query),
        )
        .order_by(rank.asc(), User.username.asc())
        .limit(20)
    )
    result = await session.scalars(statement)
    return list(result.all())
