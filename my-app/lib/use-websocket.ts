import { useState, useEffect } from "react";
import SockJS from "sockjs-client";
import { Client, Stomp } from "@stomp/stompjs";

const WS_URL = "http://localhost:8080/ws";
const token =
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtb2UxMTQ3IiwiaWF0IjoxNzQxMzY1MDIzLCJleHAiOjE3NDE0NTE0MjN9.F6vr4p-MWbkbVD5KY0LewL7-mLPKTNCQY6ih1IvQe10";

export function useWebSocket() {
  const [stompClient, setStompClient] = useState<Client | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = new SockJS(WS_URL);
    const client = Stomp.over(socket);

    client.connect(
      { Authorization: `Bearer ${token}` },
      () => {
      console.log("Connected to WebSocket");
      setStompClient(client);
      setConnected(true);
      },
      (err: Error) => {
      console.error("WebSocket connection error", err);
      setError("WebSocket connection failed");
      },
    );

    return () => {
      if (client) client.disconnect(() => {
        console.log("Disconnected from WebSocket");
      });
    };
  }, []);

  const sendMessage = (destination: string, message: string) => {
    if (stompClient && connected) {
      stompClient.publish({
        destination: destination,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: message
      });
    } else {
      console.error("Cannot send message: WebSocket not connected");
    }
  };

  const subscribeToDestination = (
    destination: string,
    callback: (message: any) => void
  ) => {
    if (stompClient && connected) {
      stompClient.subscribe(destination, (message) => {
        callback(JSON.parse(message.body));
      });
    }
  };

  const unsubscribeFromDestination = (destination: string) => {
    if (stompClient && connected) {
      stompClient.unsubscribe(destination);
    }
  };

  return {
    connected,
    sendMessage,
    subscribeToDestination,
    unsubscribeFromDestination,
    error,
  };
}
