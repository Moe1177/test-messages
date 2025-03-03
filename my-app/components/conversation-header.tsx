import type { Channel, DirectMessage, User } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Settings, Hash } from "lucide-react";

interface ConversationHeaderProps {
  conversation: Channel | { receiverId: string; senderUsername: string };
  receiver?: User;
  onViewChannelInvite?: () => void;
}

export function ConversationHeader({
  conversation,
  receiver,
  onViewChannelInvite,
}: ConversationHeaderProps) {
  // Check if this is a channel by looking for the type property
  const isChannel = "type" in conversation && conversation.type === "GROUP";
  const channel = isChannel ? (conversation as Channel) : null;

  return (
    <div className="h-14 border-b flex items-center justify-between px-4">
      <div className="flex items-center">
        {isChannel ? (
          <>
            <Hash className="h-5 w-5 mr-2" />
            <span className="font-medium">{channel?.name}</span>
            {channel?.memberIds && (
              <span className="text-xs text-muted-foreground ml-2">
                {channel.memberIds.length} members
              </span>
            )}
          </>
        ) : (
          <>
            {receiver && (
              <>
                <span className="relative mr-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>
                      {receiver.userName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border border-background ${
                      receiver.status === "ONLINE"
                        ? "bg-green-500"
                        : "bg-gray-500"
                    }`}
                  />
                </span>
                <span className="font-medium">{receiver.userName}</span>
              </>
            )}
          </>
        )}
      </div>

      {isChannel && onViewChannelInvite && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onViewChannelInvite}
        >
          <Settings className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
