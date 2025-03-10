import { useState, useEffect, useRef, useCallback } from "react";
import SockJS from "sockjs-client";
import { Client, Stomp, StompSubscription } from "@stomp/stompjs";
import { WebSocketMessage } from "./types";

// Define message types for better type safety


interface UseWebSocketOptions {
  wsUrl?: string;
  token?: string;
  userId?: string;
  recipientId?: string;
  autoConnect?: boolean;
  debug?: boolean;
}

const DEFAULT_RECONNECT_DELAY = 5000; // 5 seconds

export function useWebSocket({
  wsUrl = "https://soen341-deployement-latest.onrender.com/ws",
  token,
  userId,
  recipientId,
  autoConnect = true,
  debug = false,
}: UseWebSocketOptions = {}) {
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

      // Create a new STOMP client
      const client = new Client({
        webSocketFactory: () => new SockJS(wsUrl),
        connectHeaders: {
          Authorization: `Bearer ${token}`,
        },
        debug: debug ? (msg) => console.debug(msg) : () => {}, // Enable for debugging, disable in production
        reconnectDelay: DEFAULT_RECONNECT_DELAY,
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
        setReconnectAttempts((prev) => prev + 1);
      };

      client.activate();
    } catch (error) {
      console.error("Error connecting to WebSocket:", error);
      setError("Failed to establish WebSocket connection");

      // Schedule a reconnection attempt
      setTimeout(() => {
        setReconnectAttempts((prev) => prev + 1);
        connectWebSocket();
      }, DEFAULT_RECONNECT_DELAY);
    }
  }, [token, wsUrl, debug, reconnectAttempts]);

  // Initial connection
  useEffect(() => {
    if (autoConnect) {
      connectWebSocket();
    }

    return () => {
      // Clean up subscriptions
      subscriptionsRef.current.forEach((subscription) => {
        try {
          subscription.unsubscribe();
        } catch (e) {
          console.error("Error unsubscribing:", e);
        }
      });

      // Disconnect client
      if (stompClientRef.current) {
        const client = stompClientRef.current;
        stompClientRef.current = null; // Prevent reconnection attempts
        setStompClient(null);
        setConnected(false);

        try {
          client.deactivate();
        } catch (e) {
          console.error("Error deactivating client:", e);
        }
      }
    };
  }, [connectWebSocket, autoConnect]);

  const sendMessage = useCallback(
    (destination: string, message: string | object) => {
      if (!stompClientRef.current || !connected) {
        console.error("Cannot send message: WebSocket not connected");
        return false;
      }

      try {
        const messageBody =
          typeof message === "string" ? message : JSON.stringify(message);

        stompClientRef.current.publish({
          destination: destination,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-type": "application/json",
          },
          body: messageBody,
        });

        if (debug) {
          console.log(`Sent message to ${destination}:`, message);
        }
        return true;
      } catch (error) {
        console.error("Error sending message:", error);
        return false;
      }
    },
    [connected, token, debug]
  );

  const subscribeToDestination = useCallback(
    (destination: string, callback: (message: any) => void) => {
      // Store as pending if not yet connected
      if (!stompClientRef.current || !connected) {
        if (debug) {
          console.log(`Storing pending subscription to: ${destination}`);
        }
        pendingSubscriptionsRef.current.set(destination, callback);
        return;
      }

      // Check if we're already subscribed to this destination
      if (!subscriptionsRef.current.has(destination)) {
        if (debug) {
          console.log(`Subscribing to: ${destination}`);
        }
        try {
          const subscription = stompClientRef.current.subscribe(
            destination,
            (message) => {
              try {
                const parsedBody = JSON.parse(message.body);
                callback(parsedBody);
              } catch (e) {
                console.error("Error parsing message:", e);
                // If parsing fails, pass the raw body
                callback(message.body);
              }
            },
            {
              Authorization: `Bearer ${token}`,
            }
          );

          // Store the subscription
          subscriptionsRef.current.set(destination, subscription);
        } catch (error) {
          console.error(`Error subscribing to ${destination}:`, error);
        }
      }
    },
    [connected, token, debug]
  );

  const unsubscribeFromDestination = useCallback(
    (destination: string) => {
      // Remove from pending subscriptions if it's there
      pendingSubscriptionsRef.current.delete(destination);

      // Unsubscribe if we have an active subscription
      const subscription = subscriptionsRef.current.get(destination);
      if (subscription) {
        if (debug) {
          console.log(`Unsubscribing from: ${destination}`);
        }
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.error(`Error unsubscribing from ${destination}:`, error);
        }
        subscriptionsRef.current.delete(destination);
      }
    },
    [debug]
  );

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

  // --- Chat-specific helper methods ---

  // Subscribe to a channel (for group messages)
  const subscribeToChannel = useCallback(
    (channelId: string, callback: (message: WebSocketMessage) => void) => {
      const destination = `/channel/${channelId}`;
      subscribeToDestination(destination, callback);
      return () => unsubscribeFromDestination(destination);
    },
    [subscribeToDestination, unsubscribeFromDestination]
  );

  // Subscribe to direct messages
  const subscribeToDirectMessages = useCallback(
    (callback: (message: WebSocketMessage) => void) => {
      if (!recipientId) {
        console.error(
          "Cannot subscribe to direct messages: No recipientId provided"
        );
        return () => {};
      }
      const destination = `/user/${recipientId}/direct-messages`;
      subscribeToDestination(destination, callback);
      return () => unsubscribeFromDestination(destination);
    },
    [subscribeToDestination, unsubscribeFromDestination, userId]
  );

  // Send a message to a channel
  const sendChannelMessage = useCallback(
    (channelId: string, content: string, senderUsername: string) => {
      if (!userId) {
        console.error("Cannot send channel message: No userId provided");
        return false;
      }

      const message: WebSocketMessage = {
        id: "",
        content,
        senderId: userId,
        receiverId: channelId,
        channelId: channelId,
        senderUsername,
        timestamp: new Date(),
      };

      return sendMessage("/app/channel", message);
    },
    [sendMessage, userId]
  );

  // Send a direct message to another user
  const sendDirectMessage = useCallback(
    (receiverId: string, content: string, channelId: string) => {
      if (!userId) {
        console.error("Cannot send direct message: No userId provided");
        return false;
      }

      const message: WebSocketMessage = {
        id: "",
        content,
        senderId: userId,
        receiverId,
        channelId: channelId,
        senderUsername: "",
        isDirectMessage: true,
        timestamp: new Date(),
      };

      return sendMessage("/app/direct-message", message);
    },
    [sendMessage, userId]
  );

  return {
    // Connection state
    connected,
    error,
    reconnect,

    // Core WebSocket operations
    sendMessage,
    subscribeToDestination,
    unsubscribeFromDestination,

    // Chat-specific operations
    subscribeToChannel,
    subscribeToDirectMessages,
    sendChannelMessage,
    sendDirectMessage,
  };
}
