import { useEffect, useRef, useState } from "react";
import { buildWebSocketUrl, parseRealtimeEvent } from "../api/chat";
import type { MessageCreatedEvent } from "../types";

interface UseRealtimeMessagesOptions {
  token: string;
  onMessageCreated: (event: MessageCreatedEvent) => void;
}

export function useRealtimeMessages({ token, onMessageCreated }: UseRealtimeMessagesOptions) {
  const [connected, setConnected] = useState(false);
  const onMessageCreatedRef = useRef(onMessageCreated);

  useEffect(() => {
    onMessageCreatedRef.current = onMessageCreated;
  }, [onMessageCreated]);

  useEffect(() => {
    const websocket = new WebSocket(buildWebSocketUrl(token));

    websocket.onopen = () => setConnected(true);
    websocket.onclose = () => setConnected(false);
    websocket.onerror = () => setConnected(false);
    websocket.onmessage = (event) => {
      const messageCreatedEvent = parseRealtimeEvent(event.data as string);
      if (messageCreatedEvent.type === "message_created") {
        onMessageCreatedRef.current(messageCreatedEvent);
      }
    };

    return () => {
      websocket.close();
    };
  }, [token]);

  return { connected };
}
