"use client";

import { usePullToRefresh } from "@/hook/usePullToRefresh";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { RefObject, ReactNode } from "react";

type PullToRefreshProps = {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Optional inner scroll container (defaults to window) */
  scrollRef?: RefObject<HTMLElement | null>;
};

/**
 * Pull-down gesture that reloads data via `onRefresh` — not a browser refresh.
 * Touch-only; activates only when the scroll position is at the top.
 */
export default function PullToRefresh({
  onRefresh,
  children,
  className,
  disabled,
  scrollRef,
}: PullToRefreshProps) {
  const { containerRef, pullDistance, refreshing, threshold } =
    usePullToRefresh({ onRefresh, disabled, scrollRef });

  const progress = Math.min(1, pullDistance / threshold);
  const showIndicator = pullDistance > 6 || refreshing;
  const contentOffset = refreshing
    ? Math.round(threshold * 0.55)
    : Math.round(pullDistance * 0.35);
  const indicatorOffset = refreshing
    ? Math.round(threshold * 0.5)
    : Math.round(pullDistance * 0.5);

  return (
    <div
      ref={containerRef}
      className={cn("relative overscroll-y-contain", className)}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center"
        style={{
          transform: `translateY(${indicatorOffset}px)`,
          opacity: showIndicator ? Math.max(progress, refreshing ? 1 : 0) : 0,
          transition: refreshing || pullDistance === 0 ? "opacity 0.15s ease" : undefined,
        }}
        aria-hidden={!showIndicator}
      >
        <div
          className={cn(
            "grid size-9 place-items-center rounded-full border border-border/70 bg-background/95 shadow-sm backdrop-blur-sm",
            refreshing && "border-primary/30"
          )}
          role="status"
          aria-live="polite"
          aria-label={refreshing ? "Refreshing" : undefined}
        >
          <Loader2
            className={cn(
              "size-4 text-muted-foreground",
              (refreshing || progress >= 1) && "animate-spin text-primary"
            )}
            style={
              refreshing || progress >= 1
                ? undefined
                : { transform: `rotate(${progress * 300}deg)` }
            }
          />
        </div>
      </div>

      {/* Use margin (not transform) so position:sticky descendants still work */}
      <div
        style={{
          marginTop: contentOffset || undefined,
          transition:
            pullDistance === 0 && !refreshing
              ? "margin-top 0.22s ease-out"
              : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
