export type ClassificationLabel = "ham" | "spam" | "smishing" | "unclassified";
export type MessageDirection = "me" | "other";

export interface UserSummary {
  id: number;
  username: string;
}

export interface SessionUser extends UserSummary {
  token: string;
}

export interface AuthFormValues {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: UserSummary;
}

export interface MessageDto {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  classification_label: ClassificationLabel;
  created_at: string;
}

export interface ConversationSummary {
  conversation_id: number;
  other_participant: UserSummary;
  last_message: MessageDto | null;
}

export interface ConversationsResponse {
  conversations: ConversationSummary[];
}

export interface ConversationDetail {
  conversation_id: number;
  other_participant: UserSummary;
  messages: MessageDto[];
}

export interface DirectConversationResponse {
  conversation: ConversationSummary;
}

export interface UserSearchResponse {
  users: UserSummary[];
}

export interface MessageEnvelope {
  message: MessageDto;
}

export interface MessageCreatedEvent {
  type: "message_created";
  conversation_id: number;
  message: MessageDto;
  sender: UserSummary;
  created_at: string;
}

export interface SendMessagePayload {
  conversation_id: number;
  content: string;
}

export interface UiMessage {
  id: number;
  conversationId: number;
  senderId: number;
  direction: MessageDirection;
  content: string;
  classificationLabel: ClassificationLabel;
  createdAt: string;
}

export interface UiConversation {
  conversationId: number;
  contact: UserSummary;
  lastMessage: string;
  lastMessageLabel: ClassificationLabel | null;
  lastMessageAt: string | null;
  unreadCount: number;
}
