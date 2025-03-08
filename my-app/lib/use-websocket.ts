import { useState, useEffect, useRef } from "react";
import SockJS from "sockjs-client";
import { Client, Stomp, StompSubscription } from "@stomp/stompjs";

const WS_URL = "http://localhost:8080/ws";
const token =
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtb2UxMTQ3IiwiaWF0IjoxNzQxMzY1MDIzLCJleHAiOjE3NDE0NTE0MjN9.F6vr4p-MWbkbVD5KY0LewL7-mLPKTNCQY6ih1IvQe10";

export function useWebSocket() {
  const [stompClient, setStompClient] = useState<Client | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track active subscriptions to prevent duplicates and enable proper cleanup
  const subscriptionsRef = useRef<Map<string, StompSubscription>>(new Map());

  useEffect(() => {
    const socket = new SockJS(WS_URL);
    const client = Stomp.over(socket);

    // Disable debug logs in production
    client.debug = () => {};

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
      }
    );

    return () => {
      // Clean up all subscriptions on unmount
      subscriptionsRef.current.forEach((subscription) => {
        subscription.unsubscribe();
      });

      if (client) {
        client.disconnect(() => {
          console.log("Disconnected from WebSocket");
        });
      }
    };
  }, []);

  const sendMessage = (destination: string, message: string) => {
    if (stompClient && connected) {
      stompClient.publish({
        destination: destination,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: message,
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
      // Check if we're already subscribed to this destination
      if (!subscriptionsRef.current.has(destination)) {
        console.log(`Subscribing to: ${destination}`);
        const subscription = stompClient.subscribe(destination, (message) => {
          try {
            const parsedBody = JSON.parse(message.body);
            callback(parsedBody);
          } catch (e) {
            console.error("Error parsing message:", e);
          }
        });

        // Store the subscription
        subscriptionsRef.current.set(destination, subscription);
      }
    } else {
      console.log(`Will subscribe to ${destination} when connected`);
    }
  };

  const unsubscribeFromDestination = (destination: string) => {
    const subscription = subscriptionsRef.current.get(destination);

    if (subscription) {
      console.log(`Unsubscribing from: ${destination}`);
      subscription.unsubscribe();
      subscriptionsRef.current.delete(destination);
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
