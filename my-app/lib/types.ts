export interface User {
  id: string;
  userName: string;
  email: string;
  password: string;
  channelIds: string[];
  directMessageIds: string[];
  adminsForWhichChannels: string[];
  status: "ONLINE" | "OFFLINE";
}

export interface Message {
  id: string;
  content: string;
  channelId?: string;
  timestamp: Date;
  isDirectMessage?: boolean;
  senderId: string;
}

export interface Channel {
  id: string;
  name: string;
  creatorId: string;
  inviteCode: string;
  memberIds: string[];
  directMessageMemberIds: string[];
}

export interface DirectMessage {
  content: string;
  senderId: string;
  senderUsername: string;
  channelId?: string;
  receiverId: string;
  isDirectMessage?: boolean;
  timestamp: Date;
}
