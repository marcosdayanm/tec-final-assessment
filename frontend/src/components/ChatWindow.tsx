import { useEffect, useRef, useState } from "react";
import { predictMessage } from "../api/predict";
import { useWebSocket } from "../hooks/useWebSocket";
import type { Chat, Message } from "../types";
import { MessageBubble } from "./Message";
import "./ChatWindow.css";

interface Props {
  chat: Chat;
  token: string;
  onUpdateChat: (chatId: string, message: Message) => void;
}

export function ChatWindow({ chat, token, onUpdateChat }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  // Handle an incoming WebSocket message
  const handleIncoming = async (text: string) => {
    const id = crypto.randomUUID();

    // Add as "pending" first
    const pending: Message = {
      id,
      text,
      sender: "other",
      timestamp: new Date(),
      label: "pending",
    };
    onUpdateChat(chat.id, pending);

    // Run prediction, then update label
    const label = await predictMessage(text, token);
    const resolved: Message = { ...pending, label };
    onUpdateChat(chat.id, resolved);
  };

  const { connected, send } = useWebSocket({
    chatId: chat.id,
    token,
    onMessage: handleIncoming,
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const msg: Message = {
      id: crypto.randomUUID(),
      text: trimmed,
      sender: "me",
      timestamp: new Date(),
      label: "real", // own messages don't need prediction
    };
    onUpdateChat(chat.id, msg);
    send(trimmed);
    setInput("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header__avatar">{chat.avatar}</div>
        <div>
          <p className="chat-header__name">{chat.contact}</p>
          <span className={`chat-header__status ${connected ? "status--online" : "status--offline"}`}>
            {connected ? "Conectado" : "Desconectado"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {chat.messages.length === 0 && (
          <p className="chat-empty">Inicia la conversación…</p>
        )}
        {chat.messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-bar">
        <textarea
          className="chat-input"
          rows={1}
          placeholder="Escribe un mensaje…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim()}>
          Enviar
        </button>
      </div>
    </div>
  );
}
