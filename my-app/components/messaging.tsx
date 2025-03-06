"use client";

import { useState, useEffect } from "react";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { Sidebar } from "./sidebar";
import { ConversationHeader } from "./conversation-header";
import type { User, Message, Channel, DirectMessage } from "@/lib/types";
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
  const [lastMessage, setLastMessage] = useState<Message | null>(null);

  const channelId = "67c4ddbd9ef42e1c0eb7c343";
  const userId = "67c5071c2f3f3c63306870b2";
  const otherUserId = "67c50a6da4d538066589c299";
  const token =
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtb2UxMTQ3IiwiaWF0IjoxNzQxMjA2NjA1LCJleHAiOjE3NDEyOTMwMDV9.4dSwRt_AmK-cvMvcGY-3c4wEZrNBBH2Ioyelx28LLJ8";

  // WebSocket connection and handlers
  const {
    connected,
    sendMessage,
    subscribeToDestination,
    connect,
    disconnect,
    error: wsError,
  } = useWebSocket();

  // Initialize connection and fetch initial data
  useEffect(() => {
    // Connect to WebSocket server using a secure WebSocket URL
    // connect("ws://localhost:8080/ws");

    // Fetch initial data
    fetchCurrentUser();
    fetchChannels();
    fetchDirectMessages();
    fetchUsers();

    // return () => {
    //   disconnect();
    // };
  }, []);

  useEffect(() => {
    if (connected) {
      // Create adapter functions to convert IMessage to required types
      const messageAdapter = (message: any) =>
        handleNewMessage(message as Message);
      const channelAdapter = (channel: any) =>
        handleChannelCreated(channel as Channel);
      const dmAdapter = (dm: any) =>
        //     handleDirectMessageCreated(dm as DirectMessage);
        //   const userAdapter = (user: any) => handleUserStatusChanged(user as User);

        subscribeToDestination("/topic/messages", messageAdapter);
      subscribeToDestination("/topic/channels", channelAdapter);
      subscribeToDestination("/topic/directMessages", dmAdapter);
      //   subscribeToDestination("/topic/userStatus", userAdapter);
    }
  }, [connected, subscribeToDestination]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.content);

        switch (data.type) {
          case "NEW_MESSAGE":
            handleNewMessage(data.payload);
            break;
          case "CHANNEL_CREATED":
            handleChannelCreated(data.payload);
            break;
          //   case "DIRECT_MESSAGE_CREATED":
          //     handleDirectMessageCreated(data.payload);
          //     break;
          case "USER_STATUS_CHANGED":
            handleUserStatusChanged(data.payload);
            break;
          default:
            console.log("Unknown message type:", data.type);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    }
  }, [lastMessage]);

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
      // Get the JWT token from localStorage or wherever you store it
      const token =
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtb2UxMTQ3IiwiaWF0IjoxNzQxMjA2NjA1LCJleHAiOjE3NDEyOTMwMDV9.4dSwRt_AmK-cvMvcGY-3c4wEZrNBBH2Ioyelx28LLJ8";

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
      // This assumes the API returns some user information for each DM
      // You might need to adjust this based on your actual API response
      const dmDisplays: DirectMessageDisplay[] = data.map((dm: any) => ({
        id: dm.channelId || dm.id,
        participant: users.find((u) => u.id === dm.receiverId) || {
          id: dm.receiverId,
          userName: dm.senderUsername, // Fallback if we don't have the full user object
          status: "OFFLINE",
          email: "",
          password: "",
          channelIds: [],
          directMessageIds: [],
          adminsForWhichChannels: [],
        },
        unreadCount: 0,
      }));

      setDirectMessages(data);
    } catch (error) {
      console.error("Error fetching direct messages:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("http://localhost:8080/api/users");
      const data = await handleApiResponse(response);
      console.log("Users:", data);
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
        !message.channelId &&
        message.isDirectMessage);

    if (isActiveConversation) {
      setMessages((prev) => [...prev, message]);
    } else {
      // Update unread count for non-active conversations
      if (message.channelId) {
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
            // Match DMs by sender ID
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

  //   const handleDirectMessageCreated = (dm: DirectMessage) => {
  //     // Create a DirectMessageDisplay from the new DirectMessage
  //     const participant = users.find((u) => u.id === dm.receiverId) || {
  //       id: dm.receiverId,
  //       userName: dm.senderUsername,
  //       status: "OFFLINE",
  //       email: "",
  //       password: "",
  //       channelIds: [],
  //       directMessageIds: [],
  //       adminsForWhichChannels: [],
  //     };

  //     const newDmDisplay: DirectMessageDisplay = {
  //       id: dm.channelId || `dm_${dm.senderId}_${dm.receiverId}`,
  //       participant,
  //       unreadCount: 0,
  //     };

  //     setDirectMessages((prev) => [...prev, newDmDisplay]);
  //   };

  const handleUserStatusChanged = (user: User) => {
    setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));

    // Also update the user in direct messages participant data
    setDirectMessages((prev) =>
      prev.map((dm) => {
        if (dm.participant.id === user.id) {
          return {
            ...dm,
            participant: {
              ...dm.participant,
              status: user.status,
            },
          };
        }
        return dm;
      })
    );
  };

  // User actions
  const handleSendMessage = (content: string) => {
    if (!currentUser || !activeConversationId) return;

    const messageData: Partial<Message> = {
      content,
      senderId: currentUser.id,
      timestamp: new Date(),
      isDirectMessage: !isActiveChannelConversation,
    };

    if (isActiveChannelConversation) {
      messageData.channelId = activeConversationId;
    }

    sendMessage("/app/chat.sendMessage", JSON.stringify(messageData));
  };

  const handleCreateChannel = async (name: string) => {
    if (!currentUser) return;

    try {
      const response = await fetch(
        `http://localhost:8080/api/channels/create-channel?userId=67c5071c2f3f3c63306870b2`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name,
          }),
        }
      );

      console.log("Channel created:", response);
      const data = await handleApiResponse(response);
      setChannels((prev) => [...prev, data]);
    } catch (error) {
      console.error("Error creating channel:", error);
    }

    setShowCreateChannel(false);
  };

  const handleCreateDirectMessage = async (recipientId: string) => {
    if (!currentUser) return;

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
            user1Id: currentUser.id, // Send flat key-value pairs
            user2Id: recipientId,
          }),
        }
      );

      console.log("Direct Message channel created:", response);
      const data = await handleApiResponse(response);
      setDirectMessages((prev) => [...prev, data]);
    } catch (error) {
      console.error("Error creating channel:", error);
    }
    setShowCreateDM(false);
  };

  const handleViewChannelInvite = (channel: Channel) => {
    setSelectedChannel(channel);
    setShowChannelInvite(true);
  };

  const handleConversationSelect = (id: string, isChannel: boolean) => {
    setActiveConversationId(id);
    setIsActiveChannelConversation(isChannel);
    setMessages([]);
    fetchMessages(id, isChannel);

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
            <MessageInput onSendMessageAction={handleSendMessage} />
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
          currentUserId={currentUser?.id || ""}
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
