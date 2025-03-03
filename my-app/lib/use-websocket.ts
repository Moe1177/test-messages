"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Client, type Message } from "@stomp/stompjs";

interface WebSocketHook {
  connected: boolean;
  sendMessage: (destination: string, body: string) => void;
  subscribeToDestination: (
    destination: string,
    callback: (message: Message) => void
  ) => void;
  connect: (url: string) => void;
  disconnect: () => void;
  error: Error | null;
}

export function useWebSocket(): WebSocketHook {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const clientRef = useRef<Client | null>(null);

  const connect = useCallback((url: string) => {
    clientRef.current = new Client({
      brokerURL: url,
      onConnect: () => {
        setConnected(true);
        setError(null);
        console.log("STOMP connection established");
      },
      onStompError: (frame) => {
        setError(new Error(`STOMP error: ${frame.headers.message}`));
        console.error("STOMP error", frame);
      },
    });

    clientRef.current.activate();
  }, []);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.deactivate();
    }
    setConnected(false);
    setError(null);
  }, []);

  const sendMessage = useCallback((destination: string, body: string) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish({ destination, body });
    } else {
      console.error("STOMP is not connected");
      setError(new Error("STOMP is not connected"));
    }
  }, []);

  const subscribeToDestination = useCallback(
    (destination: string, callback: (message: Message) => void) => {
      if (clientRef.current?.connected) {
        clientRef.current.subscribe(destination, callback);
      } else {
        console.error("STOMP is not connected");
        setError(new Error("STOMP is not connected"));
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connected,
    sendMessage,
    subscribeToDestination,
    connect,
    disconnect,
    error,
  };
}
