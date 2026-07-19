"use client";

import AnimatedReactionEmoji from "@/components/chat/AnimatedReactionEmoji";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { hasAnimatedReaction } from "@/lib/chat/animatedReactions";
import { chatThemeClasses } from "@/lib/chat/themes";
import { cn } from "@/lib/utils";
import { ChatUser } from "@/types/chat";
import {
  motion,
  useAnimationControls,
  useReducedMotion,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";

const POP_SPRING = {
  type: "spring" as const,
  stiffness: 520,
  damping: 22,
  mass: 0.55,
};

const EXIT_EASE = {
  duration: 0.16,
  ease: [0.4, 0, 1, 1] as const,
};

const MAX_AVATARS = 3;

type ReactionChipProps = {
  emoji: string;
  count: number;
  mine: boolean;
  users?: ChatUser[];
  /** Whether this chip sits on the sender's (primary) bubble */
  isMineBubble?: boolean;
  onClick: () => void;
};

function initials(user: ChatUser) {
  const name = user.fullname?.trim() || user.username || "?";
  return name.charAt(0).toUpperCase();
}

export default function ReactionChip({
  emoji,
  count,
  mine,
  users = [],
  isMineBubble = false,
  onClick,
}: ReactionChipProps) {
  const reduced = useReducedMotion();
  const prevCount = useRef(count);
  const emojiControls = useAnimationControls();
  const [playKey, setPlayKey] = useState(0);
  const animated = hasAnimatedReaction(emoji);
  const visibleUsers = users.slice(0, MAX_AVATARS);

  useEffect(() => {
    if (count === prevCount.current) return;
    prevCount.current = count;
    setPlayKey((k) => k + 1);

    if (reduced || animated) return;

    void emojiControls.start({
      scale: [1, 1.38, 1],
      transition: {
        duration: 0.32,
        ease: [0.16, 1, 0.3, 1],
        times: [0, 0.4, 1],
      },
    });
  }, [count, emojiControls, reduced, animated]);

  return (
    <motion.button
      type="button"
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, scale: 0.45, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={
        reduced
          ? { opacity: 0, transition: { duration: 0.1 } }
          : { opacity: 0, scale: 0.55, y: 2, transition: EXIT_EASE }
      }
      whileTap={reduced ? undefined : { scale: 0.86 }}
      transition={reduced ? { duration: 0.12 } : POP_SPRING}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[14px] leading-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        isMineBubble
          ? mine
            ? chatThemeClasses.mineChipMine
            : chatThemeClasses.mineChipOther
          : mine
            ? chatThemeClasses.theirsChipMine
            : "bg-background/70"
      )}
      aria-label={`React with ${emoji}`}
      aria-pressed={mine}
    >
      {visibleUsers.length > 0 && (
        <span className="inline-flex items-center -space-x-1.5 rtl:space-x-reverse">
          {visibleUsers.map((user) => (
            <Avatar
              key={user._id}
              className={cn(
                "size-3.5 ring-1",
                isMineBubble ? chatThemeClasses.mineRing : "ring-background"
              )}
            >
              {user.avatar ? (
                <AvatarImage src={user.avatar} alt="" />
              ) : null}
              <AvatarFallback
                className={cn(
                  "text-[7px] font-medium",
                  isMineBubble
                    ? chatThemeClasses.mineAvatarFallback
                    : "bg-background text-muted-foreground"
                )}
              >
                {initials(user)}
              </AvatarFallback>
            </Avatar>
          ))}
        </span>
      )}
      <motion.span
        className="inline-block leading-none will-change-transform"
        animate={emojiControls}
        initial={false}
      >
        <AnimatedReactionEmoji
          emoji={emoji}
          playKey={playKey}
          reducedMotion={reduced}
          className="size-[1.1em] text-[14px]"
        />
      </motion.span>
      {count > 1 && (
        <span
          className={cn(
            "text-[10px] tabular-nums leading-none",
            isMineBubble
              ? chatThemeClasses.mineFg70
              : "text-muted-foreground"
          )}
        >
          {count}
        </span>
      )}
    </motion.button>
  );
}
