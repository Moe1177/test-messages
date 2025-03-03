import type { Channel, DirectMessage } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Settings, Hash } from "lucide-react";

interface ConversationHeaderProps {
  conversation: Channel | DirectMessage;
  onViewChannelInvite?: () => void;
}

export function ConversationHeader({
  conversation,
  onViewChannelInvite,
}: ConversationHeaderProps) {
  const isChannel = conversation.type === "channel";
  const channel = isChannel ? (conversation as Channel) : null;
  const directMessage = !isChannel ? (conversation as DirectMessage) : null;

  return (
    <div className="h-14 border-b flex items-center justify-between px-4">
      <div className="flex items-center">
        {isChannel ? (
          <>
            <Hash className="h-5 w-5 mr-2" />
            <span className="font-medium">{channel?.name}</span>
            {channel?.memberCount !== undefined && (
              <span className="text-xs text-muted-foreground ml-2">
                {channel.memberCount} members
              </span>
            )}
          </>
        ) : (
          <>
            <span className="relative mr-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={directMessage?.participant.avatar} />
                <AvatarFallback>
                  {directMessage?.participant.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span
                className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border border-background ${
                  directMessage?.participant.status === "online"
                    ? "bg-green-500"
                    : directMessage?.participant.status === "away"
                    ? "bg-yellow-500"
                    : "bg-gray-500"
                }`}
              />
            </span>
            <span className="font-medium">
              {directMessage?.participant.name}
            </span>
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
