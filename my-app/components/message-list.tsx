"use client";

import { useEffect, useRef } from "react";
import type { Message, User } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MessageListProps {
  messages: Message[];
  currentUser: User | null;
}

export function MessageList({ messages, currentUser }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
      return "Today";
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return messageDate.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
    }
  };

  // Group messages by date
  const groupedMessages: { [key: string]: Message[] } = {};
  messages.forEach((message) => {
    const dateKey = formatDate(message.timestamp);
    if (!groupedMessages[dateKey]) {
      groupedMessages[dateKey] = [];
    }
    groupedMessages[dateKey].push(message);
  });

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
      {Object.entries(groupedMessages).map(([date, dateMessages]) => (
        <div key={date}>
          <div className="flex items-center my-4">
            <div className="flex-grow h-px bg-border"></div>
            <div className="mx-4 text-xs font-medium text-muted-foreground">
              {date}
            </div>
            <div className="flex-grow h-px bg-border"></div>
          </div>

          {dateMessages.map((message, index) => {
            const isCurrentUser = message.sender.id === currentUser?.id;
            const showAvatar =
              index === 0 ||
              dateMessages[index - 1].sender.id !== message.sender.id;

            return (
              <div
                key={message.id}
                className={`flex items-start mb-4 ${
                  isCurrentUser ? "justify-end" : ""
                }`}
              >
                {!isCurrentUser && showAvatar && (
                  <Avatar className="h-8 w-8 mr-2 mt-0.5">
                    <AvatarImage src={message.sender.avatar} />
                    <AvatarFallback>
                      {message.sender.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                )}

                {!isCurrentUser && !showAvatar && <div className="w-8 mr-2" />}

                <div
                  className={`max-w-[70%] ${
                    isCurrentUser ? "order-2" : "order-1"
                  }`}
                >
                  {showAvatar && !isCurrentUser && (
                    <div className="flex items-center mb-1">
                      <span className="font-medium text-sm">
                        {message.sender.name}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  )}

                  <div className="relative">
                    <div
                      className={`px-3 py-2 rounded-lg ${
                        isCurrentUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.content}
                    </div>

                    {isCurrentUser && showAvatar && (
                      <div className="absolute right-0 top-0 text-xs text-muted-foreground -mt-5">
                        {formatTime(message.timestamp)}
                      </div>
                    )}
                  </div>
                </div>

                {isCurrentUser && showAvatar && (
                  <Avatar className="h-8 w-8 ml-2 mt-0.5 order-3">
                    <AvatarImage src={currentUser?.avatar} />
                    <AvatarFallback>
                      {currentUser?.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                )}

                {isCurrentUser && !showAvatar && (
                  <div className="w-8 ml-2 order-3" />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </ScrollArea>
  );
}
