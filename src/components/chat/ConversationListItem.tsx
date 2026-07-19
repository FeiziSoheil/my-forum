"use client";

import Link from "next/link";
import { Conversation } from "@/types/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function formatPreviewTime(date: Date | string | null | undefined) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function displayTitle(conversation: Conversation) {
  if (conversation.type === "group") {
    return conversation.title || "Group";
  }
  const user = conversation.otherUser;
  return user?.fullname || user?.username || "Chat";
}

function lastMessagePreview(conversation: Conversation) {
  const last = conversation.lastMessage;
  if (!last) return "No messages yet";
  if (last.isDeleted) return "Message deleted";

  const body =
    last.type === "shared_post"
      ? "Shared a post"
      : last.type === "story_reply"
        ? last.content?.trim() || "Replied to a story"
        : last.content?.trim()
          ? last.content
          : last.media?.length
            ? last.media.some((m) => m.type === "video")
              ? "Video"
              : "Photo"
            : "Message";

  if (conversation.type !== "group") return body;

  const sender =
    typeof last.sender === "string"
      ? null
      : last.sender?.fullname || last.sender?.username;
  return sender ? `${sender.split(/\s+/)[0]}: ${body}` : body;
}

export default function ConversationListItem({
  conversation,
}: {
  conversation: Conversation;
}) {
  const isGroup = conversation.type === "group";
  const user = conversation.otherUser;
  const title = displayTitle(conversation);
  const preview = lastMessagePreview(conversation);
  const initial = title.slice(0, 1).toUpperCase();

  return (
    <Link
      href={`/messages/${conversation._id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
    >
      {isGroup ? (
        <div
          className="grid size-12 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold tracking-tight text-muted-foreground"
          aria-hidden
        >
          {initial}
        </div>
      ) : (
        <Avatar className="size-12">
          <AvatarImage src={user?.avatar || undefined} alt={user?.fullname} />
          <AvatarFallback>
            {(user?.fullname || user?.username || "?").slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-medium text-foreground">{title}</p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatPreviewTime(conversation.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm text-muted-foreground">{preview}</p>
          {conversation.unreadCount > 0 && (
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
