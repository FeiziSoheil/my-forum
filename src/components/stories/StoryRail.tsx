"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { useStoriesFeed } from "@/hook/useStories";
import { cn } from "@/lib/utils";
import { StoryGroup } from "@/types/story";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import StoryViewer from "./StoryViewer";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function RingButton({
  group,
  isOwn,
  onView,
  onAdd,
}: {
  group?: StoryGroup;
  isOwn?: boolean;
  onView: () => void;
  onAdd?: () => void;
}) {
  const hasStories = (group?.stories.length ?? 0) > 0;
  const unseen = group?.hasUnseen ?? false;
  const author = group?.author;
  // Own active stories keep a vivid ring (Instagram-style); others fade when seen
  const showActiveRing = hasStories && (isOwn || unseen);
  const showSeenRing = hasStories && !isOwn && !unseen;

  return (
    <div className="flex w-[74px] shrink-0 flex-col items-center gap-2">
      <div className="relative">
        <div
          className={cn(
            "rounded-full p-[2px]",
            showActiveRing &&
              "bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]",
            showSeenRing && "bg-muted-foreground/40",
            !hasStories && "bg-transparent"
          )}
        >
          <button
            type="button"
            onClick={onView}
            className={cn(
              "block rounded-full bg-background p-[2.5px]",
              !hasStories && "ring-1 ring-border"
            )}
            aria-label={
              isOwn
                ? hasStories
                  ? "View your story"
                  : "Add story"
                : `View ${author?.username ?? "user"}'s story`
            }
          >
            <Avatar className="size-[58px]">
              <AvatarImage
                src={author?.avatar || undefined}
                className="object-cover"
              />
              <AvatarFallback className="text-sm">
                {author ? initials(author.fullname || author.username) : "?"}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>

        {isOwn && onAdd && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="absolute -bottom-0.5 -end-0.5 z-10 grid size-[22px] place-items-center rounded-full border-[2.5px] border-background bg-sky-500 text-white shadow-sm transition-transform active:scale-90"
            aria-label="Add story"
          >
            <Plus className="size-3" strokeWidth={3} />
          </button>
        )}
      </div>
      <span className="w-full truncate px-0.5 text-center text-[11px] leading-tight text-foreground/80">
        {isOwn ? "Your story" : author?.username ?? ""}
      </span>
    </div>
  );
}

export default function StoryRail() {
  const { user, isAuthenticated } = useAuth();
  const { data, isLoading } = useStoriesFeed(isAuthenticated);
  const router = useRouter();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [startGroupIndex, setStartGroupIndex] = useState(0);

  const groups = data?.groups ?? [];
  const ownGroup = user
    ? groups.find((g) => g.author._id === user._id)
    : undefined;
  const otherGroups = user
    ? groups.filter((g) => g.author._id !== user._id)
    : groups;

  const openViewer = (groupIndex: number) => {
    setStartGroupIndex(groupIndex);
    setViewerOpen(true);
  };

  const goToComposer = () => {
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    router.push("/stories/new");
  };

  const handleOwnView = () => {
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    if (ownGroup && ownGroup.stories.length > 0) {
      const idx = groups.findIndex((g) => g.author._id === user?._id);
      openViewer(Math.max(0, idx));
      return;
    }
    goToComposer();
  };

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="-mx-4 mb-3 flex gap-3 overflow-hidden border-b border-border/40 px-4 pb-3 pt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex w-[74px] shrink-0 flex-col items-center gap-2">
            <div className="size-[64px] animate-pulse rounded-full bg-muted" />
            <div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="-mx-4 mb-3 flex gap-3 overflow-x-auto border-b border-border/40 px-4 pb-3 pt-4 scrollbar-none">
        <RingButton
          group={
            ownGroup ??
            (user?._id
              ? {
                  author: {
                    _id: user._id,
                    username: user.username,
                    fullname: user.fullname,
                    avatar: user.avatar,
                  },
                  stories: [],
                  hasUnseen: false,
                  latestAt: new Date(),
                }
              : undefined)
          }
          isOwn
          onView={handleOwnView}
          onAdd={goToComposer}
        />

        {otherGroups.map((group) => {
          const idx = groups.findIndex((g) => g.author._id === group.author._id);
          return (
            <RingButton
              key={group.author._id}
              group={group}
              onView={() => openViewer(idx)}
            />
          );
        })}

        {groups.length === 0 && (
          <Link
            href="/stories/new"
            className="flex w-[72px] shrink-0 flex-col items-center justify-center gap-1 text-muted-foreground"
          >
            <span className="text-[11px] leading-tight text-center">
              Add your first story
            </span>
          </Link>
        )}
      </div>

      {viewerOpen && groups.length > 0 && (
        <StoryViewer
          groups={groups}
          startGroupIndex={startGroupIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
