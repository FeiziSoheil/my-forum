"use client";

import MessageImage, {
  MessageLightbox,
} from "@/components/chat/MessageImage";
import AnimatedReactionEmoji from "@/components/chat/AnimatedReactionEmoji";
import ReactionChip from "@/components/chat/ReactionChip";
import ReplyQuote from "@/components/chat/ReplyQuote";
import StoryReplyCard from "@/components/stories/StoryReplyCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { prefetchAnimatedReactions } from "@/lib/chat/animatedReactions";
import { bubbleRadiusClasses } from "@/lib/chat/messageGroup";
import { chatThemeClasses } from "@/lib/chat/themes";
import { cn } from "@/lib/utils";
import {
  ChatMessage,
  ChatUser,
  QUICK_REACTIONS,
  REACTION_EMOJIS,
  SharedPostPreview,
} from "@/types/chat";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  PanInfo,
} from "framer-motion";
import {
  Copy,
  Forward,
  MoreHorizontal,
  Reply,
  SmilePlus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

function formatMsgTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function reactionUserId(user: ChatUser | string) {
  return typeof user === "string" ? user : user._id;
}

function userInitials(user: ChatUser) {
  const name = user.fullname?.trim() || user.username || "?";
  return name.charAt(0).toUpperCase();
}

function SharedPostCard({
  post,
  isMine,
}: {
  post: SharedPostPreview;
  isMine: boolean;
}) {
  const thumb = post.media?.find(
    (m) => m.type === "image" || m.type === "gif" || m.type === "video"
  );
  const authorName = post.author?.fullname || post.author?.username || "User";

  return (
    <Link
      href={`/post/${post._id}`}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "mb-1 block overflow-hidden rounded-xl border text-start transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isMine
          ? cn(chatThemeClasses.mineSoftBorder, chatThemeClasses.mineSoftBg)
          : "border-border/50 bg-background/50"
      )}
    >
      {thumb && (
        <div className="relative h-28 w-full overflow-hidden bg-muted/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb.url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="space-y-0.5 px-2.5 py-2">
        <p
          className={cn(
            "text-[11px] font-medium",
            isMine ? chatThemeClasses.mineFg75 : "text-muted-foreground"
          )}
        >
          @{post.author?.username || "user"}
        </p>
        <p
          className={cn(
            "line-clamp-3 text-[13px] leading-snug",
            isMine ? "text-[var(--chat-mine-fg)]" : "text-foreground"
          )}
        >
          {post.content || `${authorName}'s post`}
        </p>
      </div>
    </Link>
  );
}

export default function MessageBubble({
  message,
  isMine,
  currentUserId,
  isFirstInGroup = true,
  isLastInGroup = true,
  isHighlighted = false,
  showSenderLabel = false,
  isGroupChat = false,
  onReply,
  onReact,
  onJumpToReply,
  onDelete,
  onForward,
}: {
  message: ChatMessage;
  isMine: boolean;
  currentUserId?: string;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  isHighlighted?: boolean;
  /** Show sender name above bubble (group chats, others' messages) */
  showSenderLabel?: boolean;
  /** Group conversations show who reacted in the message menu */
  isGroupChat?: boolean;
  onReply?: (message: ChatMessage) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onJumpToReply?: (messageId: string) => void;
  onDelete?: (message: ChatMessage) => void;
  onForward?: (message: ChatMessage) => void;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fullPickerOpen, setFullPickerOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    placement: "above" | "below";
  } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if ((!menuOpen && !pickerOpen) || reducedMotion) return;
    prefetchAnimatedReactions();
  }, [menuOpen, pickerOpen, reducedMotion]);

  const x = useMotionValue(0);
  const replyIconOpacity = useTransform(x, [0, 40, 72], [0, 0.5, 1]);
  const replyIconScale = useTransform(x, [0, 72], [0.6, 1]);

  const isDeleted = !!message.isDeleted;
  const images = (message.media ?? []).filter(
    (m) => m.type === "image" || m.type === "gif"
  );
  const videos = (message.media ?? []).filter((m) => m.type === "video");
  const sharedPost =
    message.sharedPost && typeof message.sharedPost !== "string"
      ? message.sharedPost
      : null;
  const storySnapshot = message.storySnapshot ?? null;
  const replyTo =
    message.replyTo && typeof message.replyTo !== "string"
      ? message.replyTo
      : null;
  const senderUser =
    typeof message.sender === "string" ? null : message.sender;
  const senderLabel =
    showSenderLabel && !isMine && isFirstInGroup && senderUser
      ? senderUser.fullname || senderUser.username
      : null;

  const reactionGroups = (() => {
    if (isDeleted) return [];
    const map = new Map<
      string,
      { emoji: string; count: number; mine: boolean; users: ChatUser[] }
    >();
    for (const r of message.reactions ?? []) {
      const existing = map.get(r.emoji);
      const mine = !!currentUserId && reactionUserId(r.user) === currentUserId;
      const user = typeof r.user === "string" ? null : r.user;
      if (existing) {
        existing.count += 1;
        existing.mine = existing.mine || mine;
        if (user && !existing.users.some((u) => u._id === user._id)) {
          existing.users.push(user);
        }
      } else {
        map.set(r.emoji, {
          emoji: r.emoji,
          count: 1,
          mine,
          users: user ? [user] : [],
        });
      }
    }
    return Array.from(map.values());
  })();

  const reactionPeople = useMemo(() => {
    if (!isGroupChat || isDeleted) return [];
    return (message.reactions ?? [])
      .map((r, index) => {
        const user = typeof r.user === "string" ? null : r.user;
        if (!user) return null;
        return {
          key: `${reactionUserId(r.user)}-${r.emoji}-${index}`,
          emoji: r.emoji,
          user,
          createdAt: r.createdAt,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [isGroupChat, isDeleted, message.reactions]);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const updateMenuPosition = useCallback(() => {
    const anchorEl = bubbleRef.current;
    if (!anchorEl) return;

    const anchor = anchorEl.getBoundingClientRect();
    const menuEl = menuRef.current;
    const menuW = menuEl?.offsetWidth || 240;
    const menuH = menuEl?.offsetHeight || 320;
    const gap = 6;
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let placement: "above" | "below" = "above";
    let top = anchor.top - menuH - gap;
    if (top < pad) {
      top = anchor.bottom + gap;
      placement = "below";
    }
    if (top + menuH > vh - pad) {
      top = Math.max(pad, vh - menuH - pad);
    }

    let left = isMine ? anchor.right - menuW : anchor.left;
    left = Math.max(pad, Math.min(left, vw - menuW - pad));

    setMenuPos({ top, left, placement });
  }, [isMine]);

  const openMenu = useCallback(
    (withPicker = true) => {
      if (isDeleted) return;
      setPickerOpen(withPicker);
      setFullPickerOpen(false);
      // Seed position from the bubble so the menu can animate in place
      const anchor = bubbleRef.current?.getBoundingClientRect();
      if (anchor) {
        const menuW = 240;
        const menuH = withPicker ? 100 : 180;
        const gap = 6;
        const pad = 8;
        let placement: "above" | "below" = "above";
        let top = anchor.top - menuH - gap;
        if (top < pad) {
          top = anchor.bottom + gap;
          placement = "below";
        }
        let left = isMine ? anchor.right - menuW : anchor.left;
        left = Math.max(pad, Math.min(left, window.innerWidth - menuW - pad));
        setMenuPos({ top, left, placement });
      } else {
        setMenuPos(null);
      }
      setMenuOpen(true);
    },
    [isDeleted, isMine]
  );

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setPickerOpen(false);
    setFullPickerOpen(false);
  }, []);

  const startLongPress = useCallback(() => {
    if (isDeleted) return;
    didLongPress.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      openMenu(true);
    }, 450);
  }, [clearLongPress, openMenu, isDeleted]);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    updateMenuPosition();
    const id = requestAnimationFrame(() => updateMenuPosition());
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [menuOpen, pickerOpen, fullPickerOpen, reactionPeople.length, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, closeMenu]);

  useEffect(() => () => clearLongPress(), [clearLongPress]);

  useEffect(() => {
    if (menuOpen) {
      requestAnimationFrame(() => menuItemRefs.current[0]?.focus());
    }
  }, [menuOpen]);

  const resetSwipe = useCallback(() => {
    animate(x, 0, { type: "spring", stiffness: 520, damping: 42 });
  }, [x]);

  const triggerReply = useCallback(() => {
    resetSwipe();
    onReply?.(message);
  }, [message, onReply, resetSwipe]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (isDeleted) {
      resetSwipe();
      return;
    }
    const shouldReply = info.offset.x > 56 || info.velocity.x > 400;
    resetSwipe();
    if (shouldReply) {
      onReply?.(message);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openMenu(true);
  };

  const handleDoubleClick = () => {
    if (isDeleted) return;
    onReact?.(message._id, "❤️");
  };

  const copyText = async () => {
    const text = message.content?.trim();
    if (!text) {
      toast.error("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Failed to copy");
    }
    closeMenu();
  };

  const hasBody =
    isDeleted ||
    !!message.content?.trim() ||
    images.length > 0 ||
    videos.length > 0 ||
    !!sharedPost ||
    (message.type === "story_reply" && !!storySnapshot);

  return (
    <>
      <div
        id={`msg-${message._id}`}
        data-message-id={message._id}
        className={cn(
          "relative flex w-full items-center scroll-mt-4 rounded-xl transition-[background-color,box-shadow] duration-200",
          isMine ? "justify-end" : "justify-start",
          isHighlighted && "chat-msg-highlight"
        )}
      >
        {!isDeleted && (
          <motion.div
            style={{ opacity: replyIconOpacity, scale: replyIconScale }}
            className="pointer-events-none absolute start-1 grid size-8 place-items-center rounded-full bg-muted text-muted-foreground"
            aria-hidden
          >
            <Reply size={16} />
          </motion.div>
        )}

        <motion.div
          ref={bubbleRef}
          style={{ x }}
          drag={isDeleted || menuOpen ? false : "x"}
          dragConstraints={{ left: 0, right: 72 }}
          dragElastic={{ left: 0, right: 0.15 }}
          dragSnapToOrigin
          dragDirectionLock
          onDragStart={() => {
            clearLongPress();
            didLongPress.current = true;
          }}
          onDragEnd={handleDragEnd}
          onPointerDown={startLongPress}
          onPointerUp={clearLongPress}
          onPointerCancel={clearLongPress}
          onPointerLeave={clearLongPress}
          onContextMenu={handleContextMenu}
          onDoubleClick={handleDoubleClick}
          className={cn(
            "group relative touch-pan-y w-fit max-w-[80%] sm:max-w-[70%] lg:max-w-[min(28rem,55%)]",
            isMine && "ms-auto"
          )}
        >
          {!isDeleted && (
            <button
              type="button"
              aria-label="Message actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (menuOpen) {
                  closeMenu();
                } else {
                  openMenu(true);
                }
              }}
              className={cn(
                "absolute top-1 z-20 grid size-7 place-items-center rounded-full border border-border/50 bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-opacity duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isMine ? "-start-9" : "-end-9",
                menuOpen
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              )}
            >
              <MoreHorizontal size={15} aria-hidden />
            </button>
          )}

          {senderLabel ? (
            <p
              className={cn(
                "mb-0.5 truncate ps-1 text-[11px] font-medium",
                chatThemeClasses.accentText
              )}
            >
              {senderLabel}
            </p>
          ) : null}

          <div
            className={cn(
              "px-2.5 py-1.5 select-none",
              bubbleRadiusClasses(isMine, isFirstInGroup, isLastInGroup),
              isMine
                ? chatThemeClasses.bubbleMine
                : chatThemeClasses.bubbleTheirs,
              !hasBody && "min-w-[4rem]",
              isDeleted && "opacity-80"
            )}
          >
            {isDeleted ? (
              <p
                className={cn(
                  "italic text-base leading-snug",
                  isMine
                    ? chatThemeClasses.mineFg70
                    : "text-muted-foreground"
                )}
              >
                Message deleted
              </p>
            ) : (
              <>
                {replyTo && (
                  <ReplyQuote
                    reply={replyTo}
                    isMine={isMine}
                    onJump={onJumpToReply}
                  />
                )}

                {sharedPost && (
                  <SharedPostCard post={sharedPost} isMine={isMine} />
                )}

                {message.type === "story_reply" && storySnapshot && (
                  <StoryReplyCard snapshot={storySnapshot} isMine={isMine} />
                )}

                {images.length > 0 && (
                  <div className={cn("space-y-1", message.content && "mb-1")}>
                    {images.map((img) => (
                      <MessageImage
                        key={img.url}
                        src={img.url}
                        alt={img.alt || "Image"}
                        onOpen={(url) => {
                          if (didLongPress.current) return;
                          setLightbox(url);
                        }}
                      />
                    ))}
                  </div>
                )}

                {videos.length > 0 && (
                  <div className={cn("space-y-1", message.content && "mb-1")}>
                    {videos.map((vid) => (
                      <div
                        key={vid.url}
                        className="overflow-hidden rounded-xl bg-muted/40"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <video
                          src={vid.url}
                          controls
                          playsInline
                          preload="metadata"
                          className="max-h-64 w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {message.content ? (
                  <p className="whitespace-pre-wrap break-words text-base leading-snug">
                    {message.content}
                  </p>
                ) : null}
              </>
            )}

            {(reactionGroups.length > 0 || isLastInGroup) && (
              <div
                className={cn(
                  "mt-0.5 flex min-h-[14px] items-center gap-2",
                  isMine && reactionGroups.length === 0 && "justify-end"
                )}
              >
                {reactionGroups.length > 0 && (
                  <div className="flex min-w-0 flex-wrap items-center gap-0.5">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {reactionGroups.map((g) => (
                        <ReactionChip
                          key={g.emoji}
                          emoji={g.emoji}
                          count={g.count}
                          mine={g.mine}
                          users={g.users}
                          isMineBubble={isMine}
                          onClick={() => onReact?.(message._id, g.emoji)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
                {isLastInGroup && (
                  <p
                    className={cn(
                      "shrink-0 text-[11px] leading-none opacity-55",
                      (isMine || reactionGroups.length > 0) && "ms-auto",
                      isMine && "text-[var(--chat-mine-fg)]"
                    )}
                  >
                    {formatMsgTime(message.createdAt)}
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {createPortal(
        <AnimatePresence
          onExitComplete={() => {
            setMenuPos(null);
          }}
        >
          {menuOpen && !isDeleted && menuPos && (
            <motion.div
              key={`msg-menu-${message._id}`}
              ref={menuRef}
              role="menu"
              aria-label="Message actions"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              initial={{
                opacity: 0,
                scale: 0.9,
                y: menuPos.placement === "below" ? -10 : 10,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.94,
                y: menuPos.placement === "below" ? -6 : 6,
                transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
              }}
              transition={{
                type: "spring",
                stiffness: 420,
                damping: 30,
                mass: 0.72,
              }}
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                transformOrigin:
                  menuPos.placement === "below" ? "top center" : "bottom center",
                transition: "top 0.2s cubic-bezier(0.16, 1, 0.3, 1), left 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              className={cn(
                "z-50 flex w-[min(240px,calc(100vw-16px))] flex-col gap-2",
                isMine ? "items-end" : "items-start"
              )}
            >
              {(pickerOpen ||
                (isGroupChat && reactionPeople.length > 0)) && (
                <div
                  className="w-full overflow-hidden rounded-xl border border-border/60 bg-background shadow-lg"
                  role="group"
                  aria-label="Reactions"
                >
                  {pickerOpen && (
                    <div>
                      <div className="flex items-center justify-between gap-0.5 px-1 py-1">
                        {QUICK_REACTIONS.map((emoji, index) => (
                          <motion.button
                            key={emoji}
                            type="button"
                            role="menuitem"
                            initial={
                              reducedMotion
                                ? false
                                : { opacity: 0, scale: 0.35, y: 6 }
                            }
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={
                              reducedMotion
                                ? { duration: 0.12 }
                                : {
                                    type: "spring",
                                    stiffness: 520,
                                    damping: 22,
                                    mass: 0.55,
                                    delay: Math.min(index * 0.03, 0.21),
                                  }
                            }
                            whileHover={
                              reducedMotion ? undefined : { scale: 1.18 }
                            }
                            whileTap={
                              reducedMotion ? undefined : { scale: 1.32 }
                            }
                            className="grid size-8 flex-1 place-items-center rounded-lg text-base transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => {
                              onReact?.(message._id, emoji);
                              closeMenu();
                            }}
                            aria-label={`React with ${emoji}`}
                          >
                            <AnimatedReactionEmoji
                              emoji={emoji}
                              eager
                              reducedMotion={reducedMotion}
                              className="size-[1.25em] text-[1.05em]"
                            />
                          </motion.button>
                        ))}
                        <motion.button
                          type="button"
                          role="menuitem"
                          initial={
                            reducedMotion
                              ? false
                              : { opacity: 0, scale: 0.35, y: 6 }
                          }
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={
                            reducedMotion
                              ? { duration: 0.12 }
                              : {
                                  type: "spring",
                                  stiffness: 520,
                                  damping: 22,
                                  mass: 0.55,
                                  delay: 0.22,
                                }
                          }
                          whileHover={
                            reducedMotion ? undefined : { scale: 1.1 }
                          }
                          whileTap={
                            reducedMotion ? undefined : { scale: 0.92 }
                          }
                          aria-expanded={fullPickerOpen}
                          aria-label={
                            fullPickerOpen
                              ? "Hide more reactions"
                              : "Show more reactions"
                          }
                          className={cn(
                            "grid size-8 flex-1 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            fullPickerOpen && "bg-muted text-foreground"
                          )}
                          onClick={() => setFullPickerOpen((open) => !open)}
                        >
                          <SmilePlus
                            size={16}
                            className={cn(
                              "transition-transform duration-200",
                              fullPickerOpen && "rotate-45"
                            )}
                            aria-hidden
                          />
                        </motion.button>
                      </div>

                      <AnimatePresence initial={false}>
                        {fullPickerOpen && (
                          <motion.div
                            key="full-reaction-picker"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              duration: 0.22,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            className="overflow-hidden border-t border-border/30"
                          >
                            <div className="max-h-[32vh] overflow-y-auto px-1.5 py-1.5">
                              <div className="grid grid-cols-8 gap-0.5">
                                {REACTION_EMOJIS.filter(
                                  (emoji) =>
                                    !(
                                      QUICK_REACTIONS as readonly string[]
                                    ).includes(emoji)
                                ).map((emoji, index) => (
                                  <motion.button
                                    key={emoji}
                                    type="button"
                                    role="menuitem"
                                    initial={
                                      reducedMotion
                                        ? false
                                        : { opacity: 0, scale: 0.35, y: 6 }
                                    }
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={
                                      reducedMotion
                                        ? { duration: 0.12 }
                                        : {
                                            type: "spring",
                                            stiffness: 520,
                                            damping: 22,
                                            mass: 0.55,
                                            delay: Math.min(
                                              index * 0.02,
                                              0.3
                                            ),
                                          }
                                    }
                                    whileHover={
                                      reducedMotion
                                        ? undefined
                                        : { scale: 1.14 }
                                    }
                                    whileTap={
                                      reducedMotion
                                        ? undefined
                                        : { scale: 1.28 }
                                    }
                                    className="grid size-7 place-items-center rounded-md text-base transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={() => {
                                      onReact?.(message._id, emoji);
                                      closeMenu();
                                    }}
                                    aria-label={`React with ${emoji}`}
                                  >
                                    <AnimatedReactionEmoji
                                      emoji={emoji}
                                      eager
                                      reducedMotion={reducedMotion}
                                      className="size-[1.2em] text-[1em]"
                                    />
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {isGroupChat && reactionPeople.length > 0 && (
                    <div
                      className={cn(
                        "max-h-[28vh] overflow-y-auto",
                        pickerOpen && "border-t border-border/40"
                      )}
                      role="group"
                      aria-label="People who reacted"
                    >
                      <p className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-medium text-muted-foreground">
                        Reactions · {reactionPeople.length}
                      </p>
                      <ul className="pb-0.5">
                        {reactionPeople.map((entry) => {
                          const displayName =
                            entry.user.fullname?.trim() ||
                            entry.user.username ||
                            "User";
                          return (
                            <li key={entry.key}>
                              <Link
                                href={`/profile/${entry.user.username}`}
                                role="menuitem"
                                onClick={closeMenu}
                                className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                              >
                                <Avatar className="size-6 shrink-0">
                                  {entry.user.avatar ? (
                                    <AvatarImage
                                      src={entry.user.avatar}
                                      alt=""
                                    />
                                  ) : null}
                                  <AvatarFallback className="text-[9px] font-medium">
                                    {userInitials(entry.user)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="min-w-0 flex-1 truncate text-start font-medium">
                                  {displayName}
                                </span>
                                <AnimatedReactionEmoji
                                  emoji={entry.emoji}
                                  eager
                                  reducedMotion={reducedMotion}
                                  className="size-4 shrink-0 text-sm"
                                />
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div
                className="w-[min(148px,100%)] overflow-hidden rounded-xl border border-border/60 bg-background shadow-lg"
                role="group"
                aria-label="Message actions"
              >
                <button
                  ref={(el) => {
                    menuItemRefs.current[0] = el;
                  }}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-[13px] transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                  onClick={() => {
                    triggerReply();
                    closeMenu();
                  }}
                >
                  <Reply size={14} aria-hidden />
                  Reply
                </button>

                <button
                  ref={(el) => {
                    menuItemRefs.current[1] = el;
                  }}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-[13px] transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                  onClick={() => void copyText()}
                  disabled={!message.content?.trim()}
                >
                  <Copy size={14} aria-hidden />
                  Copy
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-[13px] transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                  onClick={() => {
                    closeMenu();
                    onForward?.(message);
                  }}
                >
                  <Forward size={14} aria-hidden />
                  Forward
                </button>

                {isMine && (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-2.5 py-2 text-[13px] text-destructive transition-colors hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:outline-none"
                    onClick={() => {
                      closeMenu();
                      onDelete?.(message);
                    }}
                  >
                    <Trash2 size={14} aria-hidden />
                    Delete
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {lightbox && (
        <MessageLightbox src={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
