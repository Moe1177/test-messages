"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { Sidebar } from "./sidebar";
import { ConversationHeader } from "./conversation-header";
import type { User, Message, Channel, WebSocketMessage } from "@/lib/types";
import useChat from "@/lib/use-websocket";
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
  const userId = "67c5071c2f3f3c63306870b2";

  const receipientId = "67cb641d1ab64f63672e5ad2";

  const token =
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtb2UxMTQ3IiwiaWF0IjoxNzQxNTc5ODY1LCJleHAiOjE3NDE2NjYyNjV9.EbRGv-Se4WXMXoOUhzijewsBEG1MdNuO04BAf-DUalI";

  const { messages, sendGroupMessage, sendDirectMessage, setInitialMessages } = useChat(
    activeConversationId as string,
    userId,
    token
  );

  // Initialize connection and fetch initial data
  useEffect(() => {
    // Fetch initial data
    fetchCurrentUser();
    fetchChannels();
    fetchDirectMessages();
    fetchUsers();
  }, []);

  // Subscribe to active conversation when it changes
  useEffect(() => {
    if (!activeConversationId) return;
    console.log(
      `Subscribing to ${
        isActiveChannelConversation ? "channel" : "DM"
      }: ${activeConversationId}`
    );
  }, [activeConversationId, isActiveChannelConversation]);

  // Create a map of users for easy lookup
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

  // Handle sending messages
  const handleSendMessage = (content: string) => {
    if (!activeConversationId) {
      console.error("No active conversation selected");
      return;
    }

    if (isActiveChannelConversation) {
      sendGroupMessage(content);
    } else {
      sendDirectMessage(content, receipientId);
    }
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
        "https://soen341-deployement-latest.onrender.com/api/users/currentUser",
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
        `https://soen341-deployement-latest.onrender.com/api/channels/user/${userId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
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
        `https://soen341-deployement-latest.onrender.com/api/channels/direct-message/${userId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
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
            id: otherMemberId || "", // Fallback to hardcoded ID
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
      const response = await fetch(
        "https://soen341-deployement-latest.onrender.com/api/users",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await handleApiResponse(response);
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchMessages = async (conversationId: string, isChannel: boolean) => {
    try {
      if (!conversationId) return;

      const endpoint = `https://soen341-deployement-latest.onrender.com/api/messages/channel/${conversationId}`;

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await handleApiResponse(response);

      // Convert timestamps to Date objects
      const formattedMessages = data.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));

      console.log(
        `Fetched messages for ${
          isChannel ? "channel" : "DM"
        } ${conversationId}:`,
        formattedMessages
      );

      // ✅ No need to update `setMessages` manually – `useChat` handles this.
      // Merge historical messages into useChat state.
      setInitialMessages(formattedMessages);
    } catch (error) {
      console.error(
        `Error fetching messages for ${
          isChannel ? "channel" : "direct message"
        } ${conversationId}:`,
        error
      );
    }
  };

  const handleCreateChannel = async (name: string) => {
    try {
      const response = await fetch(
        `https://soen341-deployement-latest.onrender.com/api/channels/create-channel?userId=${userId}`,
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
        `https://soen341-deployement-latest.onrender.com/api/channels/direct-message`,
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

      // Important: Select the new DM conversation after creating it
      // This ensures proper subscription setup before sending messages
      handleConversationSelect(data.id, false);

      // Added console log for debugging
      console.log(`Created new DM channel with ID: ${data.id}`);

      // Return the new DM ID for potential use
      return data.id;
    } catch (error) {
      console.error("Error creating direct message:", error);
      return null;
    } finally {
      setShowCreateDM(false);
    }
  };

  const handleViewChannelInvite = (channel: Channel) => {
    setSelectedChannel(channel);
    setShowChannelInvite(true);
  };

 const handleConversationSelect = (
   conversationId: string,
   isChannel: boolean
 ) => {
   if (!conversationId || activeConversationId === conversationId) return;

   console.log(
     `Switching to ${
       isChannel ? "channel" : "direct message"
     }: ${conversationId}`
   );

   // Update the active conversation and type
   setActiveConversationId(conversationId);
   setIsActiveChannelConversation(isChannel);

   // Fetch historical messages for the new conversation.
   fetchMessages(conversationId, isChannel);
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
      {/* Sidebar Navigation */}
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
              messages={messages} // messages now include historical messages merged with new ones
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
          currentUserId={userId}
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
