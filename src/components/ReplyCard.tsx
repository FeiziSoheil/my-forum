'use client';

import React, { useState } from 'react';
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
  Send,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2
} from 'lucide-react';
import { ReplyCardProps } from '@/types/post';
import { cn } from '@/lib/utils';
import { useToggleReplyLike, useUpdateReply, useDeleteReply } from '@/hook/useReplies';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { renderRichText } from '@/components/RichText';
import { MAX_THREAD_LEVEL } from '@/lib/replies/constants';
import { AnimatedCount } from '@/components/AnimatedCount';
import { InlineFollowButton } from '@/components/InlineFollowButton';

export function ReplyCard({
  reply,
  onLike,
  onReply,
  onShare,
  canNestReply,
  showFollowButton = false,
}: ReplyCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);
  const [likeBurst, setLikeBurst] = useState(0);
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const toggleReplyLike = useToggleReplyLike(reply.parentPost);
  const updateReply = useUpdateReply(reply.parentPost);
  const deleteReply = useDeleteReply(reply.parentPost);

  const isOwner = !!user?._id && user._id === reply.author?._id;
  const threadLevel = Math.min(reply.threadLevel ?? 0, MAX_THREAD_LEVEL);
  const allowNest = canNestReply ?? threadLevel < MAX_THREAD_LEVEL;
  const isLikingThis =
    toggleReplyLike.isPending && toggleReplyLike.variables?.replyId === reply._id;

  const parentAuthor =
    reply.parentReply && typeof reply.parentReply === 'object'
      ? reply.parentReply.author
      : null;

  const handleLike = () => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    if (isLikingThis) return;
    if (!reply.isLiked) setLikeBurst((n) => n + 1);
    toggleReplyLike.mutate({ replyId: reply._id, isLiked: !!reply.isLiked });
    onLike?.(reply._id);
  };

  const handleReply = () => {
    if (!allowNest) {
      toast.error(`Replies can only nest up to ${MAX_THREAD_LEVEL} levels.`);
      return;
    }
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    onReply?.(reply);
  };

  const handleShare = () => {
    onShare?.(reply._id);
  };

  const handleStartEdit = () => {
    setEditContent(reply.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(reply.content);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    try {
      await updateReply.mutateAsync({ replyId: reply._id, content: trimmed });
      setIsEditing(false);
      toast.success('Reply updated');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || 'Failed to update reply');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this reply?')) return;
    try {
      await deleteReply.mutateAsync({ replyId: reply._id });
      toast.success('Reply deleted');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || 'Failed to delete reply');
    }
  };

  if (!reply || !reply.author) {
    return null;
  }

  const authorName = reply.author.fullname || reply.author.name || 'Unknown';

  return (
    <div
      className={cn(
        'relative border-b border-border p-4 hover:bg-muted/50 transition-colors',
        threadLevel > 0 && 'pl-4'
      )}
      style={threadLevel > 0 ? { paddingLeft: `${16 + threadLevel * 20}px` } : undefined}
    >
      {threadLevel > 0 && (
        <div
          aria-hidden
          className="absolute top-0 bottom-0 w-0.5 bg-border"
          style={{ left: `${8 + (threadLevel - 1) * 20}px` }}
        />
      )}

      <div className="flex gap-3">
        <Avatar
          className="w-10 h-10 cursor-pointer transition-transform hover:scale-105 shrink-0"
          onClick={() => router.push(`/profile/${reply.author.username}`)}
        >
          <AvatarImage src={reply.author.avatar} />
          <AvatarFallback />
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                onClick={() => router.push(`/profile/${reply.author.username}`)}
                className="cursor-pointer truncate font-semibold leading-tight text-foreground hover:underline"
              >
                {authorName}
              </p>
              <p
                onClick={() => router.push(`/profile/${reply.author.username}`)}
                className="mt-0.5 cursor-pointer truncate text-sm text-muted-foreground hover:underline"
              >
                @{reply.author.username}
              </p>
              {parentAuthor && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Replying to{' '}
                  <button
                    type="button"
                    onClick={() => router.push(`/profile/${parentAuthor.username}`)}
                    className="text-primary hover:underline"
                  >
                    @{parentAuthor.username}
                  </button>
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {showFollowButton && (
                <InlineFollowButton
                  username={reply.author.username}
                  isFollowing={reply.isFollowing}
                  isRequested={reply.isRequested}
                />
              )}
              {isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleStartEdit}>
                      <Pencil className="w-4 h-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Reply Content */}
          {isEditing ? (
            <div className="mb-3">
              <ComposerTextarea
                value={editContent}
                onChange={setEditContent}
                rows={3}
                maxLength={500}
                autoFocus
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {editContent.length} / 500
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={updateReply.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={updateReply.isPending || editContent.trim().length === 0}
                  >
                    {updateReply.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
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
            <p dir="auto" className="text-foreground mb-3 whitespace-pre-wrap">
              {renderRichText(reply.content)}
              {reply.editedAt && (
                <span className="ml-1 text-xs text-muted-foreground">(edited)</span>
              )}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReply}
              disabled={!allowNest}
              title={!allowNest ? `Max nesting depth (${MAX_THREAD_LEVEL}) reached` : 'Reply'}
              className={cn(
                "flex items-center gap-1 hover:bg-transparent hover:text-primary transition-colors",
                "h-8 px-2",
                !allowNest && "opacity-40"
              )}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">{reply.repliesCount}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              aria-pressed={!!reply.isLiked}
              className={cn(
                "flex items-center gap-1 hover:bg-transparent hover:text-red-500 transition-colors",
                "h-8 px-2",
                reply.isLiked && "text-red-500"
              )}
            >
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
                <Heart className={cn(
                  "w-4 h-4",
                  reply.isLiked && "fill-current"
                )} />
              </motion.span>
              <AnimatedCount value={reply.likesCount} className="text-sm" hideZero={false} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="flex items-center gap-1 hover:bg-transparent hover:text-blue-500 transition-colors h-8 px-2"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          <span className="text-muted-foreground text-xs ml-auto block text-right mt-2">
            {new Date(reply.createdAt).toLocaleString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
