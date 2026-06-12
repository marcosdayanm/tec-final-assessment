import { useEffect, useRef, useState } from "react";
import type { SessionUser, UiConversation, UiMessage } from "../types";
import { Avatar } from "./Avatar";
import { MessageBubble } from "./Message";
import "./ChatWindow.css";

interface Props {
  conversation: UiConversation;
  messages: UiMessage[];
  currentUser: SessionUser;
  isLoadingMessages: boolean;
  error: string;
  onSendMessage: (content: string) => Promise<void>;
}

export function ChatWindow({
  conversation,
  messages,
  currentUser,
  isLoadingMessages,
  error,
  onSendMessage,
}: Props) {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll al último mensaje cada vez que llega o se envía uno.
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    try {
      setIsSending(true);
      await onSendMessage(trimmed);
    } finally {
      setIsSending(false);
    }
    setInput("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    // Enter envía; Shift+Enter inserta un salto de línea.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        <Avatar
          className="chat-header__avatar"
          name={conversation.contact.username}
          url={conversation.contact.avatar_url}
        />
        <div>
          <p className="chat-header__name">{conversation.contact.username}</p>
          <span className="chat-header__status status--online">Conectado a la sesión de @{currentUser.username}</span>
        </div>
      </div>

      <div className="chat-messages">
        {isLoadingMessages && <p className="chat-empty">Cargando mensajes...</p>}
        {!isLoadingMessages && error && <p className="chat-error">{error}</p>}
        {!isLoadingMessages && !error && messages.length === 0 && (
          <p className="chat-empty">Inicia la conversación…</p>
        )}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        <textarea
          className="chat-input"
          rows={1}
          placeholder="Escribe un mensaje…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
        />
        <button className="chat-send-btn" onClick={() => void handleSend()} disabled={!input.trim() || isSending}>
          {isSending ? "Enviando..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}
