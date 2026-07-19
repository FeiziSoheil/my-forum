"use client";

import { getAnimatedReactionSrc, loadAnimatedReactionData } from "@/lib/chat/animatedReactions";
import { cn } from "@/lib/utils";
import type { LottieRefCurrentProps } from "lottie-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const Lottie = dynamic(() => import("lottie-react"), {
  ssr: false,
  loading: () => null,
});

type AnimatedReactionEmojiProps = {
  emoji: string;
  /** Increment to replay the Lottie from the start */
  playKey?: number;
  reducedMotion?: boolean | null;
  /** Skip IntersectionObserver and load immediately (picker / visible menus) */
  eager?: boolean;
  className?: string;
};

export default function AnimatedReactionEmoji({
  emoji,
  playKey = 0,
  reducedMotion = false,
  eager = false,
  className,
}: AnimatedReactionEmojiProps) {
  const src = getAnimatedReactionSrc(emoji);
  const containerRef = useRef<HTMLSpanElement>(null);
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const [inView, setInView] = useState(eager);
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (eager) {
      setInView(true);
      return;
    }
    if (!src || reducedMotion) return;
    const el = containerRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setInView(true);
        io.disconnect();
      },
      { rootMargin: "100px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src, reducedMotion, eager]);

  useEffect(() => {
    if (!inView || !src || reducedMotion) return;

    let cancelled = false;
    loadAnimatedReactionData(src)
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [inView, src, reducedMotion]);

  useEffect(() => {
    if (playKey === 0 || !animationData) return;
    lottieRef.current?.goToAndPlay(0, true);
  }, [playKey, animationData]);

  const useLottie = !!src && !reducedMotion && !failed && !!animationData;

  return (
    <span
      ref={containerRef}
      className={cn(
        "relative inline-grid size-[1.2em] place-items-center leading-none",
        className
      )}
      aria-hidden
    >
      <span
        className={cn(
          "leading-none",
          useLottie && "pointer-events-none absolute opacity-0"
        )}
      >
        {emoji}
      </span>
      {useLottie && (
        <Lottie
          lottieRef={lottieRef}
          animationData={animationData}
          loop={false}
          autoplay
          className="size-full"
          rendererSettings={{
            progressiveLoad: true,
            hideOnTransparent: true,
          }}
        />
      )}
    </span>
  );
}
