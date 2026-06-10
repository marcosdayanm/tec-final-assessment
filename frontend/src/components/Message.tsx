import type { ComponentType } from "react";
import type { ClassificationLabel, UiMessage } from "../types";
import { AlertTriangleIcon, BanIcon, CheckIcon, InfoIcon, type IconProps } from "./icons";
import "./Message.css";

interface Props {
  message: UiMessage;
}

const LABEL_CONFIG: Record<
  ClassificationLabel,
  { text: string; className: string; Icon: ComponentType<IconProps> }
> = {
  ham: {
    text: "Normal",
    className: "label-ham",
    Icon: CheckIcon,
  },
  spam: {
    text: "Spam",
    className: "label-spam",
    Icon: BanIcon,
  },
  smishing: {
    text: "Smishing",
    className: "label-smishing",
    Icon: AlertTriangleIcon,
  },
  unclassified: {
    text: "Clasificacion no disponible",
    className: "label-unclassified",
    Icon: InfoIcon,
  },
};

function formatTime(dateValue: string) {
  return new Date(dateValue).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message }: Props) {
  const isMe = message.direction === "me";
  const label = LABEL_CONFIG[message.classificationLabel];
  const LabelIcon = label.Icon;
  const showLabel = message.classificationLabel !== "ham";

  return (
    <div className={`msg-row ${isMe ? "msg-row--me" : "msg-row--other"}`}>
      <div className={`msg-bubble ${isMe ? "msg-bubble--me" : "msg-bubble--other"}`}>
        <p className="msg-text">{message.content}</p>
        <div className="msg-footer">
          {!isMe && showLabel && (
            <span className={`msg-label ${label.className}`}>
              <span className="msg-label__icon">
                <LabelIcon size={13} />
              </span>
              {label.text}
            </span>
          )}
          <span className="msg-time">{formatTime(message.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
