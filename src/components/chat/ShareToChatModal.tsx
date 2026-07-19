"use client";

import { useEffect, useState } from "react";
import {
  useConversations,
  useSharePostToChat,
  useStartConversation,
  useUserSearch,
} from "@/hook/useChat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChatUser, Conversation } from "@/types/chat";

export default function ShareToChatModal({
  postId,
  open,
  onClose,
}: {
  postId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const { data: conversations = [], isLoading: loadingConvos } =
    useConversations(open);
  const { data: users = [], isFetching: searching } = useUserSearch(debounced);
  const startConversation = useStartConversation();
  const sharePost = useSharePostToChat();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sendToConversation = async (conversationId: string) => {
    try {
      await sharePost.mutateAsync({ conversationId, postId });
      toast.success("Post shared");
      onClose();
      router.push(`/messages/${conversationId}`);
    } catch {
      toast.error("Failed to share post");
    }
  };

  const sendToUser = async (user: ChatUser) => {
    try {
      const conversation = await startConversation.mutateAsync(user._id);
      await sharePost.mutateAsync({
        conversationId: conversation._id,
        postId,
      });
      toast.success("Post shared");
      onClose();
      router.push(`/messages/${conversation._id}`);
    } catch {
      toast.error("Failed to share post");
    }
  };

  const busy = sharePost.isPending || startConversation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Share via message"
    >
      <div
        className="flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-2xl border border-border/60 bg-background shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <h2 className="text-base font-semibold">Send via message</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative px-4 py-3">
          <Search
            size={16}
            className="pointer-events-none absolute start-7 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people..."
            className="rounded-full bg-muted/40 ps-9"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {debounced.length >= 1 ? (
            searching && users.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No users found
              </p>
            ) : (
              users.map((user) => (
                <UserRow
                  key={user._id}
                  user={user}
                  disabled={busy}
                  onSelect={() => void sendToUser(user)}
                />
              ))
            )
          ) : loadingConvos ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No conversations yet — search for someone above
            </p>
          ) : (
            <>
              <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                Recent chats
              </p>
              {conversations.map((c) => (
                <ConversationRow
                  key={c._id}
                  conversation={c}
                  disabled={busy}
                  onSelect={() => void sendToConversation(c._id)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function UserRow({
  user,
  disabled,
  onSelect,
}: {
  user: ChatUser;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-muted/50 disabled:opacity-50"
    >
      <Avatar className="size-10">
        <AvatarImage src={user.avatar || undefined} alt={user.fullname} />
        <AvatarFallback>
          {(user.fullname || user.username).slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{user.fullname}</p>
        <p className="truncate text-xs text-muted-foreground">
          @{user.username}
        </p>
      </div>
    </button>
  );
}

function ConversationRow({
  conversation,
  disabled,
  onSelect,
}: {
  conversation: Conversation;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const isGroup = conversation.type === "group";
  const user = conversation.otherUser;
  const title = isGroup
    ? conversation.title || "Group"
    : user?.fullname || user?.username || "Chat";
  const initial = title.slice(0, 1).toUpperCase();

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-muted/50 disabled:opacity-50"
    >
      {isGroup ? (
        <div
          className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
          aria-hidden
        >
          {initial}
        </div>
      ) : (
        <Avatar className="size-10">
          <AvatarImage src={user?.avatar || undefined} alt={user?.fullname} />
          <AvatarFallback>
            {(user?.fullname || user?.username || "?")
              .slice(0, 1)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        {isGroup ? (
          <p className="truncate text-xs text-muted-foreground">
            {conversation.memberCount
              ? `${conversation.memberCount} members`
              : "Group"}
          </p>
        ) : user?.username ? (
          <p className="truncate text-xs text-muted-foreground">
            @{user.username}
          </p>
        ) : null}
      </div>
    </button>
  );
}
