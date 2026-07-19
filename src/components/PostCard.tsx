'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ComposerTextarea } from '@/components/composer/ComposerTextarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  MoreHorizontal,
  File,
  Download,
  X,
  Maximize2,
  Pencil,
  Trash2,
  Loader2,
  Link2,
  MessageSquare,
  Bookmark,
  Pin,
  PinOff,
  Globe,
  Users,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { PostCardProps, MediaItem } from '@/types/post';

type Visibility = 'public' | 'followers' | 'private';

const VISIBILITY_OPTIONS: { value: Visibility; label: string; icon: typeof Globe }[] = [
  { value: 'public', label: 'Public', icon: Globe },
  { value: 'followers', label: 'Followers', icon: Users },
  { value: 'private', label: 'Only me', icon: Lock },
];
import { cn } from '@/lib/utils';
import { useTogglePostLike, useTogglePostRepost, useUpdatePost, useDeletePost, useTogglePostPin, useViewPost, useNotInterestedPost, useVotePoll } from '@/hook/usePosts';
import { useToggleBookmark } from '@/hook/useBookmarks';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import ShareToChatModal from '@/components/chat/ShareToChatModal';
import { renderRichText } from '@/components/RichText';
import { AnimatedCount } from '@/components/AnimatedCount';
import { InlineFollowButton } from '@/components/InlineFollowButton';
import { PostPoll } from '@/components/post/PostPoll';

/** Session-level guard so remounts / re-scroll don't re-hit the view API. */
const recordedPostViews = new Set<string>();

const VIEW_DWELL_MS = 1000;

function formatRelativeTime(date: Date | string) {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);

  if (sec < 60) return 'now';
  if (min < 60) return `${min}m`;
  if (hr < 24) return `${hr}h`;
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function PostCard({
  post,
  onLike,
  onReply,
  onRepost,
  onShare,
  onDeleted,
  showFollowButton = false,
}: PostCardProps) {
  const [fullViewMedia, setFullViewMedia] = useState<MediaItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editVisibility, setEditVisibility] = useState<Visibility>(
    post.visibility ?? 'public'
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [likeBurst, setLikeBurst] = useState(0);
  const [repostBurst, setRepostBurst] = useState(0);
  const [bookmarkBurst, setBookmarkBurst] = useState(0);
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const togglePostLike = useTogglePostLike();
  const togglePostRepost = useTogglePostRepost();
  const toggleBookmark = useToggleBookmark();
  const togglePin = useTogglePostPin();
  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();
  const viewPost = useViewPost();
  const notInterested = useNotInterestedPost();
  const votePoll = useVotePoll();
  const cardRef = useRef<HTMLElement>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOwner = !!user?._id && user._id === post.author?._id;
  const isLikingThis =
    togglePostLike.isPending && togglePostLike.variables?.postId === post._id;
  const isRepostingThis =
    togglePostRepost.isPending && togglePostRepost.variables?.postId === post._id;
  const isBookmarkingThis =
    toggleBookmark.isPending && toggleBookmark.variables?.postId === post._id;

  useEffect(() => {
    if (!isAuthenticated || isOwner || !post._id) return;
    if (recordedPostViews.has(post._id)) return;

    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const clearDwell = () => {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (recordedPostViews.has(post._id)) {
          observer.disconnect();
          return;
        }

        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (dwellTimerRef.current) return;
          dwellTimerRef.current = setTimeout(() => {
            dwellTimerRef.current = null;
            if (recordedPostViews.has(post._id)) return;
            recordedPostViews.add(post._id);
            viewPost.mutate(post._id);
            observer.disconnect();
          }, VIEW_DWELL_MS);
        } else {
          clearDwell();
        }
      },
      { threshold: [0, 0.5, 1] }
    );

    observer.observe(el);
    return () => {
      clearDwell();
      observer.disconnect();
    };
    // viewPost.mutate is stable from react-query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isOwner, post._id]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const openPost = () => router.push(`/post/${post._id}`);

  const handleStartEdit = () => {
    setEditContent(post.content);
    setEditVisibility(post.visibility ?? 'public');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(post.content);
    setEditVisibility(post.visibility ?? 'public');
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    const trimmed = editContent.trim();
    if (!trimmed && !post.poll) return;
    try {
      await updatePost.mutateAsync({
        postId: post._id,
        content: trimmed,
        visibility: editVisibility,
      });
      setIsEditing(false);
      toast.success('Post updated');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || 'Failed to update post');
    }
  };

  const handleVotePoll = (optionId: string) => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    if (votePoll.isPending && votePoll.variables?.postId === post._id) return;
    votePoll.mutate(
      { postId: post._id, optionId },
      {
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { error?: string } } };
          toast.error(e.response?.data?.error || 'Failed to vote');
        },
      }
    );
  };

  const handleChangeVisibility = async (visibility: Visibility) => {
    if (visibility === (post.visibility ?? 'public')) return;
    try {
      await updatePost.mutateAsync({ postId: post._id, visibility });
      toast.success('Visibility updated');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || 'Failed to update visibility');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deletePost.mutateAsync({ postId: post._id });
      toast.success('Post deleted');
      onDeleted?.(post._id);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || 'Failed to delete post');
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    if (isLikingThis) return;
    if (!post.isLiked) setLikeBurst((n) => n + 1);
    togglePostLike.mutate({ postId: post._id, isLiked: !!post.isLiked });
    onLike?.(post._id);
  };

  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    if (onReply) {
      onReply(post._id);
      return;
    }
    router.push(`/post/${post._id}/reply`);
  };

  const handleRepost = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    if (isRepostingThis) return;
    if (!post.isReposted) setRepostBurst((n) => n + 1);
    togglePostRepost.mutate({ postId: post._id, isReposted: !!post.isReposted });
    onRepost?.(post._id);
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    if (isBookmarkingThis) return;
    if (!post.isBookmarked) setBookmarkBurst((n) => n + 1);
    toggleBookmark.mutate({ postId: post._id, isBookmarked: !!post.isBookmarked });
  };

  const handleTogglePin = async () => {
    try {
      await togglePin.mutateAsync({ postId: post._id, isPinned: !!post.isPinned });
      toast.success(post.isPinned ? 'Post unpinned' : 'Post pinned to your profile');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || 'Failed to update pin');
    }
  };

  const postUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/post/${post._id}`
      : `/post/${post._id}`;

  const handleShareViaMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    setShareOpen(true);
    onShare?.(post._id);
  };

  const handleCopyLink = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(postUrl);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleNotInterested = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    if (isOwner) return;
    notInterested.mutate(post._id, {
      onSuccess: () => toast.success('We will show fewer posts like this'),
      onError: (err: unknown) => {
        const e = err as { response?: { data?: { error?: string } } };
        toast.error(e.response?.data?.error || 'Failed to save preference');
      },
    });
  };

  const handleFileDownload = (url: string, filename?: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFullView = (media: MediaItem) => {
    setFullViewMedia(media);
  };

  const closeFullView = () => {
    setFullViewMedia(null);
  };

  const renderMediaItem = (media: MediaItem, index: number) => {
    const isImage = media.type === 'image' || media.type === 'gif';
    const isVideo = media.type === 'video';
    const isFile = media.type === 'file';

    if (isImage) {
      return (
        <div
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border/60"
          onClick={(e) => { e.stopPropagation(); handleFullView(media); }}
        >
          <img
            src={media.url}
            alt={media.alt || `Media ${index + 1}`}
            className="max-h-[28rem] w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {media.type === 'gif' && (
            <div className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
              GIF
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
            <Maximize2 className="size-7 text-white drop-shadow" />
          </div>
        </div>
      );
    }

    if (isVideo) {
      return (
        <div
          className="group relative overflow-hidden rounded-2xl border border-border/60"
          onClick={stop}
        >
          <video
            src={media.url}
            controls
            className="max-h-[28rem] w-full object-cover"
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (isFile) {
      const fileName = media.url.split('/').pop() || 'Unknown file';
      const fileSize = media.size ? `${(media.size / 1024 / 1024).toFixed(2)} MB` : '';

      return (
        <div
          className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/40 p-3"
          onClick={stop}
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-background">
            <File className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
            {fileSize && <p className="text-xs text-muted-foreground">{fileSize}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleFileDownload(media.url, fileName)}
            className="size-9 rounded-full"
          >
            <Download className="size-4" />
          </Button>
        </div>
      );
    }

    return null;
  };

  const renderMedia = () => {
    if (!post.media || post.media.length === 0) {
      return null;
    }

    if (post.media.length === 1) {
      return <div className="mt-3">{renderMediaItem(post.media[0], 0)}</div>;
    }

    return (
      <div className="mt-3" onClick={stop}>
        <Swiper
          modules={[Pagination, Autoplay]}
          spaceBetween={10}
          slidesPerView={1}
          pagination={{ clickable: true }}
          autoplay={{ delay: 5000, disableOnInteraction: false }}
          className="overflow-hidden rounded-2xl"
        >
          {post.media.map((media, index) => (
            <SwiperSlide key={index}>{renderMediaItem(media, index)}</SwiperSlide>
          ))}
        </Swiper>
      </div>
    );
  };

  if (!post || !post.author) {
    return <div className="p-4 text-sm text-muted-foreground">Loading...</div>;
  }

  const authorName = post.author.fullname || 'Unknown';

  return (
    <article
      ref={cardRef}
      onClick={openPost}
      className="group/card cursor-pointer p-4 transition-colors hover:bg-muted/40"
    >
      {post.isPinned && (
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Pin className="size-3.5" />
          Pinned
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar
          className="size-10 shrink-0 cursor-pointer transition-transform hover:scale-105"
          onClick={(e) => { e.stopPropagation(); router.push(`/profile/${post.author.username}`); }}
        >
          <AvatarImage src={post.author.avatar} />
          <AvatarFallback />
        </Avatar>

        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              onClick={(e) => { e.stopPropagation(); router.push(`/profile/${post.author.username}`); }}
              className="truncate font-semibold leading-tight text-foreground hover:underline"
            >
              {authorName}
            </p>
            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
              <span
                onClick={(e) => { e.stopPropagation(); router.push(`/profile/${post.author.username}`); }}
                className="truncate hover:underline"
              >
                @{post.author.username}
              </span>
              <span aria-hidden>·</span>
              <span className="shrink-0">{formatRelativeTime(post.createdAt)}</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1" onClick={stop}>
            {showFollowButton && (
              <InlineFollowButton
                username={post.author.username}
                isFollowing={post.isFollowing}
                isRequested={post.isRequested}
              />
            )}
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="More"
                    className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleTogglePin}>
                    {post.isPinned ? (
                      <>
                        <PinOff className="size-4" />
                        Unpin from profile
                      </>
                    ) : (
                      <>
                        <Pin className="size-4" />
                        Pin to profile
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleStartEdit}>
                    <Pencil className="size-4" />
                    Edit
                  </DropdownMenuItem>
                  {VISIBILITY_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <DropdownMenuItem
                      key={value}
                      onClick={() => void handleChangeVisibility(value)}
                      disabled={(post.visibility ?? 'public') === value}
                    >
                      <Icon className="size-4" />
                      {(post.visibility ?? 'public') === value
                        ? `Visibility: ${label}`
                        : `Make ${label.toLowerCase()}`}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Content — the focal point (full width) */}
      {isEditing ? (
        <div className="mt-3" onClick={stop}>
          <ComposerTextarea
            value={editContent}
            onChange={setEditContent}
            rows={3}
            maxLength={500}
            autoFocus
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {VISIBILITY_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setEditVisibility(value)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  editVisibility === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input text-muted-foreground hover:bg-accent'
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {editContent.length} / 500
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                disabled={updatePost.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={
                  updatePost.isPending ||
                  (editContent.trim().length === 0 && !post.poll)
                }
              >
                {updatePost.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        post.content && (
          <p
            dir="auto"
            className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground"
          >
            {renderRichText(post.content)}
            {post.editedAt && (
              <span className="ml-1 text-xs text-muted-foreground">(edited)</span>
            )}
          </p>
        )
      )}

      {/* Media */}
      {renderMedia()}

      {post.poll && (
        <PostPoll
          poll={post.poll}
          myVoteOptionId={post.myVoteOptionId}
          onVote={handleVotePoll}
          disabled={!isAuthenticated}
          isVoting={
            votePoll.isPending && votePoll.variables?.postId === post._id
          }
        />
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center justify-between text-muted-foreground">
        <button
          onClick={handleReply}
          className="group/btn flex items-center gap-1.5 rounded-full py-1 text-sm transition-colors hover:text-primary"
        >
          <span className="grid size-8 place-items-center rounded-full transition-colors group-hover/btn:bg-primary/10">
            <MessageCircle className="size-[18px]" />
          </span>
          <AnimatedCount value={post.repliesCount} />
        </button>

        <button
          onClick={handleRepost}
          aria-pressed={!!post.isReposted}
          className={cn(
            'group/btn flex items-center gap-1.5 rounded-full py-1 text-sm transition-colors hover:text-green-500',
            post.isReposted && 'text-green-500'
          )}
        >
          <span className="grid size-8 place-items-center rounded-full transition-colors group-hover/btn:bg-green-500/10">
            <motion.span
              key={`repost-${repostBurst}`}
              initial={{ rotate: 0, scale: 1 }}
              animate={
                repostBurst > 0
                  ? { rotate: [0, -20, 20, 0], scale: [1, 1.25, 1] }
                  : { rotate: 0, scale: 1 }
              }
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex"
            >
              <Repeat2 className="size-[18px]" />
            </motion.span>
          </span>
          <AnimatedCount value={post.repostsCount} />
        </button>

        <button
          onClick={handleLike}
          aria-pressed={!!post.isLiked}
          className={cn(
            'group/btn flex items-center gap-1.5 rounded-full py-1 text-sm transition-colors hover:text-red-500',
            post.isLiked && 'text-red-500'
          )}
        >
          <span className="grid size-8 place-items-center rounded-full transition-colors group-hover/btn:bg-red-500/10">
            <motion.span
              key={`like-${likeBurst}`}
              initial={{ scale: 1 }}
              animate={
                likeBurst > 0
                  ? { scale: [1, 1.45, 0.9, 1.15, 1] }
                  : { scale: 1 }
              }
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex"
            >
              <Heart className={cn('size-[18px]', post.isLiked && 'fill-current')} />
            </motion.span>
          </span>
          <AnimatedCount value={post.likesCount} />
        </button>

        <span
          className="flex items-center gap-1.5 rounded-full py-1 text-sm"
          aria-label={`${post.viewsCount ?? 0} views`}
          onClick={stop}
        >
          <span className="grid size-8 place-items-center">
            <Eye className="size-[18px]" />
          </span>
          <AnimatedCount value={post.viewsCount ?? 0} />
        </span>

        <button
          onClick={handleBookmark}
          aria-label={post.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
          aria-pressed={!!post.isBookmarked}
          className={cn(
            'group/btn flex items-center rounded-full py-1 text-sm transition-colors hover:text-amber-500',
            post.isBookmarked && 'text-amber-500'
          )}
        >
          <span className="grid size-8 place-items-center rounded-full transition-colors group-hover/btn:bg-amber-500/10">
            <motion.span
              key={`bookmark-${bookmarkBurst}`}
              initial={{ y: 0, scale: 1 }}
              animate={
                bookmarkBurst > 0
                  ? { y: [0, -6, 0], scale: [1, 1.3, 1] }
                  : { y: 0, scale: 1 }
              }
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex"
            >
              <Bookmark className={cn('size-[18px]', post.isBookmarked && 'fill-current')} />
            </motion.span>
          </span>
        </button>

        <div onClick={stop} className="flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="group/btn flex items-center rounded-full transition-colors hover:text-blue-500"
                aria-label="Share"
              >
                <span className="grid size-8 place-items-center rounded-full transition-colors group-hover/btn:bg-blue-500/10">
                  <Send className="size-[18px]" />
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleShareViaMessage}>
                <MessageSquare className="size-4" />
                Send via message
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleCopyLink()}>
                <Link2 className="size-4" />
                Copy link
              </DropdownMenuItem>
              {isAuthenticated && !isOwner && (
                <DropdownMenuItem
                  onClick={handleNotInterested}
                  disabled={notInterested.isPending}
                >
                  <EyeOff className="size-4" />
                  Not interested
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ShareToChatModal
        postId={post._id}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />

      {/* Full View Modal */}
      {fullViewMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={(e) => { e.stopPropagation(); closeFullView(); }}
        >
          <div className="relative flex h-full max-h-full w-full max-w-7xl items-center justify-center">
            <button
              onClick={(e) => { e.stopPropagation(); closeFullView(); }}
              className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              <X className="size-6" />
            </button>

            <div className="flex h-full w-full items-center justify-center" onClick={stop}>
              {fullViewMedia.type === 'image' || fullViewMedia.type === 'gif' ? (
                <img
                  src={fullViewMedia.url}
                  alt={fullViewMedia.alt || 'Full view'}
                  className="max-h-full max-w-full object-contain"
                />
              ) : fullViewMedia.type === 'video' ? (
                <video src={fullViewMedia.url} controls autoPlay className="max-h-full max-w-full">
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="text-center text-white">
                  <File className="mx-auto mb-4 size-16" />
                  <p className="mb-2 text-lg">{fullViewMedia.url.split('/').pop()}</p>
                  <Button
                    onClick={() => handleFileDownload(fullViewMedia.url, fullViewMedia.url.split('/').pop())}
                    className="bg-white text-black hover:bg-gray-200"
                  >
                    <Download className="mr-2 size-4" />
                    Download
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
