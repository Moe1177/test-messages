import { useState, useEffect, useRef, useCallback } from "react";
import SockJS from "sockjs-client";
import { Client, Stomp, StompSubscription } from "@stomp/stompjs";

const WS_URL = "https://soen341-deployement-latest.onrender.com/ws";
const token =
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtb2UxMTQ3IiwiaWF0IjoxNzQxNDk2MDU1LCJleHAiOjE3NDE1ODI0NTV9.lahoXrfLRy78w2P7Aj7hNp60Wtt7n5nkzjTrwJaDSHM";
const RECONNECT_DELAY = 5000; // 5 seconds

export function useWebSocket() {
  const [stompClient, setStompClient] = useState<Client | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Track active subscriptions to prevent duplicates and enable proper cleanup
  const subscriptionsRef = useRef<Map<string, StompSubscription>>(new Map());
  // Store pending subscriptions that should be made once connected
  const pendingSubscriptionsRef = useRef<Map<string, (message: any) => void>>(
    new Map()
  );

  // Store the client in a ref to access it in cleanup functions
  const stompClientRef = useRef<Client | null>(null);

  const connectWebSocket = useCallback(() => {
    if (!token) {
      setError("No authentication token found");
      return;
    }

    try {
      // Clean up existing client if any
      if (stompClientRef.current && stompClientRef.current.connected) {
        stompClientRef.current.deactivate();
      }

      // Create a new STOMP client directly without using Stomp.over
      const client = new Client({
        // Provide a WebSocket factory function instead of a direct instance
        webSocketFactory: () => new SockJS(WS_URL),
        connectHeaders: {
          Authorization: `Bearer ${token}`,
        },
        debug: () => {}, // Disable debug logs in production
        reconnectDelay: RECONNECT_DELAY,
      });

      // Connection lifecycle handlers
      client.onConnect = () => {
        console.log("Connected to WebSocket");
        setStompClient(client);
        stompClientRef.current = client;
        setConnected(true);
        setError(null);
        setReconnectAttempts(0);

        // Set up any pending subscriptions
        pendingSubscriptionsRef.current.forEach((callback, destination) => {
          subscribeToDestination(destination, callback);
        });
        pendingSubscriptionsRef.current.clear();
      };

      client.onStompError = (frame) => {
        console.error("STOMP Error:", frame);
        setError(`STOMP Error: ${frame.headers?.message || "Unknown error"}`);
      };

      client.onWebSocketClose = () => {
        console.log("WebSocket connection closed");
        setConnected(false);

        // The client will handle reconnection automatically based on reconnectDelay
        setReconnectAttempts((prev) => prev + 1);
      };

      client.activate();
    } catch (error) {
      console.error("Error connecting to WebSocket:", error);
      setError("Failed to establish WebSocket connection");
    }
  }, [reconnectAttempts]);

  // Initial connection
  useEffect(() => {
    connectWebSocket();

    return () => {
      // Clean up subscriptions
      subscriptionsRef.current.forEach((subscription) => {
        subscription.unsubscribe();
      });

      // Disconnect client
      if (stompClientRef.current) {
        const client = stompClientRef.current;
        stompClientRef.current = null; // Prevent reconnection attempts
        setStompClient(null);
        setConnected(false);

        client.deactivate();
      }
    };
  }, [connectWebSocket]);

  const sendMessage = useCallback(
    (destination: string, message: string) => {
      if (!stompClientRef.current || !connected) {
        console.error("Cannot send message: WebSocket not connected");
        return false;
      }

      try {
        stompClientRef.current.publish({
          destination: destination,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: message,
        });
        return true;
      } catch (error) {
        console.error("Error sending message:", error);
        return false;
      }
    },
    [connected]
  );

  const subscribeToDestination = useCallback(
    (destination: string, callback: (message: any) => void) => {
      // Store as pending if not yet connected
      if (!stompClientRef.current || !connected) {
        console.log(`Storing pending subscription to: ${destination}`);
        pendingSubscriptionsRef.current.set(destination, callback);
        return;
      }

      // Check if we're already subscribed to this destination
      if (!subscriptionsRef.current.has(destination)) {
        console.log(`Subscribing to: ${destination}`);
        try {
          const subscription = stompClientRef.current.subscribe(
            destination,
            (message) => {
              try {
                const parsedBody = JSON.parse(message.body);
                callback(parsedBody);
              } catch (e) {
                console.error("Error parsing message:", e);
              }
            }
          );

          // Store the subscription
          subscriptionsRef.current.set(destination, subscription);
        } catch (error) {
          console.error(`Error subscribing to ${destination}:`, error);
        }
      }
    },
    [connected]
  );

  const unsubscribeFromDestination = useCallback((destination: string) => {
    // Remove from pending subscriptions if it's there
    pendingSubscriptionsRef.current.delete(destination);

    // Unsubscribe if we have an active subscription
    const subscription = subscriptionsRef.current.get(destination);
    if (subscription) {
      console.log(`Unsubscribing from: ${destination}`);
      try {
        subscription.unsubscribe();
      } catch (error) {
        console.error(`Error unsubscribing from ${destination}:`, error);
      }
      subscriptionsRef.current.delete(destination);
    }
  }, []);

  // Force reconnection function
  const reconnect = useCallback(() => {
    console.log("Forcing reconnection...");
    if (stompClientRef.current) {
      try {
        stompClientRef.current.deactivate();
      } catch (error) {
        console.error("Error deactivating client:", error);
      }
    }
    connectWebSocket();
  }, [connectWebSocket]);

  return {
    connected,
    sendMessage,
    subscribeToDestination,
    unsubscribeFromDestination,
    error,
    reconnect,
  };
}
