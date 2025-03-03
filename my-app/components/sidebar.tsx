import type { User, Channel, DirectMessage } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hash, Plus, Settings } from "lucide-react";

interface SidebarProps {
  channels: Channel[];
  directMessages: DirectMessage[];
  activeConversation: Channel | DirectMessage | null;
  onConversationSelect: (conversation: Channel | DirectMessage) => void;
  onCreateChannel: () => void;
  onCreateDirectMessage: () => void;
  onViewChannelInvite: (channel: Channel) => void;
  currentUser: User | null;
}

export function Sidebar({
  channels,
  directMessages,
  activeConversation,
  onConversationSelect,
  onCreateChannel,
  onCreateDirectMessage,
  onViewChannelInvite,
  currentUser,
}: SidebarProps) {
  return (
    <div className="w-64 flex-shrink-0 flex flex-col h-full bg-muted/20">
      <div className="p-3 flex items-center justify-between border-b">
        <div className="font-semibold">Workspace</div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="text-xs font-semibold text-muted-foreground">
              CHANNELS
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onCreateChannel}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center group">
              <Button
                variant={
                  activeConversation?.id === channel.id ? "secondary" : "ghost"
                }
                className="w-full justify-start mb-1 px-2 font-normal relative"
                onClick={() => onConversationSelect(channel)}
              >
                <Hash className="mr-2 h-4 w-4" />
                <span className="flex-1 truncate">{channel.name}</span>
                {channel.memberCount > 0 && (
                  <span className="text-xs text-muted-foreground ml-1">
                    {channel.memberCount}
                  </span>
                )}
                {channel.unreadCount > 0 && (
                  <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                    {channel.unreadCount}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onViewChannelInvite(channel)}
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          <div className="flex items-center justify-between px-2 py-1.5 mt-4">
            <div className="text-xs font-semibold text-muted-foreground">
              DIRECT MESSAGES
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onCreateDirectMessage}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {directMessages.map((dm) => (
            <Button
              key={dm.id}
              variant={activeConversation?.id === dm.id ? "secondary" : "ghost"}
              className="w-full justify-start mb-1 px-2 font-normal relative"
              onClick={() => onConversationSelect(dm)}
            >
              <span className="relative mr-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={dm.participant.avatar} />
                  <AvatarFallback>
                    {dm.participant.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border border-background ${
                    dm.participant.status === "online"
                      ? "bg-green-500"
                      : dm.participant.status === "away"
                      ? "bg-yellow-500"
                      : "bg-gray-500"
                  }`}
                />
              </span>
              <span className="flex-1 truncate">{dm.participant.name}</span>
              {dm.unreadCount > 0 && (
                <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                  {dm.unreadCount}
                </span>
              )}
            </Button>
          ))}
        </div>
      </ScrollArea>

      {currentUser && (
        <div className="p-3 border-t flex items-center">
          <Avatar className="h-8 w-8 mr-2">
            <AvatarImage src={currentUser.avatar} />
            <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 truncate">
            <div className="text-sm font-medium">{currentUser.name}</div>
            <div className="text-xs text-muted-foreground flex items-center">
              <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5"></span>
              Online
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
