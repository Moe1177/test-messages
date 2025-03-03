"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface WebSocketHook {
  connected: boolean;
  connecting: boolean;
  sendMessage: (message: string) => void;
  lastMessage: MessageEvent | null;
  connect: (url: string) => void;
  disconnect: () => void;
  error: Error | null;
}

export function useWebSocket(): WebSocketHook {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const urlRef = useRef<string>("");

  const connect = useCallback((url: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Ensure we're using a secure WebSocket connection if the page is served over HTTPS
    const secureUrl = url.replace(/^ws:/, "wss:");
    urlRef.current = secureUrl;
    setConnecting(true);
    setError(null);

    const socket = new WebSocket(secureUrl);

    socket.onopen = () => {
      setConnected(true);
      setConnecting(false);
      console.log("WebSocket connection established");
    };

    socket.onmessage = (event) => {
      setLastMessage(event);
    };

    socket.onerror = (event) => {
      console.error("WebSocket error:", event);
      setError(new Error("WebSocket connection error"));
      setConnecting(false);
    };

    socket.onclose = (event) => {
      setConnected(false);
      console.log("WebSocket connection closed:", event.code, event.reason);

      // Attempt to reconnect after 3 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        if (urlRef.current) {
          connect(urlRef.current);
        }
      }, 3000);
    };

    socketRef.current = socket;
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnected(false);
    setConnecting(false);
    setError(null);
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    } else {
      console.error("WebSocket is not connected");
      setError(new Error("WebSocket is not connected"));
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connected,
    connecting,
    sendMessage,
    lastMessage,
    connect,
    disconnect,
    error,
  };
}
