import type { ClassificationLabel, UiMessage } from "../types";
import "./Message.css";

interface Props {
  message: UiMessage;
}

const LABEL_CONFIG: Record<
  ClassificationLabel,
  { text: string; className: string; icon: string }
> = {
  ham: {
    text: "Mensaje normal",
    className: "label-ham",
    icon: "✅",
  },
  spam: {
    text: "Posible spam",
    className: "label-spam",
    icon: "🚫",
  },
  smishing: {
    text: "Posible smishing",
    className: "label-smishing",
    icon: "☠️",
  },
  unclassified: {
    text: "Clasificacion no disponible",
    className: "label-unclassified",
    icon: "ℹ️",
  },
};

function formatTime(dateValue: string) {
  return new Date(dateValue).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message }: Props) {
  const isMe = message.direction === "me";
  const label = LABEL_CONFIG[message.classificationLabel];
  const showLabel = message.classificationLabel !== "ham";

  return (
    <div className={`msg-row ${isMe ? "msg-row--me" : "msg-row--other"}`}>
      <div className={`msg-bubble ${isMe ? "msg-bubble--me" : "msg-bubble--other"}`}>
        <p className="msg-text">{message.content}</p>
        <span className="msg-time">{formatTime(message.createdAt)}</span>
      </div>

      {showLabel && (
        <div className={`msg-label ${label.className}`}>
          <span className="msg-label__icon">{label.icon}</span>
          {label.text}
        </div>
      )}
    </div>
  );
}
