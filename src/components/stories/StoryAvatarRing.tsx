"use client";

import StoryViewer from "@/components/stories/StoryViewer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { findStoryGroup, useStoriesFeed } from "@/hook/useStories";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Avatar with story ring — tap opens viewer for that user */
export default function StoryAvatarRing({
  userId,
  username,
  avatar,
  fullname: _fullname,
  className,
  sizeClassName = "size-24",
}: {
  userId: string;
  username: string;
  avatar?: string;
  fullname: string;
  className?: string;
  sizeClassName?: string;
}) {
  const { isAuthenticated, user } = useAuth();
  const { data } = useStoriesFeed(isAuthenticated);
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const group = findStoryGroup(data?.groups, { authorId: userId, username });
  const hasStories = (group?.stories.length ?? 0) > 0;
  const isOwn = user?._id === userId;
  const unseen = hasStories && (isOwn ? false : !!group?.hasUnseen);
  const showActiveRing = hasStories && (isOwn || unseen);
  const showSeenRing = hasStories && !isOwn && !unseen;

  const handleClick = () => {
    if (!hasStories) {
      if (isOwn) router.push("/stories/new");
      return;
    }
    setOpen(true);
  };

  const groups = data?.groups ?? [];
  const startIndex = group
    ? groups.findIndex((g) => g.author._id === group.author._id)
    : 0;

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={!hasStories && !isOwn}
        className={cn(
          "rounded-full p-[2.5px]",
          showActiveRing &&
            "bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]",
          showSeenRing && "bg-muted-foreground/40",
          !hasStories && "bg-transparent"
        )}
        aria-label={hasStories ? `View ${username}'s story` : undefined}
      >
        <span
          className={cn(
            "block rounded-full bg-background p-[3px]",
            !hasStories && "ring-1 ring-border"
          )}
        >
          <Avatar className={cn(sizeClassName, "rounded-full border-0")}>
            <AvatarImage src={avatar || undefined} className="object-cover" />
            <AvatarFallback />
          </Avatar>
        </span>
      </button>

      {isOwn && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            router.push("/stories/new");
          }}
          className="absolute bottom-1 end-1 z-10 grid size-7 place-items-center rounded-full border-[2.5px] border-background bg-sky-500 text-white shadow-sm transition-transform active:scale-90"
          aria-label="Add story"
        >
          <Plus className="size-3.5" strokeWidth={3} />
        </button>
      )}

      {open && hasStories && groups.length > 0 && (
        <StoryViewer
          groups={groups}
          startGroupIndex={Math.max(0, startIndex)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
