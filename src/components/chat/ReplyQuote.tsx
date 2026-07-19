"use client";

import { chatThemeClasses } from "@/lib/chat/themes";
import { cn } from "@/lib/utils";
import { ChatUser, ReplyPreview } from "@/types/chat";

function senderLabel(sender: ChatUser | string | undefined) {
  if (!sender) return "Unknown";
  if (typeof sender === "string") return "Message";
  return sender.fullname || sender.username || "Unknown";
}

export function replySnippet(reply: ReplyPreview) {
  if (reply.isDeleted) return "Message deleted";
  if (reply.type === "shared_post") {
    const post =
      reply.sharedPost && typeof reply.sharedPost !== "string"
        ? reply.sharedPost
        : null;
    if (post?.content) {
      return post.content.slice(0, 80) + (post.content.length > 80 ? "…" : "");
    }
    return "Shared a post";
  }
  if (reply.type === "story_reply") {
    const snap = reply.storySnapshot;
    if (reply.content?.trim()) return reply.content.trim().slice(0, 80);
    if (snap?.content) return snap.content.slice(0, 80);
    return "Replied to a story";
  }
  if (reply.type === "image" || (reply.media && reply.media.length > 0)) {
    const hasVideo = reply.media?.some((m) => m.type === "video");
    return reply.content?.trim() || (hasVideo ? "Video" : "Photo");
  }
  return reply.content?.trim() || "Message";
}

export default function ReplyQuote({
  reply,
  isMine,
  onJump,
}: {
  reply: ReplyPreview;
  isMine: boolean;
  onJump?: (messageId: string) => void;
}) {
  const interactive = !!onJump && !!reply._id;

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={(e) => {
        e.stopPropagation();
        if (reply._id) onJump?.(reply._id);
      }}
      className={cn(
        "mb-1 flex w-full max-w-full gap-2 rounded-lg px-2 py-1.5 text-start transition-colors duration-150",
        interactive && "cursor-pointer hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        !interactive && "cursor-default",
        isMine ? chatThemeClasses.mineSoftBg : chatThemeClasses.theirsSoftBg
      )}
      aria-label={
        interactive
          ? `Jump to reply from ${senderLabel(reply.sender)}`
          : undefined
      }
    >
      <span
        className={cn(
          "w-0.5 shrink-0 self-stretch rounded-full",
          isMine ? chatThemeClasses.mineBar : "bg-[var(--chat-accent)]"
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[13px] font-semibold leading-tight",
            isMine ? chatThemeClasses.mineFg90 : chatThemeClasses.accentText
          )}
        >
          {senderLabel(reply.sender)}
        </span>
        <span
          className={cn(
            "mt-0.5 block line-clamp-2 text-[13px] leading-snug",
            isMine
              ? chatThemeClasses.mineFg65
              : "text-muted-foreground"
          )}
        >
          {replySnippet(reply)}
        </span>
      </span>
    </button>
  );
}
