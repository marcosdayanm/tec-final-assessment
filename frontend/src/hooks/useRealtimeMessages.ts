import { useEffect, useRef, useState } from "react";
import { buildWebSocketUrl, parseRealtimeEvent } from "../api/chat";
import type { MessageCreatedEvent } from "../types";

interface UseRealtimeMessagesOptions {
  token: string;
  onMessageCreated: (event: MessageCreatedEvent) => void;
  onAuthError: () => void;
}

export function useRealtimeMessages({
  token,
  onMessageCreated,
  onAuthError,
}: UseRealtimeMessagesOptions) {
  const [connected, setConnected] = useState(false);
  // Guardamos los callbacks en refs para no reabrir el WebSocket en cada render: solo depende del token.
  const onMessageCreatedRef = useRef(onMessageCreated);
  const onAuthErrorRef = useRef(onAuthError);

  useEffect(() => {
    onMessageCreatedRef.current = onMessageCreated;
  }, [onMessageCreated]);

  useEffect(() => {
    onAuthErrorRef.current = onAuthError;
  }, [onAuthError]);

  useEffect(() => {
    const websocket = new WebSocket(buildWebSocketUrl(token));

    websocket.onopen = () => setConnected(true);
    websocket.onclose = (event) => {
      setConnected(false);
      if (event.code === 4401 || event.reason === "Invalid or expired token.") {
        onAuthErrorRef.current();
      }
    };
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
