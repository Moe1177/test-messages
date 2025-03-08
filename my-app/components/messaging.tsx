"use client";

import { useState, useEffect } from "react";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { Sidebar } from "./sidebar";
import { ConversationHeader } from "./conversation-header";
import type { User, Message, Channel, WebSocketMessage } from "@/lib/types";
import { useWebSocket } from "@/lib/use-websocket";
import { CreateChannelDialog } from "./create-channel-dialog";
import { CreateDirectMessageDialog } from "./create-direct-message-dialog";
import { ChannelInviteDialog } from "./channel-invite-dialog";

// Define the DirectMessageDisplay interface to match sidebar.tsx
interface DirectMessageDisplay {
  id: string;
  participant: User;
  unreadCount?: number;
}

// Define ExtendedChannel interface to match sidebar.tsx
interface ExtendedChannel extends Channel {
  unreadCount?: number;
}

export function Messaging() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [channels, setChannels] = useState<ExtendedChannel[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessageDisplay[]>(
    []
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [isActiveChannelConversation, setIsActiveChannelConversation] =
    useState<boolean>(true);
  const [users, setUsers] = useState<User[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});

  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateDM, setShowCreateDM] = useState(false);
  const [showChannelInvite, setShowChannelInvite] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  // Hard-coded values as requested
  const channelId = "67c4ddbd9ef42e1c0eb7c343";
  const userId = "67c5071c2f3f3c63306870b2";
  const otherUserId = "67c50a6da4d538066589c299";
  const token =
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtb2UxMTQ3IiwiaWF0IjoxNzQxMzY1MDIzLCJleHAiOjE3NDE0NTE0MjN9.F6vr4p-MWbkbVD5KY0LewL7-mLPKTNCQY6ih1IvQe10";

  // WebSocket connection and handlers
  const {
    connected,
    sendMessage,
    subscribeToDestination,
    unsubscribeFromDestination,
    error: wsError,
  } = useWebSocket();

  // Initialize connection and fetch initial data
  useEffect(() => {
    // Store token in localStorage for the WebSocket hook to use
    localStorage.setItem("token", token);

     if (!connected) {
       console.log("Connecting to WebSocket...");
     }
    
    // Fetch initial data
    fetchCurrentUser();
    fetchChannels();
    fetchDirectMessages();
    fetchUsers();
  }, []);

  // Set up WebSocket subscriptions based on current state
  useEffect(() => {
    if (connected) {
      // Clear previous subscriptions when changing active conversation
      if (activeConversationId) {
        if (isActiveChannelConversation) {
          // Subscribe to the active channel
          subscribeToDestination(
            `http://localhost:8080/topic/channel/${activeConversationId}`,
            (message) => {
              handleNewMessage(message as Message);
            }
          );
        }
      }

      // Subscribe to user-specific messages for direct messages
      subscribeToDestination(
        `http://localhost:8080/user/queue/${userId}`,
        (message) => {
          handleNewMessage(message as Message);
        }
      );

      // Subscribe to channel creation events
      subscribeToDestination(
        "http://localhost:8080/topic/channels",
        (channel) => {
          handleChannelCreated(channel as Channel);
        }
      );

      return () => {
        // Clean up subscriptions
        if (activeConversationId && isActiveChannelConversation) {
          unsubscribeFromDestination(
            `http://localhost:8080/topic/channel/${activeConversationId}`
          );
        }
        unsubscribeFromDestination(
          `http://localhost:8080/user/queue/${userId}`
        );
        unsubscribeFromDestination("http://localhost:8080/topic/channels");
      };
    }
  }, [
    connected,
    activeConversationId,
    isActiveChannelConversation,
  ]);

  // Create users map for MessageList component
  useEffect(() => {
    const map: Record<string, User> = {};
    users.forEach((user) => {
      map[user.id] = user;
    });
    setUsersMap(map);
  }, [users]);

  // Helper function to handle API responses
  const handleApiResponse = async (response: Response) => {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error (${response.status}): ${text}`);
    }
    return response.json();
  };

  // API calls to fetch data
  const fetchCurrentUser = async () => {
    try {
      // Using hard-coded token as requested
      if (!token) {
        console.error("No authentication token found");
        return;
      }

      // Make the request to the correct endpoint with Authorization header
      const response = await fetch(
        "http://localhost:8080/api/users/currentUser",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await handleApiResponse(response);
      setCurrentUser(data);
    } catch (error) {
      console.error("Error fetching current user:", error);

      // For testing purposes, set a fallback user
      setCurrentUser({
        id: userId,
        username: "TestUser",
        email: "test@example.com",
        password: "",
        channelIds: [],
        directMessageIds: [],
        adminsForWhichChannels: [],
        status: "ONLINE",
      });
    }
  };

  const fetchChannels = async () => {
    try {
      const response = await fetch(
        `http://localhost:8080/api/channels/user/${userId}`
      );
      const data = await handleApiResponse(response);

      // Add unreadCount property to match ExtendedChannel
      const extendedChannels: ExtendedChannel[] = data.map(
        (channel: Channel) => ({
          ...channel,
          unreadCount: 0,
        })
      );
      setChannels(extendedChannels);

      // Set first channel as active if no active conversation
      if (extendedChannels.length > 0 && !activeConversationId) {
        setActiveConversationId(extendedChannels[0].id);
        setIsActiveChannelConversation(true);
        fetchMessages(extendedChannels[0].id, true);
      }
    } catch (error) {
      console.error("Error fetching channels:", error);
    }
  };

  const fetchDirectMessages = async () => {
    try {
      const response = await fetch(
        `http://localhost:8080/api/channels/direct-message/${userId}`
      );
      const data = await handleApiResponse(response);

      // Transform DirectMessage data to match DirectMessageDisplay
      const dmDisplays: DirectMessageDisplay[] = data.map((dm: any) => {
        // Find the ID of the other user (not the current user)
        const otherMemberId = dm.directMessageMembers.find(
          (memberId: string) => memberId !== userId
        );

        // Extract both usernames from the DM name
        const dmName = dm.name || "";
        let otherUsername = "Unknown User";

        if (dmName.startsWith("DM:")) {
          // Remove "DM: " prefix and split by " & "
          const usernamesPart = dmName.substring(4); // Remove "DM: "
          const usernames = usernamesPart.split(" & ");

          // Current user's username for comparison
          let currentUsername;
          const user1 = usernames[0];
          const user2 = usernames[1];
          if (user1 === currentUser?.username) {
            currentUsername = user2;
          } else {
            currentUsername = user1;
          }

          // If we have exactly two usernames and one matches the current user
          if (usernames.length === 2) {
            otherUsername =
              usernames[0] === currentUsername ? usernames[1] : usernames[0];
          }
        }

        return {
          id: dm.id,
          participant: {
            id: otherMemberId || otherUserId, // Fallback to hardcoded ID
            username: otherUsername,
            status: "OFFLINE",
            email: "",
            password: "",
            channelIds: [],
            directMessageIds: [],
            adminsForWhichChannels: [],
          },
          unreadCount: 0,
        };
      });

      setDirectMessages(dmDisplays);
    } catch (error) {
      console.error("Error fetching direct messages:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("http://localhost:8080/api/users");
      const data = await handleApiResponse(response);
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchMessages = async (conversationId: string, isChannel: boolean) => {
    try {
      const endpoint = `http://localhost:8080/api/messages/channel/${conversationId}`;

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await handleApiResponse(response);
      console.log(`Fetched messages for channel ${conversationId}:`, data);
      setMessages(data);
    } catch (error) {
      console.error(
        `Error fetching messages for ${
          isChannel ? "channel" : "direct message"
        } ${conversationId}:`,
        error
      );
    }
  };

  // WebSocket message handlers
  const handleNewMessage = (message: Message) => {
    // Check if message belongs to active conversation
    const isActiveConversation =
      (isActiveChannelConversation &&
        activeConversationId === message.channelId) ||
      (!isActiveChannelConversation &&
        message.isDirectMessage &&
        (message.senderId === userId ||
          directMessages.some(
            (dm) =>
              dm.id === activeConversationId &&
              dm.participant.id === message.senderId
          )));

    if (isActiveConversation) {
      setMessages((prev) => [...prev, message]);
    } else {
      // Update unread count for non-active conversations
      if (message.channelId && !message.isDirectMessage) {
        setChannels((prev) =>
          prev.map((channel) => {
            if (channel.id === message.channelId) {
              return {
                ...channel,
                unreadCount: (channel.unreadCount || 0) + 1,
              };
            }
            return channel;
          })
        );
      } else if (message.isDirectMessage) {
        setDirectMessages((prev) =>
          prev.map((dm) => {
            // Match DMs by sender ID for received messages
            if (dm.participant.id === message.senderId) {
              return {
                ...dm,
                unreadCount: (dm.unreadCount || 0) + 1,
              };
            }
            return dm;
          })
        );
      }
    }
  };

  const handleChannelCreated = (channel: Channel) => {
    const extendedChannel: ExtendedChannel = {
      ...channel,
      unreadCount: 0,
    };
    setChannels((prev) => [...prev, extendedChannel]);
  };

  // User actions
  const handleSendMessage = (content: string) => {
    if (!activeConversationId) return;

    if (isActiveChannelConversation) {
      // Send message to channel
      sendChannelMessage(activeConversationId, content);
    } else {
      // Find recipient ID for direct message
      const dm = directMessages.find((d) => d.id === activeConversationId);
      if (dm && dm.participant) {
        sendDirectMessage(dm.participant.id, content);
      }
    }
  };

  // Function to send a message to a channel
  const sendChannelMessage = (channelId: string, content: string) => {
    if (!connected) {
      console.error("Cannot send message: WebSocket not connected");
      return;
    }

    // Create a message object that matches what the backend expects
    const messageData: WebSocketMessage = {
      content: content,
      senderId: userId, // Using the hardcoded userId
      id: "", // This will be generated by the server
      senderUsername: currentUser?.username || "TestUser",
      receiverId: channelId, // For channel messages, receiverId is the channelId
      timestamp: new Date(), // Current timestamp
    };

    console.log(
      `Sending channel message to /app/channel/${channelId}:`,
      messageData
    );

    // Send the message to the channel destination
    sendMessage(`/app/channel/${channelId}`, JSON.stringify(messageData));
  };

  // Function to send a direct message
  const sendDirectMessage = (recipientId: string, content: string) => {
    if (!connected) {
      console.error("Cannot send message: WebSocket not connected");
      return;
    }

    // Create a message object that matches what the backend expects
    const messageData: WebSocketMessage = {
      content: content,
      senderId: userId, // Using the hardcoded userId
      id: "", // This will be generated by the server
      senderUsername: currentUser?.username || "TestUser",
      receiverId: recipientId, // For direct messages, receiverId is the recipient's ID
      timestamp: new Date(), // Current timestamp
    };

    console.log(
      `Sending direct message to /app/dm/${recipientId}:`,
      messageData
    );

    // Send the message to the direct message destination
    sendMessage(`/app/dm/${recipientId}`, JSON.stringify(messageData));
  };

  const handleCreateChannel = async (name: string) => {
    try {
      const response = await fetch(
        `http://localhost:8080/api/channels/create-channel?userId=${userId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name,
          }),
        }
      );

      const data = await handleApiResponse(response);
      setChannels((prev) => [...prev, { ...data, unreadCount: 0 }]);
    } catch (error) {
      console.error("Error creating channel:", error);
    }

    setShowCreateChannel(false);
  };

  const handleCreateDirectMessage = async (recipientId: string) => {
    try {
      const response = await fetch(
        `http://localhost:8080/api/channels/direct-message`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user1Id: userId, // Using hardcoded userId
            user2Id: recipientId,
          }),
        }
      );

      const data = await handleApiResponse(response);

      // Find recipient user info
      const recipient = users.find((user) => user.id === recipientId);

      // Add to direct messages list
      const newDM: DirectMessageDisplay = {
        id: data.id,
        participant: recipient || {
          id: recipientId,
          username: "Unknown User",
          email: "",
          password: "",
          channelIds: [],
          directMessageIds: [],
          adminsForWhichChannels: [],
          status: "OFFLINE",
        },
        unreadCount: 0,
      };

      setDirectMessages((prev) => [...prev, newDM]);
    } catch (error) {
      console.error("Error creating direct message:", error);
    }
    setShowCreateDM(false);
  };

  const handleViewChannelInvite = (channel: Channel) => {
    setSelectedChannel(channel);
    setShowChannelInvite(true);
  };

  const handleConversationSelect = (id: string, isChannel: boolean) => {
    // Unsubscribe from previous channel if it was a channel
    if (activeConversationId && isActiveChannelConversation) {
      unsubscribeFromDestination(
        `http://localhost:8080/topic/channel/${activeConversationId}`
      );
    }

    setActiveConversationId(id);
    setIsActiveChannelConversation(isChannel);
    setMessages([]);
    fetchMessages(id, isChannel);

    // Subscribe to the new channel if it's a channel
    if (isChannel && connected) {
      subscribeToDestination(
        `http://localhost:8080/topic/channel/${id}`,
        (message) => {
          handleNewMessage(message as Message);
        }
      );
    }

    // Reset unread count for the selected conversation
    if (isChannel) {
      setChannels((prev) =>
        prev.map((channel) =>
          channel.id === id ? { ...channel, unreadCount: 0 } : channel
        )
      );
    } else {
      setDirectMessages((prev) =>
        prev.map((dm) => (dm.id === id ? { ...dm, unreadCount: 0 } : dm))
      );
    }
  };

  // Get the active channel or direct message
  const getActiveChannel = (): Channel | null => {
    if (isActiveChannelConversation && activeConversationId) {
      return channels.find((c) => c.id === activeConversationId) || null;
    }
    return null;
  };

  const getActiveDirectMessage = (): {
    receiverId: string;
    senderUsername: string;
  } | null => {
    if (!isActiveChannelConversation && activeConversationId) {
      const dm = directMessages.find((d) => d.id === activeConversationId);
      if (dm) {
        return {
          receiverId: dm.participant.id,
          senderUsername: dm.participant.username,
        };
      }
    }
    return null;
  };

  const getActiveUser = (): User | undefined => {
    if (!isActiveChannelConversation && activeConversationId) {
      const dm = directMessages.find((d) => d.id === activeConversationId);
      return dm?.participant;
    }
    return undefined;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {wsError && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white p-2 text-center">
          WebSocket Error: {wsError}
        </div>
      )}

      <Sidebar
        channels={channels}
        directMessages={directMessages}
        activeConversationId={activeConversationId}
        onConversationSelect={handleConversationSelect}
        onCreateChannel={() => setShowCreateChannel(true)}
        onCreateDirectMessage={() => setShowCreateDM(true)}
        onViewChannelInvite={handleViewChannelInvite}
        currentUser={currentUser}
      />

      <div className="flex flex-col flex-1 overflow-hidden border-l">
        {activeConversationId && (
          <>
            <ConversationHeader
              conversation={
                isActiveChannelConversation
                  ? getActiveChannel()!
                  : getActiveDirectMessage()!
              }
              receiver={getActiveUser()}
              onViewChannelInvite={
                isActiveChannelConversation
                  ? () => handleViewChannelInvite(getActiveChannel()!)
                  : undefined
              }
            />
            <MessageList
              messages={messages}
              currentUser={currentUser}
              users={usersMap}
            />
            <MessageInput
              onSendMessageAction={handleSendMessage}
              // disabled={!connected}
            />
          </>
        )}
      </div>

      {showCreateChannel && (
        <CreateChannelDialog
          onCloseAction={() => setShowCreateChannel(false)}
          onCreateChannelAction={handleCreateChannel}
        />
      )}

      {showCreateDM && (
        <CreateDirectMessageDialog
          users={users}
          currentUserId={userId} // Using hardcoded userId
          onCloseAction={() => setShowCreateDM(false)}
          onCreateDirectMessageAction={handleCreateDirectMessage}
        />
      )}

      {showChannelInvite && selectedChannel && (
        <ChannelInviteDialog
          channel={selectedChannel}
          onCloseAction={() => setShowChannelInvite(false)}
        />
      )}
    </div>
  );
}
