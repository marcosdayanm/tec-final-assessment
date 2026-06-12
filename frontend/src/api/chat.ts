import type {
  AuthFormValues,
  AuthResponse,
  ConversationDetail,
  ConversationsResponse,
  DirectConversationResponse,
  MessageCreatedEvent,
  MessageEnvelope,
  RegisterFormValues,
  SendMessagePayload,
  UserSearchResponse,
} from "../types";
import { frontendConfig } from "../config";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function buildHeaders(token?: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${frontendConfig.apiBaseUrl}${path}`, options);
  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new ApiError(
      errorPayload?.detail ?? "No se pudo completar la solicitud.",
      response.status,
    );
  }
  return (await response.json()) as T;
}

export function isExpiredTokenError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    error.message === "Invalid or expired token."
  );
}

export async function login(credentials: AuthFormValues): Promise<AuthResponse> {
  return request<AuthResponse>("/v1/login", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(credentials),
  });
}

export async function register(credentials: RegisterFormValues): Promise<AuthResponse> {
  return request<AuthResponse>("/v1/register", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(credentials),
  });
}

export async function fetchConversations(token: string): Promise<ConversationsResponse> {
  return request<ConversationsResponse>("/v1/conversations", {
    headers: buildHeaders(token),
  });
}

export async function fetchConversationDetail(token: string, conversationId: number): Promise<ConversationDetail> {
  return request<ConversationDetail>(`/v1/direct_messages/${conversationId}`, {
    headers: buildHeaders(token),
  });
}

export async function searchUsers(token: string, query: string): Promise<UserSearchResponse> {
  return request<UserSearchResponse>(`/v1/users/search?query=${encodeURIComponent(query)}`, {
    headers: buildHeaders(token),
  });
}

export async function createDirectConversation(token: string, targetUserId: number): Promise<DirectConversationResponse> {
  return request<DirectConversationResponse>(`/v1/conversations/direct/${targetUserId}`, {
    method: "POST",
    headers: buildHeaders(token),
  });
}

export async function sendMessage(token: string, payload: SendMessagePayload): Promise<MessageEnvelope> {
  return request<MessageEnvelope>("/v1/messages", {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function buildWebSocketUrl(token: string): string {
  // El JWT va como query param porque la API WebSocket del navegador no permite enviar headers propios.
  if (frontendConfig.websocketUrl) {
    return `${frontendConfig.websocketUrl}?token=${encodeURIComponent(token)}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/v1/ws?token=${encodeURIComponent(token)}`;
}

export function parseRealtimeEvent(payload: string): MessageCreatedEvent {
  return JSON.parse(payload) as MessageCreatedEvent;
}
