'use client';

import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedCount } from '@/components/AnimatedCount';
import { cn } from '@/lib/utils';
import { MAX_THREAD_LEVEL } from '@/lib/replies/constants';
import {
  formatAbsoluteDateTime,
  formatRelativeTime,
  parseValidDate,
} from '@/lib/formatRelativeTime';

type CommentActionsProps = {
  createdAt?: Date | string | null;
  repliesCount: number;
  likesCount: number;
  isLiked?: boolean;
  allowNest?: boolean;
  onLike?: () => void;
  onReply?: () => void;
  onShare?: () => void;
};

export const CommentActions = memo(function CommentActions({
  createdAt,
  repliesCount,
  likesCount,
  isLiked,
  allowNest = true,
  onLike,
  onReply,
  onShare,
}: CommentActionsProps) {
  const [likeBurst, setLikeBurst] = useState(0);
  const validDate = parseValidDate(createdAt);
  const absoluteLabel = validDate ? formatAbsoluteDateTime(validDate) : '';
  const relativeLabel = validDate ? formatRelativeTime(validDate) : '';

  const handleLike = () => {
    if (!isLiked) setLikeBurst((n) => n + 1);
    onLike?.();
  };

  return (
    <div className="-ml-2 flex w-full items-center gap-1 text-muted-foreground">
      <Button
        variant="ghost"
        size="sm"
        onClick={onReply}
        disabled={!allowNest}
        title={!allowNest ? `Max nesting depth (${MAX_THREAD_LEVEL}) reached` : 'Reply'}
        aria-label={`Reply${repliesCount ? `, ${repliesCount} replies` : ''}`}
        className={cn(
          'h-11 gap-1.5 px-2.5 hover:bg-transparent hover:text-primary sm:h-9',
          !allowNest && 'opacity-40'
        )}
      >
        <MessageCircle className="size-4 shrink-0" />
        <span className="text-[13px] tabular-nums">{repliesCount}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleLike}
        aria-pressed={!!isLiked}
        aria-label={isLiked ? 'Unlike' : 'Like'}
        className={cn(
          'h-11 gap-1.5 px-2.5 hover:bg-transparent hover:text-red-500 sm:h-9',
          isLiked && 'text-red-500'
        )}
      >
        <motion.span
          key={`like-${likeBurst}`}
          initial={{ scale: 1 }}
          animate={
            likeBurst > 0 ? { scale: [1, 1.45, 0.9, 1.15, 1] } : { scale: 1 }
          }
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex"
        >
          <Heart className={cn('size-4 shrink-0', isLiked && 'fill-current')} />
        </motion.span>
        <AnimatedCount value={likesCount} className="text-[13px]" hideZero={false} />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onShare}
        aria-label="Share"
        className={cn(
          'h-11 px-2.5 hover:bg-transparent hover:text-blue-500 sm:h-9',
          // Share is a “quick action”: always on mobile, hover-reveal desktop
          'opacity-100 sm:opacity-0 sm:group-hover/comment:opacity-100 sm:group-focus-within/comment:opacity-100',
          'transition-opacity duration-150'
        )}
      >
        <Send className="size-4 shrink-0" />
      </Button>

      {validDate && (
        <time
          dateTime={validDate.toISOString()}
          title={absoluteLabel}
          aria-label={absoluteLabel}
          className="ml-auto shrink-0 pr-1 text-[12px] text-muted-foreground tabular-nums"
        >
          {relativeLabel}
        </time>
      )}
    </div>
  );
});
