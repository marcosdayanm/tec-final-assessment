import { useCallback, useEffect, useRef, useState } from "react";

const WS_BASE = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000";

interface UseWebSocketOptions {
  chatId: string;
  token: string;
  onMessage: (text: string) => void;
}

export function useWebSocket({ chatId, token, onMessage }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/${chatId}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      onMessage(event.data as string);
    };

    return () => {
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, token]);

  const send = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(text);
    }
  }, []);

  return { connected, send };
}
