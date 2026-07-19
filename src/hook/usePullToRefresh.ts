"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

type UsePullToRefreshOptions = {
  onRefresh: () => void | Promise<void>;
  /** Pixels of resisted pull needed to trigger refresh */
  threshold?: number;
  /** Multiplier applied to raw finger travel (lower = harder pull) */
  resistance?: number;
  disabled?: boolean;
  /**
   * Optional scroll container. When omitted, uses the window/document scroll.
   * Pull only starts when this scroller is at the top.
   */
  scrollRef?: RefObject<HTMLElement | null>;
};

export function usePullToRefresh({
  onRefresh,
  threshold = 72,
  resistance = 0.42,
  disabled = false,
  scrollRef,
}: UsePullToRefreshOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const distanceRef = useRef(0);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const setDistance = (value: number) => {
    distanceRef.current = value;
    setPullDistance(value);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    const getScrollTop = () => {
      const scroller = scrollRef?.current;
      if (scroller) return scroller.scrollTop;
      return window.scrollY || document.documentElement.scrollTop || 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (getScrollTop() > 1) {
        pullingRef.current = false;
        return;
      }
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return;

      if (getScrollTop() > 1) {
        pullingRef.current = false;
        setDistance(0);
        return;
      }

      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        setDistance(0);
        return;
      }

      // Own the overscroll so the page doesn't bounce while we show the indicator
      e.preventDefault();
      setDistance(Math.min(dy * resistance, threshold * 1.65));
    };

    const onTouchEnd = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;

      const distance = distanceRef.current;
      if (distance < threshold || refreshingRef.current) {
        setDistance(0);
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);
      setDistance(threshold);

      void (async () => {
        try {
          await onRefreshRef.current();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          setDistance(0);
        }
      })();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, resistance, threshold, scrollRef]);

  return {
    containerRef,
    pullDistance,
    refreshing,
    threshold,
  };
}
