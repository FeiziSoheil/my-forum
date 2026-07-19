'use client';

import { memo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToggleReplyLike, useUpdateReply, useDeleteReply } from '@/hook/useReplies';
import { useAuth } from '@/context/AuthContext';
import { MAX_THREAD_LEVEL } from '@/lib/replies/constants';
import type { ReplyNode } from '@/lib/replies/buildReplyTree';
import type { Reply } from '@/types/post';
import { cn } from '@/lib/utils';
import {
  AVATAR_SIZE,
  COLLAPSE_REPLIES_THRESHOLD,
  MAX_VISIBLE_INDENT_DEPTH,
} from './constants';
import { CommentHeader } from './CommentHeader';
import { CommentBody } from './CommentBody';
import { CommentActions } from './CommentActions';
import { ReplyIndicator } from './ReplyIndicator';
import { CollapsedReplies } from './CollapsedReplies';
import { ThreadLine, ThreadLineMask } from './ThreadLine';

export type CommentItemProps = {
  node: ReplyNode;
  /** Visual nest depth (0 = top-level comment). */
  depth: number;
  isLastSibling?: boolean;
  /** Nest depth of the parent (for spine x via CSS vars). */
  parentDepth?: number;
  showFollowButton?: boolean;
  onReply?: (reply: Reply) => void;
  onLike?: (replyId: string) => void;
  onShare?: (replyId: string) => void;
};

function visibleIndentDepth(depth: number) {
  return Math.min(Math.max(depth, 0), MAX_VISIBLE_INDENT_DEPTH);
}

/** left: pad + depth*indent + avatarMid — tracks --thread-* CSS vars. */
function avatarCenterExpr(depth: number, avatarSize: number) {
  const d = visibleIndentDepth(depth);
  return `calc(var(--thread-pad) + ${d} * var(--thread-indent) + ${avatarSize / 2}px)`;
}

function CommentItemInner({
  node,
  depth,
  isLastSibling = false,
  parentDepth,
  showFollowButton = false,
  onReply,
  onLike,
  onShare,
}: CommentItemProps) {
  const { reply } = node;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);
  const [expanded, setExpanded] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  const toggleReplyLike = useToggleReplyLike(reply.parentPost);
  const updateReply = useUpdateReply(reply.parentPost);
  const deleteReply = useDeleteReply(reply.parentPost);

  const isOwner = !!user?._id && user._id === reply.author?._id;
  const threadLevel = Math.min(reply.threadLevel ?? depth, MAX_THREAD_LEVEL);
  const allowNest = threadLevel < MAX_THREAD_LEVEL;
  const isRoot = depth === 0;
  const avatarSize = isRoot ? AVATAR_SIZE.root : AVATAR_SIZE.nested;
  const parentAvatarSize =
    parentDepth === 0 ? AVATAR_SIZE.root : AVATAR_SIZE.nested;
  const isLikingThis =
    toggleReplyLike.isPending && toggleReplyLike.variables?.replyId === reply._id;

  const parentAuthor =
    reply.parentReply && typeof reply.parentReply === 'object'
      ? reply.parentReply.author
      : null;

  const childCount = node.children.length;
  const collapseCount = Math.max(childCount, reply.repliesCount ?? 0);
  const shouldCollapse = collapseCount > COLLAPSE_REPLIES_THRESHOLD;
  const showChildren = !shouldCollapse || expanded;
  const visibleChildren = showChildren ? node.children : [];

  const handleLike = () => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    if (isLikingThis) return;
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

  if (!reply?.author) return null;

  const authorName = reply.author.fullname || reply.author.name || 'Unknown';
  const indentSteps = visibleIndentDepth(depth);
  const thisLineLeft = avatarCenterExpr(depth, avatarSize);
  const parentLineLeft =
    parentDepth != null
      ? avatarCenterExpr(parentDepth, parentAvatarSize)
      : undefined;

  return (
    // Thread node: structure only — never hover (children live outside the card).
    <div
      className={cn('relative', isRoot && 'border-b border-border/50')}
      data-depth={depth}
      data-thread-node
    >
      {/* Mask parent spine at this avatar (outside the card — no hover coupling) */}
      {depth > 0 && isLastSibling && parentLineLeft && (
        <ThreadLineMask
          left={parentLineLeft}
          avatarMidPx={avatarSize / 2 + 6}
        />
      )}

      {/* Isolated card surface — hover scoped exclusively here */}
      <article
        data-comment-card
        className={cn(
          'comment-card group/comment relative transition-colors duration-150',
          'hover:bg-muted/40 focus-within:bg-muted/30',
          isRoot ? 'pt-5 pb-4' : 'py-1.5'
        )}
        aria-label={`Comment by ${authorName}`}
      >
        <div
          className="flex gap-3"
          style={{
            paddingLeft: `calc(var(--thread-pad) + ${indentSteps} * var(--thread-indent))`,
            paddingRight: 'var(--thread-pad)',
          }}
        >
          <div className="flex shrink-0 flex-col items-center">
            <button
              type="button"
              onClick={() => router.push(`/profile/${reply.author.username}`)}
              className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${authorName}'s profile`}
            >
              <Avatar
                className={cn('cursor-pointer', isRoot ? 'size-10' : 'size-8')}
                style={{ width: avatarSize, height: avatarSize }}
              >
                <AvatarImage src={reply.author.avatar} />
                <AvatarFallback />
              </Avatar>
            </button>
            {/* Stem under avatar connecting into the children spine */}
            {visibleChildren.length > 0 && (
              <div
                aria-hidden
                className="mt-1 w-0.5 min-h-2 flex-1 bg-muted-foreground/30 dark:bg-muted-foreground/40"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <CommentHeader
              authorName={authorName}
              username={reply.author.username}
              isOwner={isOwner}
              showFollowButton={showFollowButton}
              isFollowing={reply.isFollowing}
              isRequested={reply.isRequested}
              isRoot={isRoot}
              onEdit={handleStartEdit}
              onDelete={handleDelete}
            />

            {parentAuthor && depth > 0 && (
              <ReplyIndicator username={parentAuthor.username} />
            )}

            <CommentBody
              content={reply.content}
              editedAt={reply.editedAt}
              isRoot={isRoot}
              isEditing={isEditing}
              editContent={editContent}
              onEditChange={setEditContent}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              isSaving={updateReply.isPending}
            />

            <CommentActions
              createdAt={reply.createdAt}
              repliesCount={reply.repliesCount}
              likesCount={reply.likesCount}
              isLiked={reply.isLiked}
              allowNest={allowNest}
              onLike={handleLike}
              onReply={handleReply}
              onShare={handleShare}
            />
          </div>
        </div>
      </article>

      {shouldCollapse && !expanded && (
        <CollapsedReplies
          count={collapseCount}
          onExpand={() => setExpanded(true)}
          style={{
            paddingLeft: `calc(var(--thread-pad) + ${indentSteps} * var(--thread-indent) + ${avatarSize}px + 0.75rem)`,
          }}
        />
      )}

      {visibleChildren.length > 0 && (
        <div className="relative" data-replies-wrapper>
          <ThreadLine left={thisLineLeft} />
          {visibleChildren.map((child, index) => (
            <CommentItem
              key={child.reply._id}
              node={child}
              depth={depth + 1}
              parentDepth={depth}
              isLastSibling={index === visibleChildren.length - 1}
              showFollowButton={showFollowButton}
              onReply={onReply}
              onLike={onLike}
              onShare={onShare}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const CommentItem = memo(CommentItemInner);
