"use client";

import ConversationListItem from "@/components/chat/ConversationListItem";
import CreateGroupModal from "@/components/chat/CreateGroupModal";
import UserSearch from "@/components/chat/UserSearch";
import { Button } from "@/components/ui/button";
import { useConversations } from "@/hook/useChat";
import { cn } from "@/lib/utils";
import { Loader2, MessageCircle, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

type ConversationListPanelProps = {
  className?: string;
  /** Show sticky title bar (mobile list page / desktop aside) */
  showHeader?: boolean;
};

export default function ConversationListPanel({
  className,
  showHeader = true,
}: ConversationListPanelProps) {
  const pathname = usePathname();
  const { data: conversations = [], isLoading, isError } = useConversations();
  const [groupOpen, setGroupOpen] = useState(false);

  const activeId = pathname.startsWith("/messages/")
    ? pathname.split("/")[2]
    : null;

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {showHeader && (
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md">
          <h1 className="text-lg font-semibold tracking-tight">Messages</h1>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => setGroupOpen(true)}
          >
            <Users size={16} aria-hidden />
            New group
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <UserSearch />

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="px-4 py-10 text-center text-sm text-destructive">
            Failed to load conversations
          </p>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <MessageCircle className="size-10 text-muted-foreground/60" />
            <p className="font-medium">No conversations yet</p>
            <p className="text-sm text-muted-foreground">
              Search for a user above to start chatting, or create a group
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {conversations.map((c) => (
              <div
                key={c._id}
                className={cn(
                  activeId === c._id && "bg-muted/50"
                )}
              >
                <ConversationListItem conversation={c} />
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateGroupModal open={groupOpen} onClose={() => setGroupOpen(false)} />
    </div>
  );
}
