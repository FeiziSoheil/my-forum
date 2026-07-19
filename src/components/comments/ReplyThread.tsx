'use client';

import { memo, useMemo } from 'react';
import type { Reply } from '@/types/post';
import {
  buildReplyForest,
  flattenReplyPages,
} from '@/lib/replies/buildReplyTree';
import { CommentItem } from './CommentItem';

type ReplyThreadProps = {
  pages?: Array<{ replies: Reply[] }>;
  /** Flat list alternative when not using infinite query pages. */
  replies?: Reply[];
  showFollowButton?: boolean;
  onReply?: (reply: Reply) => void;
  onLike?: (replyId: string) => void;
  onShare?: (replyId: string) => void;
  emptyLabel?: string;
};

function ReplyThreadInner({
  pages,
  replies,
  showFollowButton = false,
  onReply,
  onLike,
  onShare,
  emptyLabel = 'No replies yet. Be the first to reply.',
}: ReplyThreadProps) {
  const forest = useMemo(() => {
    const flat = replies ?? flattenReplyPages(pages);
    return buildReplyForest(flat);
  }, [pages, replies]);

  if (forest.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="thread-root" role="feed" aria-label="Comments">
      {forest.map((node, index) => (
        <CommentItem
          key={node.reply._id}
          node={node}
          depth={0}
          isLastSibling={index === forest.length - 1}
          showFollowButton={showFollowButton}
          onReply={onReply}
          onLike={onLike}
          onShare={onShare}
        />
      ))}
    </div>
  );
}

export const ReplyThread = memo(ReplyThreadInner);
