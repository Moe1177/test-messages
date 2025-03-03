"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/lib/types";
import { Search } from "lucide-react";

interface CreateDirectMessageDialogProps {
  users: User[];
  currentUserId: string;
  onCloseAction: () => void;
  onCreateDirectMessageAction: (userId: string) => void;
}

export function CreateDirectMessageDialog({
  users,
  currentUserId,
  onCloseAction,
  onCreateDirectMessageAction,
}: CreateDirectMessageDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = users.filter(
    (user) =>
      user.id !== currentUserId &&
      user.userName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={true} onOpenChange={onCloseAction}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        <div className="relative my-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Find a user"
            className="pl-8"
            value={searchQuery}
            onChange={(e: any) => setSearchQuery(e.target.value)}
          />
        </div>
        <ScrollArea className="h-[300px] pr-4">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <Button
                key={user.id}
                variant="ghost"
                className="w-full justify-start mb-1 p-2"
                onClick={() => onCreateDirectMessageAction(user.id)}
              >
                <div className="flex items-center w-full">
                  <span className="relative mr-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{user.userName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border border-background ${
                        user.status === "ONLINE"
                          ? "bg-green-500"
                          : "bg-gray-500"
                      }`}
                    />
                  </span>
                  <div className="ml-2">
                    <div className="font-medium">{user.userName}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.status === "ONLINE" ? "Online" : "Offline"}
                    </div>
                  </div>
                </div>
              </Button>
            ))
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No users found
            </div>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onCloseAction}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
