'use client';

import { memo, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

type ThreadLineProps = {
  /** CSS length for horizontal center of the parent avatar column. */
  left: string;
  /** Start below the parent avatar (defaults to top of container). */
  top?: CSSProperties['top'];
  className?: string;
};

/**
 * Continuous vertical spine under a parent, running through its children list.
 * Last-sibling masking is handled by ThreadLineMask on the final child.
 */
export const ThreadLine = memo(function ThreadLine({
  left,
  top = 0,
  className,
}: ThreadLineProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute bottom-0 z-0 w-0.5 -translate-x-1/2',
        'bg-muted-foreground/30 dark:bg-muted-foreground/40',
        className
      )}
      style={{ left, top }}
    />
  );
});

type ThreadLineMaskProps = {
  left: string;
  /** Stop the parent spine at the vertical mid of this avatar. */
  avatarMidPx: number;
};

/** Covers the dangling spine below the last sibling's avatar mid-point. */
export const ThreadLineMask = memo(function ThreadLineMask({
  left,
  avatarMidPx,
}: ThreadLineMaskProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-0 z-[1] w-1 -translate-x-1/2 bg-background"
      style={{ left, top: avatarMidPx }}
    />
  );
});
