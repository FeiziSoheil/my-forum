"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import {
  useDeleteStory,
  useLikeStory,
  useReplyToStory,
  useStoryViewers,
  useViewStory,
} from "@/hook/useStories";
import { cn } from "@/lib/utils";
import { Story, StoryGroup } from "@/types/story";
import {
  Eye,
  Heart,
  Loader2,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const STORY_DURATION_MS = 5000;

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function StorySlide({
  story,
  videoRef,
}: {
  story: Story;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const media = story.media?.[0];

  if (story.type === "video" && media?.url) {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-black">
        <video
          ref={videoRef}
          src={media.url}
          className="max-h-full max-w-full object-contain"
          playsInline
          autoPlay
          muted
          preload="auto"
        />
        {story.content ? (
          <p className="absolute inset-x-0 bottom-24 px-4 text-center text-base font-medium text-white drop-shadow-md">
            {story.content}
          </p>
        ) : null}
      </div>
    );
  }

  if (story.type === "image" && media?.url) {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.url}
          alt=""
          className="max-h-full max-w-full object-contain"
        />
        {story.content ? (
          <p className="absolute inset-x-0 bottom-24 px-4 text-center text-base font-medium text-white drop-shadow-md">
            {story.content}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-full items-center justify-center px-8"
      style={{ backgroundColor: story.backgroundColor || "#1a1a2e" }}
    >
      <p className="text-center text-2xl font-semibold leading-snug text-white whitespace-pre-wrap break-words">
        {story.content}
      </p>
    </div>
  );
}

export default function StoryViewer({
  groups,
  startGroupIndex = 0,
  startStoryIndex = 0,
  onClose,
}: {
  groups: StoryGroup[];
  startGroupIndex?: number;
  startStoryIndex?: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [storyIndex, setStoryIndex] = useState(startStoryIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showViewers, setShowViewers] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pauseRef = useRef(false);
  const showViewersRef = useRef(false);
  const goNextRef = useRef<() => void>(() => {});
  const advancingRef = useRef(false);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHoldRef = useRef(false);

  const likeStory = useLikeStory();
  const viewStory = useViewStory();
  const deleteStory = useDeleteStory();
  const replyToStory = useReplyToStory();

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];
  const isOwn = !!user && group?.author._id === user._id;
  const isVideo = story?.type === "video";

  const { data: viewersData, isLoading: viewersLoading } = useStoryViewers(
    story?._id ?? null,
    showViewers && isOwn
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const goNext = useCallback(() => {
    if (!group || advancingRef.current) return;
    advancingRef.current = true;
    setProgress(0);

    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1);
      return;
    }
    if (groupIndex < groups.length - 1) {
      setGroupIndex((i) => i + 1);
      setStoryIndex(0);
      return;
    }
    advancingRef.current = false;
    onClose();
  }, [group, storyIndex, groupIndex, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (advancingRef.current) return;
    setProgress(0);
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
      return;
    }
    if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1];
      setGroupIndex((i) => i - 1);
      setStoryIndex(Math.max(0, (prevGroup?.stories.length ?? 1) - 1));
    }
  }, [storyIndex, groupIndex, groups]);

  // Allow the next auto-advance after the active story identity changes.
  useEffect(() => {
    advancingRef.current = false;
    setProgress(0);
  }, [story?._id]);

  useEffect(() => {
    pauseRef.current = paused;
  }, [paused]);

  useEffect(() => {
    showViewersRef.current = showViewers;
  }, [showViewers]);

  useEffect(() => {
    goNextRef.current = goNext;
  }, [goNext]);

  useEffect(() => {
    if (!story?._id || isOwn) return;
    viewStory.mutate(story._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?._id, isOwn]);

  // Restart video playback whenever the active story changes.
  useEffect(() => {
    if (!isVideo) return;
    const video = videoRef.current;
    if (!video) return;
    try {
      video.currentTime = 0;
    } catch {
      // ignore: metadata may not be ready yet
    }
    video.play().catch(() => {});
  }, [story?._id, isVideo]);

  // Keep video playback in sync with pause / viewers-sheet state.
  useEffect(() => {
    if (!isVideo) return;
    const video = videoRef.current;
    if (!video) return;
    if (paused || showViewers) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [paused, showViewers, isVideo, story?._id]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let progressValue = 0;
    let finished = false;

    const finish = () => {
      if (finished || advancingRef.current) return;
      finished = true;
      progressValue = 100;
      setProgress(100);
      queueMicrotask(() => goNextRef.current());
    };

    const loop = (now: number) => {
      const dt = Math.min(now - last, 100); // clamp huge gaps (tab background)
      last = now;

      if (!finished && !pauseRef.current && !showViewersRef.current) {
        const video = videoRef.current;
        const videoDuration = video?.duration;

        if (
          isVideo &&
          video &&
          videoDuration &&
          Number.isFinite(videoDuration) &&
          videoDuration > 0
        ) {
          progressValue = Math.min(
            100,
            (video.currentTime / videoDuration) * 100
          );
          setProgress(progressValue);
          if (video.ended || progressValue >= 99.5) {
            finish();
          }
        } else {
          progressValue += (dt / STORY_DURATION_MS) * 100;
          if (progressValue >= 100) {
            finish();
          } else {
            setProgress(progressValue);
          }
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      finished = true;
      cancelAnimationFrame(raf);
    };
  }, [story?._id, isVideo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const onNavPointerDown = () => {
    didHoldRef.current = false;
    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => {
      didHoldRef.current = true;
      setPaused(true);
    }, 150);
  };

  const onNavPointerUp = () => {
    clearHoldTimer();
    if (didHoldRef.current) {
      setPaused(false);
      didHoldRef.current = false;
    }
  };

  const handlePrevClick = () => {
    if (didHoldRef.current) return;
    goPrev();
  };

  const handleNextClick = () => {
    if (didHoldRef.current) return;
    goNext();
  };

  const handleLike = () => {
    if (!story || isOwn) return;
    likeStory.mutate({ storyId: story._id, isLiked: !!story.isLiked });
  };

  const handleDelete = async () => {
    if (!story || !isOwn) return;
    await deleteStory.mutateAsync(story._id);
    if (group.stories.length <= 1) {
      if (groups.length <= 1) onClose();
      else goNext();
    } else if (storyIndex >= group.stories.length - 1) {
      setStoryIndex(Math.max(0, storyIndex - 1));
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!story || isOwn || !replyText.trim()) return;
    await replyToStory.mutateAsync({
      storyId: story._id,
      content: replyText.trim(),
    });
    setReplyText("");
  };

  if (!mounted || !group || !story) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95">
      <div className="relative flex h-full w-full max-w-lg flex-col sm:h-[min(100%,820px)] sm:max-h-[95vh] sm:overflow-hidden sm:rounded-2xl">
        {/* Progress */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-2 pt-2">
          {group.stories.map((s, i) => {
            const fill =
              i < storyIndex ? 1 : i === storyIndex ? progress / 100 : 0;
            return (
              <div
                key={s._id}
                className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/35"
              >
                <div
                  className="h-full w-full origin-left bg-white will-change-transform"
                  style={{
                    transform: `scaleX(${fill})`,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Header */}
        <div className="absolute inset-x-0 top-3 z-20 flex items-center gap-2 px-3 pt-2">
          <Avatar className="size-9 border border-white/20">
            <AvatarImage src={group.author.avatar || undefined} />
            <AvatarFallback className="text-xs">
              {initials(group.author.fullname || group.author.username)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {group.author.username}
            </p>
          </div>
          {isOwn && (
            <button
              type="button"
              onClick={handleDelete}
              className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/10"
              aria-label="Delete story"
            >
              <Trash2 className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/10"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Slide + tap zones */}
        <div className="relative min-h-0 flex-1">
          <StorySlide story={story} videoRef={videoRef} />
          <button
            type="button"
            className="absolute inset-y-0 start-0 z-10 w-1/3"
            aria-label="Previous"
            onClick={handlePrevClick}
            onPointerDown={onNavPointerDown}
            onPointerUp={onNavPointerUp}
            onPointerCancel={onNavPointerUp}
            onPointerLeave={onNavPointerUp}
          />
          <button
            type="button"
            className="absolute inset-y-0 end-0 z-10 w-1/3"
            aria-label="Next"
            onClick={handleNextClick}
            onPointerDown={onNavPointerDown}
            onPointerUp={onNavPointerUp}
            onPointerCancel={onNavPointerUp}
            onPointerLeave={onNavPointerUp}
          />
        </div>

        {/* Footer */}
        <div className="absolute inset-x-0 bottom-0 z-20 space-y-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-5 pt-10">
          {isOwn ? (
            <button
              type="button"
              onClick={() => {
                setShowViewers(true);
                setPaused(true);
              }}
              className="flex items-center gap-2 text-sm text-white/90"
            >
              <Eye className="size-4" />
              {story.viewsCount} {story.viewsCount === 1 ? "view" : "views"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <form
                onSubmit={handleReply}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/25 bg-black/30 px-3 py-1.5 backdrop-blur-sm"
              >
                <input
                  ref={replyInputRef}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => setPaused(true)}
                  onBlur={() => {
                    if (!replyText) setPaused(false);
                  }}
                  placeholder="Send message…"
                  className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/50 outline-none"
                  maxLength={2000}
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || replyToStory.isPending}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-white disabled:opacity-40"
                  aria-label="Send reply"
                >
                  {replyToStory.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </button>
              </form>
              <button
                type="button"
                onClick={handleLike}
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur-sm",
                  story.isLiked && "text-rose-400"
                )}
                aria-label={story.isLiked ? "Unlike" : "Like"}
              >
                <Heart
                  className="size-5"
                  fill={story.isLiked ? "currentColor" : "none"}
                />
              </button>
            </div>
          )}
        </div>

        {/* Viewers sheet */}
        {showViewers && (
          <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/50">
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Close viewers"
              onClick={() => {
                setShowViewers(false);
                setPaused(false);
              }}
            />
            <div className="relative max-h-[50%] overflow-y-auto rounded-t-2xl bg-background px-4 pb-6 pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" />
              <p className="mb-3 text-sm font-semibold">
                Viewers · {viewersData?.viewsCount ?? story.viewsCount}
              </p>
              {viewersLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : (viewersData?.viewers.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No views yet
                </p>
              ) : (
                <ul className="space-y-2">
                  {viewersData!.viewers.map((v) => (
                    <li key={v._id} className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarImage src={v.avatar || undefined} />
                        <AvatarFallback className="text-xs">
                          {initials(v.fullname || v.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {v.fullname}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          @{v.username}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
