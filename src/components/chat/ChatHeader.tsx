"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatLastSeen } from "@/lib/presence/status";
import { ChatUser, PresenceStatus, TypingUser } from "@/types/chat";
import { ArrowLeft, Palette, Users } from "lucide-react";
import Link from "next/link";

function formatTypingLine(
  typingUsers: TypingUser[],
  isGroup: boolean,
  peerName?: string
): string | null {
  if (typingUsers.length === 0) return null;

  if (!isGroup) {
    const first = peerName?.split(/\s+/)[0] || peerName || "Someone";
    return `${first} is typing…`;
  }

  const names = typingUsers.map(
    (u) =>
      (u.fullname || u.username || "Someone").split(/\s+/)[0] || "Someone"
  );

  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names[0]}, ${names[1]}, and ${names.length - 2} others are typing…`;
}

export default function ChatHeader({
  otherUser,
  presence,
  typingUsers = [],
  peerTyping,
  isLoading,
  isGroup,
  title,
  memberCount,
  onlineCount,
  onIdentityClick,
  onThemeClick,
}: {
  otherUser?: ChatUser;
  presence?: PresenceStatus | null;
  typingUsers?: TypingUser[];
  /** @deprecated prefer typingUsers */
  peerTyping?: boolean;
  isLoading?: boolean;
  isGroup?: boolean;
  title?: string | null;
  memberCount?: number;
  onlineCount?: number;
  /** Opens chat overview when the avatar/title area is clicked */
  onIdentityClick?: () => void;
  /** Opens personal chat theme picker */
  onThemeClick?: () => void;
}) {
  const displayName = isGroup
    ? title || (isLoading ? "" : "Group")
    : otherUser?.fullname || otherUser?.username || (isLoading ? "" : "Chat");

  const initial = (displayName || "?").slice(0, 1).toUpperCase();

  const effectiveTyping =
    typingUsers.length > 0
      ? typingUsers
      : peerTyping && otherUser
        ? [
            {
              userId: otherUser._id,
              fullname: otherUser.fullname,
              username: otherUser.username,
            },
          ]
        : [];

  let statusLine: string | null = formatTypingLine(
    effectiveTyping,
    !!isGroup,
    otherUser?.fullname || otherUser?.username
  );

  if (!statusLine) {
    if (isGroup) {
      const members = memberCount ?? 0;
      if (typeof onlineCount === "number" && onlineCount > 0) {
        statusLine = `${members} members · ${onlineCount} online`;
      } else if (members > 0) {
        statusLine = `${members} members`;
      }
    } else if (presence?.online) {
      statusLine = "Online";
    } else if (presence) {
      statusLine = formatLastSeen(presence.lastSeenAt);
    } else if (otherUser?.username) {
      statusLine = `@${otherUser.username}`;
    }
  }

  const isTyping = effectiveTyping.length > 0;
  const showOnlineDot = !isGroup && !!presence?.online;
  const canOpenOverview = !!onIdentityClick && !isLoading;

  const identityInner = (
    <>
      <div className="relative shrink-0">
        {isGroup ? (
          <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <Users size={18} aria-hidden />
          </div>
        ) : (
          <Avatar className="size-10">
            <AvatarImage
              src={otherUser?.avatar || undefined}
              alt={displayName}
            />
            <AvatarFallback className="text-sm">{initial}</AvatarFallback>
          </Avatar>
        )}
        {showOnlineDot ? (
          <span
            className="absolute bottom-0 end-0 size-2.5 rounded-full border-2 border-background bg-emerald-500"
            aria-hidden
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1 text-start">
        <p className="truncate text-base font-semibold leading-tight tracking-tight sm:text-lg">
          {displayName || "Chat"}
        </p>
        {statusLine ? (
          <p
            className={
              isTyping || (!isGroup && presence?.online)
                ? "truncate text-xs leading-tight text-[var(--chat-accent,var(--primary))]"
                : "truncate text-xs leading-tight text-muted-foreground"
            }
            aria-live="polite"
          >
            {statusLine}
          </p>
        ) : null}
      </div>
    </>
  );

  return (
    <header className="sticky top-0 z-20 flex shrink-0 items-center gap-1 border-b border-border/50 bg-[color-mix(in_oklab,var(--chat-surface-base,var(--background))_85%,transparent)] px-2 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--chat-surface-base,var(--background))_70%,transparent)] lg:px-4">
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="size-10 shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        aria-label="Back to messages"
      >
        <Link href="/messages">
          <ArrowLeft size={20} />
        </Link>
      </Button>

      {isLoading && !displayName ? (
        <div className="flex min-w-0 flex-1 items-center gap-3" aria-hidden>
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted/70" />
          </div>
        </div>
      ) : canOpenOverview ? (
        <button
          type="button"
          onClick={onIdentityClick}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-0.5 text-start transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={
            isGroup
              ? `View group info for ${displayName || "group"}`
              : `View contact info for ${displayName || "chat"}`
          }
        >
          {identityInner}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 px-1">
          {identityInner}
        </div>
      )}

      {onThemeClick && !isLoading ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Change chat theme"
          onClick={onThemeClick}
        >
          <Palette size={18} aria-hidden />
        </Button>
      ) : null}
    </header>
  );
}
