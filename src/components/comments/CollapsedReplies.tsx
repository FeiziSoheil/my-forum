'use client';

import { memo, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type CollapsedRepliesProps = {
  count: number;
  onExpand: () => void;
  style?: CSSProperties;
  className?: string;
};

export const CollapsedReplies = memo(function CollapsedReplies({
  count,
  onExpand,
  style,
  className,
}: CollapsedRepliesProps) {
  if (count <= 0) return null;

  return (
    <div className={cn('py-1', className)} style={style}>
      <button
        type="button"
        onClick={onExpand}
        className={cn(
          'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium',
          'text-primary transition-colors hover:bg-muted/60 focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring'
        )}
        aria-expanded={false}
        aria-label={`View ${count} ${count === 1 ? 'reply' : 'replies'}`}
      >
        <ChevronDown className="size-4 shrink-0" aria-hidden />
        View {count} {count === 1 ? 'reply' : 'replies'}
      </button>
    </div>
  );
});
