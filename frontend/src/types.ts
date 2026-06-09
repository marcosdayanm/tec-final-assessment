export type MessageLabel = "spam" | "phishing" | "real" | "pending";

export interface Message {
  id: string;
  text: string;
  sender: "me" | "other";
  timestamp: Date;
  label?: MessageLabel;
}

export interface Chat {
  id: string;
  contact: string;
  avatar: string;
  lastMessage: string;
  unread: number;
  messages: Message[];
}

export interface User {
  email: string;
  token: string;
}

export interface PredictResponse {
  label: MessageLabel;
  confidence?: number;
}
