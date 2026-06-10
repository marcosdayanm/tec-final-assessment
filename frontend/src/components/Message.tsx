import type { ClassificationLabel, UiMessage } from "../types";
import "./Message.css";

interface Props {
  message: UiMessage;
}

const LABEL_CONFIG: Record<
  ClassificationLabel,
  { text: string; className: string }
> = {
  ham: {
    text: "Normal",
    className: "label-ham",
  },
  spam: {
    text: "Spam",
    className: "label-spam",
  },
  smishing: {
    text: "Smishing",
    className: "label-smishing",
  },
};

function formatTime(dateValue: string) {
  return new Date(dateValue).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message }: Props) {
  const isMe = message.direction === "me";
  const label = LABEL_CONFIG[message.classificationLabel];
  const showWarning = message.classificationLabel === "spam" || message.classificationLabel === "smishing";

  return (
    <div className={`msg-row ${isMe ? "msg-row--me" : "msg-row--other"}`}>
      <div className={`msg-bubble ${isMe ? "msg-bubble--me" : "msg-bubble--other"}`}>
        <p className="msg-text">{message.content}</p>
        <div className="msg-footer">
          {!isMe && showWarning && (
            <span className={`msg-label ${label.className}`}>{label.text}</span>
          )}
          <span className="msg-time">{formatTime(message.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
