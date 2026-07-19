import { PRESENCE_ONLINE_MS } from "@/lib/presence/constants";
import type { PresenceStatus } from "@/types/chat";

export function presenceFromLastSeen(
  lastSeenAt: Date | string | null | undefined,
  now = Date.now()
): PresenceStatus {
  if (!lastSeenAt) {
    return { online: false, lastSeenAt: null };
  }
  const ts =
    typeof lastSeenAt === "string" ? new Date(lastSeenAt).getTime() : lastSeenAt.getTime();
  if (Number.isNaN(ts)) {
    return { online: false, lastSeenAt: null };
  }
  return {
    online: now - ts < PRESENCE_ONLINE_MS,
    lastSeenAt: new Date(ts).toISOString(),
  };
}

/** Relative "Last seen …" label for ChatHeader. */
export function formatLastSeen(lastSeenAt: string | Date | null | undefined): string {
  if (!lastSeenAt) return "Offline";
  const ts =
    typeof lastSeenAt === "string" ? new Date(lastSeenAt).getTime() : lastSeenAt.getTime();
  if (Number.isNaN(ts)) return "Offline";

  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "Last seen just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `Last seen ${diffMin}m ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `Last seen ${diffHr}h ago`;
  }
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) {
    return `Last seen ${diffDay}d ago`;
  }
  return `Last seen ${new Date(ts).toLocaleDateString()}`;
}
