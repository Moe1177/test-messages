export interface User {
  id: string;
  name: string;
  avatar: string;
  status: "online" | "away" | "offline";
}

export interface Message {
  id: string;
  content: string;
  timestamp: Date;
  sender: User;
  channelId?: string;
  directMessageId?: string;
}

export interface Channel {
  id: string;
  name: string;
  type: "channel";
  unreadCount: number;
  memberCount: number;
  inviteCode: string;
}

export interface DirectMessage {
  id: string;
  type: "direct";
  participant: User;
  unreadCount: number;
}
