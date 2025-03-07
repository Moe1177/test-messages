import { useState, useCallback, useRef, useEffect } from "react";
import SockJS from "sockjs-client";
import { Client, Frame, Message, Stomp } from "@stomp/stompjs";

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<Client | null>(null);
  const subscriptionsRef = useRef<{
    [key: string]: { id: string; callback: (message: any) => void };
  }>({});

  const connect = useCallback((url: string) => {
    try {
      const client = new Client({
        webSocketFactory: () => new SockJS(url),
        onConnect: () => {
          console.log("WebSocket connected");
          setConnected(true);
          setError(null);
        },
        onDisconnect: () => {
          console.log("WebSocket disconnected");
          setConnected(false);
        },
        onStompError: (frame) => {
          console.error("STOMP error", frame);
          setError(`STOMP error: ${frame.headers?.message || "Unknown error"}`);
        },
        reconnectDelay: 5000,
      });

      // Add authentication headers
      const token = localStorage.getItem("token") || "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtb2UxMTQ3IiwiaWF0IjoxNzQxMjA2NjA1LCJleHAiOjE3NDEyOTMwMDV9.4dSwRt_AmK-cvMvcGY-3c4wEZrNBBH2Ioyelx28LLJ8";
      client.connectHeaders = {
        Authorization: `Bearer ${token}`,
      };

      client.activate();
      clientRef.current = client;
    } catch (err) {
      console.error("WebSocket connection error:", err);
      setError(
        `Connection error: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
      setConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (clientRef.current && clientRef.current.connected) {
      clientRef.current.deactivate();
      setConnected(false);
    }
    subscriptionsRef.current = {};
  }, []);

  const sendMessage = useCallback((destination: string, body: string) => {
    if (clientRef.current && clientRef.current.connected) {
      clientRef.current.publish({
        destination,
        body,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });
    } else {
      console.error("Cannot send message: WebSocket is not connected");
      setError("Cannot send message: WebSocket is not connected");
    }
  }, []);

  const subscribeToDestination = useCallback(
    (destination: string, callback: (message: any) => void) => {
      if (clientRef.current && clientRef.current.connected) {
        // Check if already subscribed to avoid duplicates
        if (subscriptionsRef.current[destination]) {
          return;
        }

        const subscription = clientRef.current.subscribe(
          destination,
          (message) => {
            try {
              const payload = JSON.parse(message.body);
              callback(payload);
            } catch (err) {
              console.error("Error parsing message:", err);
              callback(message.body);
            }
          },
          {
            Authorization: `Bearer ${
              localStorage.getItem("token") ||
              "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtb2UxMTQ3IiwiaWF0IjoxNzQxMjA2NjA1LCJleHAiOjE3NDEyOTMwMDV9.4dSwRt_AmK-cvMvcGY-3c4wEZrNBBH2Ioyelx28LLJ8"
            }`,
          }
        );

        subscriptionsRef.current[destination] = {
          id: subscription.id,
          callback,
        };
      } else {
        console.error("Cannot subscribe: WebSocket is not connected");
        setError("Cannot subscribe: WebSocket is not connected");
      }
    },
    []
  );

  const unsubscribeFromDestination = useCallback((destination: string) => {
    if (clientRef.current && subscriptionsRef.current[destination]) {
      const subscription = subscriptionsRef.current[destination];
      if (subscription) {
        clientRef.current.unsubscribe(subscription.id);
        delete subscriptionsRef.current[destination];
      }
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
    error,
    connect,
    disconnect,
    sendMessage,
    subscribeToDestination,
    unsubscribeFromDestination,
  };
}
