"use client";

import { chatThemeClasses } from "@/lib/chat/themes";
import { cn } from "@/lib/utils";
import { StorySnapshot } from "@/types/story";

export default function StoryReplyCard({
  snapshot,
  isMine,
}: {
  snapshot: StorySnapshot;
  isMine: boolean;
}) {
  const label = snapshot.content?.trim()
    ? snapshot.content.slice(0, 80) +
      (snapshot.content.length > 80 ? "…" : "")
    : snapshot.type === "image"
      ? "Photo"
      : snapshot.type === "video"
        ? "Video"
        : "Story";

  const showMediaThumb =
    (snapshot.type === "image" || snapshot.type === "video") &&
    !!snapshot.mediaUrl;

  return (
    <div
      className={cn(
        "mb-1 flex overflow-hidden rounded-xl border text-start",
        isMine
          ? cn(chatThemeClasses.mineSoftBorder, chatThemeClasses.mineSoftBg)
          : "border-border/50 bg-background/50"
      )}
    >
      {showMediaThumb ? (
        <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-muted/40">
          {snapshot.type === "video" ? (
            <video
              src={snapshot.mediaUrl!}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={snapshot.mediaUrl!}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </div>
      ) : (
        <div
          className="flex h-16 w-12 shrink-0 items-center justify-center px-1 text-center text-[9px] font-medium leading-tight text-white"
          style={{ backgroundColor: snapshot.backgroundColor || "#1a1a2e" }}
        >
          <span className="line-clamp-3">{snapshot.content?.slice(0, 40)}</span>
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-0.5 px-2.5 py-2">
        <p
          className={cn(
            "text-[11px] font-medium",
            isMine ? chatThemeClasses.mineFg75 : "text-muted-foreground"
          )}
        >
          Replied to @{snapshot.authorUsername}&apos;s story
        </p>
        <p
          className={cn(
            "line-clamp-2 text-[13px] leading-snug",
            isMine ? chatThemeClasses.mineFg70 : "text-foreground/80"
          )}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
