from datetime import datetime
from typing import Literal
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from src.db import Conversation, Message, User


ClassificationLabel = Literal["ham", "spam", "smishing"]


class UserCredentials(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)
    email: str = Field(min_length=5, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    full_name: str = Field(min_length=1, max_length=120)
    bio: str | None = Field(default=None, max_length=2000)
    avatar_url: str | None = Field(default=None, max_length=500)


class UserSummary(BaseModel):
    id: int
    username: str
    full_name: str
    avatar_url: str | None

    @classmethod
    def from_user(cls, user: "User") -> "UserSummary":
        return cls(id=user.id, username=user.username, full_name=user.full_name, avatar_url=user.avatar_url)


class AuthResponse(BaseModel):
    token: str
    user: UserSummary

    @classmethod
    def from_user(cls, token: str, user: "User") -> "AuthResponse":
        return cls(token=token, user=UserSummary.from_user(user))


class UsersResponse(BaseModel):
    users: list[UserSummary]

    @classmethod
    def from_users(cls, users: list["User"]) -> "UsersResponse":
        return cls(users=[UserSummary.from_user(user) for user in users])


class MessageCreateRequest(BaseModel):
    conversation_id: int
    content: str = Field(min_length=1, max_length=5000)


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    content: str
    classification_label: ClassificationLabel
    created_at: datetime

    @classmethod
    def from_message(cls, message: "Message") -> "MessageResponse":
        return cls(
            id=message.id,
            conversation_id=message.conversation_id,
            sender_id=message.sender_id,
            content=message.content,
            classification_label=message.classification_label,
            created_at=message.created_at,
        )


class MessageEnvelope(BaseModel):
    message: MessageResponse

    @classmethod
    def from_message(cls, message: "Message") -> "MessageEnvelope":
        return cls(message=MessageResponse.from_message(message))


class ConversationSummary(BaseModel):
    conversation_id: int
    other_participant: UserSummary
    last_message: MessageResponse | None

    @classmethod
    def from_conversation(cls, conversation: "Conversation", current_user_id: int) -> "ConversationSummary":
        other_participant = next(
            participant.user for participant in conversation.participants if participant.user_id != current_user_id
        )
        last_message = conversation.messages[-1] if conversation.messages else None
        return cls(
            conversation_id=conversation.id,
            other_participant=UserSummary.from_user(other_participant),
            last_message=MessageResponse.from_message(last_message) if last_message is not None else None,
        )


class ConversationsResponse(BaseModel):
    conversations: list[ConversationSummary]

    @classmethod
    def from_conversations(
        cls,
        conversations: list["Conversation"],
        current_user_id: int,
    ) -> "ConversationsResponse":
        serialized_conversations = [
            ConversationSummary.from_conversation(conversation, current_user_id)
            for conversation in conversations
        ]
        serialized_conversations.sort(
            key=lambda conversation_summary: (
                conversation_summary.last_message is not None,
                conversation_summary.last_message.created_at
                if conversation_summary.last_message is not None
                else None,
            ),
            reverse=True,
        )
        return cls(conversations=serialized_conversations)


class ConversationDetail(BaseModel):
    conversation_id: int
    other_participant: UserSummary
    messages: list[MessageResponse]

    @classmethod
    def from_conversation(cls, conversation: "Conversation", current_user_id: int) -> "ConversationDetail":
        other_participant = next(
            participant.user for participant in conversation.participants if participant.user_id != current_user_id
        )
        return cls(
            conversation_id=conversation.id,
            other_participant=UserSummary.from_user(other_participant),
            messages=[MessageResponse.from_message(message) for message in conversation.messages],
        )


class DirectConversationResponse(BaseModel):
    conversation: ConversationSummary

    @classmethod
    def from_conversation(cls, conversation: "Conversation", current_user_id: int) -> "DirectConversationResponse":
        return cls(conversation=ConversationSummary.from_conversation(conversation, current_user_id))


class MessageCreatedEvent(BaseModel):
    type: Literal["message_created"]
    conversation_id: int
    message: MessageResponse
    sender: UserSummary
    created_at: datetime

    @classmethod
    def from_message(cls, message: "Message", sender: "User") -> "MessageCreatedEvent":
        return cls(
            type="message_created",
            conversation_id=message.conversation_id,
            message=MessageResponse.from_message(message),
            sender=UserSummary.from_user(sender),
            created_at=message.created_at,
        )
