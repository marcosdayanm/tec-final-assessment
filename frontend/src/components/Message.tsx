import type { Message, MessageLabel } from "../types";
import "./Message.css";

interface Props {
  message: Message;
}

const LABEL_CONFIG: Record<
  MessageLabel,
  { text: string; className: string; icon: string }
> = {
  spam: {
    text: "⚠️ Posible SPAM",
    className: "label-spam",
    icon: "🚫",
  },
  phishing: {
    text: "🎣 PHISHING detectado — no hagas clic en enlaces",
    className: "label-phishing",
    icon: "☠️",
  },
  real: {
    text: "✅ Mensaje legítimo",
    className: "label-real",
    icon: "✅",
  },
  pending: {
    text: "Analizando...",
    className: "label-pending",
    icon: "⏳",
  },
};

function formatTime(date: Date) {
  return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message }: Props) {
  const isMe = message.sender === "me";
  const label = message.label ? LABEL_CONFIG[message.label] : null;
  const showWarning = message.label && message.label !== "real";

  return (
    <div className={`msg-row ${isMe ? "msg-row--me" : "msg-row--other"}`}>
      <div className={`msg-bubble ${isMe ? "msg-bubble--me" : "msg-bubble--other"}`}>
        <p className="msg-text">{message.text}</p>
        <span className="msg-time">{formatTime(message.timestamp)}</span>
      </div>

      {/* Only show label for incoming messages */}
      {!isMe && label && (
        <div className={`msg-label ${label.className} ${showWarning ? "msg-label--warn" : ""}`}>
          {label.text}
        </div>
      )}
    </div>
  );
}
