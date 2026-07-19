"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AtSign,
  Heart,
  Loader2,
  Mail,
  MessageCircle,
  Palette,
  Repeat2,
  UserPlus,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PullToRefresh from "@/components/PullToRefresh";
import { Button } from "@/components/ui/button";
import {
  useMarkNotificationsRead,
  useNotifications,
} from "@/hook/useNotifications";
import {
  useFollowRequests,
  useRespondFollowRequest,
  FollowRequestItem,
} from "@/hook/useFollow";
import { useRespondChatThemeProposal } from "@/hook/useChatThemeShare";
import {
  Notification,
  NotificationType,
} from "@/types/notification";
import { toast } from "sonner";

type FilterTab =
  | "all"
  | "likes"
  | "replies"
  | "mentions"
  | "follows"
  | "reposts"
  | "messages";

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "likes", label: "Likes" },
  { id: "replies", label: "Replies" },
  { id: "mentions", label: "Mentions" },
  { id: "follows", label: "Follows" },
  { id: "reposts", label: "Reposts" },
  { id: "messages", label: "Messages" },
];

const LIKE_TYPES: NotificationType[] = ["like_post", "like_reply", "like_story"];
const FOLLOW_TYPES: NotificationType[] = [
  "follow",
  "follow_request",
  "follow_accepted",
];

type TimeGroupId = "today" | "yesterday" | "this_week" | "earlier";

const TIME_GROUP_LABELS: Record<TimeGroupId, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This week",
  earlier: "Earlier",
};

const TIME_GROUP_ORDER: TimeGroupId[] = [
  "today",
  "yesterday",
  "this_week",
  "earlier",
];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getTimeGroup(date: Date | string, now = new Date()): TimeGroupId {
  const d = typeof date === "string" ? new Date(date) : date;
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  if (d >= todayStart) return "today";
  if (d >= yesterdayStart) return "yesterday";
  if (d >= weekStart) return "this_week";
  return "earlier";
}

function formatRelativeTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function actionText(type: NotificationType) {
  switch (type) {
    case "like_post":
      return "liked your post";
    case "like_reply":
      return "liked your reply";
    case "like_story":
      return "liked your story";
    case "repost":
      return "reposted your post";
    case "follow":
      return "followed you";
    case "follow_request":
      return "requested to follow you";
    case "follow_accepted":
      return "accepted your follow request";
    case "reply":
      return "replied to your post";
    case "story_reply":
      return "replied to your story";
    case "mention":
      return "mentioned you";
    case "message":
      return "sent you a message";
    case "theme_proposal":
      return "wants to share a chat theme";
    case "theme_accepted":
      return "accepted your chat theme";
    default:
      return "interacted with you";
  }
}

function TypeIcon({ type }: { type: NotificationType }) {
  const className = "size-3.5 text-primary";
  switch (type) {
    case "like_post":
    case "like_reply":
    case "like_story":
      return <Heart className={className} fill="currentColor" />;
    case "repost":
      return <Repeat2 className={className} />;
    case "follow":
    case "follow_request":
    case "follow_accepted":
      return <UserPlus className={className} />;
    case "reply":
    case "story_reply":
      return <MessageCircle className={className} />;
    case "mention":
      return <AtSign className={className} />;
    case "message":
      return <Mail className={className} />;
    case "theme_proposal":
    case "theme_accepted":
      return <Palette className={className} />;
    default:
      return <Heart className={className} />;
  }
}

function notificationHref(n: Notification) {
  if (
    n.type === "follow" ||
    n.type === "follow_request" ||
    n.type === "follow_accepted"
  ) {
    return `/profile/${n.actor.username}`;
  }
  if (n.type === "like_story" || n.type === "story_reply") {
    return `/profile/${n.actor.username}`;
  }
  if (n.type === "message" || n.type === "theme_proposal" || n.type === "theme_accepted") {
    return n.conversation
      ? `/messages/${n.conversation}`
      : `/profile/${n.actor.username}`;
  }
  const postId =
    typeof n.post === "object" && n.post ? n.post._id : (n.post as string | null);
  if (postId) return `/post/${postId}`;
  return `/profile/${n.actor.username}`;
}

function postSnippet(n: Notification) {
  if (typeof n.post === "object" && n.post?.content) {
    const text = n.post.content.trim();
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  }
  return null;
}

function matchesFilter(n: Notification, filter: FilterTab) {
  if (filter === "all") return true;
  if (filter === "likes") return LIKE_TYPES.includes(n.type);
  if (filter === "replies") return n.type === "reply" || n.type === "story_reply";
  if (filter === "mentions") return n.type === "mention";
  if (filter === "follows") return FOLLOW_TYPES.includes(n.type);
  if (filter === "reposts") return n.type === "repost";
  if (filter === "messages") return n.type === "message";
  return true;
}

function emptyCopy(filter: FilterTab) {
  switch (filter) {
    case "likes":
      return {
        title: "No likes yet",
        body: "When someone likes your posts or replies, you’ll see it here",
      };
    case "replies":
      return {
        title: "No replies yet",
        body: "Replies to your posts will show up here",
      };
    case "mentions":
      return {
        title: "No mentions yet",
        body: "When someone tags you with @username, you’ll see it here",
      };
    case "follows":
      return {
        title: "No followers yet",
        body: "New followers and follow requests will show up here",
      };
    case "reposts":
      return {
        title: "No reposts yet",
        body: "When someone reposts your content, you’ll see it here",
      };
    case "messages":
      return {
        title: "No messages yet",
        body: "When someone sends you a direct message, you’ll see it here",
      };
    default:
      return {
        title: "No activity yet",
        body: "Likes, follows, replies, and mentions will show up here",
      };
  }
}

/**
 * Live FollowRequest id when the request is still pending (doc exists).
 * Returns null once the request was accepted/rejected (populated to null),
 * so the inline Accept/Reject actions stay hidden across refreshes.
 */

function themeProposalMeta(n: Notification): {
  proposalId: string;
  conversationId: string;
} | null {
  const tp = n.themeProposal;
  if (!tp || typeof tp === "string") {
    if (typeof tp === "string" && n.conversation) {
      return { proposalId: tp, conversationId: String(n.conversation) };
    }
    return null;
  }
  const proposalId = tp._id;
  const conversationId =
    (typeof tp.conversation === "string" && tp.conversation) ||
    (typeof n.conversation === "string" ? n.conversation : null);
  if (!proposalId || !conversationId) return null;
  return { proposalId, conversationId };
}

function followRequestId(n: Notification): string | null {
  const fr = n.followRequest;
  if (!fr) return null;
  if (typeof fr === "string") return fr;
  return fr._id ?? null;
}

export default function LikesPage() {
  const { data, isLoading, isError, refetch } = useNotifications();
  const { data: followRequests = [], refetch: refetchFollowRequests } =
    useFollowRequests();
  const markRead = useMarkNotificationsRead();
  const [filter, setFilter] = useState<FilterTab>("all");
  /** Locally hide Accept/Reject after a successful response for this notification. */
  const [resolvedRequests, setResolvedRequests] = useState<Set<string>>(
    () => new Set()
  );
  const [dismissedRequestIds, setDismissedRequestIds] = useState<Set<string>>(
    () => new Set()
  );

  const handlePullRefresh = useCallback(async () => {
    await Promise.all([refetch(), refetchFollowRequests()]);
  }, [refetch, refetchFollowRequests]);

  useEffect(() => {
    if ((data?.unreadCount ?? 0) > 0 && !markRead.isPending) {
      markRead.mutate(undefined);
    }
    // Mark as read when unread notifications are loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.unreadCount]);

  const pendingRequests = useMemo(
    () => followRequests.filter((r) => !dismissedRequestIds.has(r._id)),
    [followRequests, dismissedRequestIds]
  );

  const showFollowRequestsInbox =
    pendingRequests.length > 0 &&
    (filter === "all" || filter === "follows");

  const notifications = data?.notifications ?? [];
  const filtered = useMemo(
    () => notifications.filter((n) => matchesFilter(n, filter)),
    [notifications, filter]
  );

  const grouped = useMemo(() => {
    const map = new Map<TimeGroupId, Notification[]>();
    for (const id of TIME_GROUP_ORDER) map.set(id, []);
    for (const n of filtered) {
      const group = getTimeGroup(n.createdAt);
      map.get(group)!.push(n);
    }
    return TIME_GROUP_ORDER.map((id) => ({
      id,
      label: TIME_GROUP_LABELS[id],
      items: map.get(id)!,
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  const empty = emptyCopy(filter);
  const showEmpty =
    filtered.length === 0 && !showFollowRequestsInbox;

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
      <main className="mx-auto min-h-[calc(100dvh-8rem)] w-full max-w-xl pb-24 lg:max-w-2xl lg:pb-10 xl:max-w-3xl">
        <div className="sticky top-14 z-30 border-b border-border bg-background px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight">Activity</h1>
          <div className="mt-3 flex gap-1 overflow-x-auto">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="px-4 py-10 text-center text-sm text-destructive">
            Failed to load activity
          </p>
        ) : showEmpty ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Heart className="size-10 text-muted-foreground/60" />
            <p className="font-medium">{empty.title}</p>
            <p className="text-sm text-muted-foreground">{empty.body}</p>
          </div>
        ) : (
          <div>
            {showFollowRequestsInbox && (
              <section>
                <h2 className="sticky top-[8.25rem] z-[1] bg-background px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Follow requests
                  <span className="ms-1.5 font-normal normal-case tracking-normal">
                    ({pendingRequests.length})
                  </span>
                </h2>
                <div className="divide-y divide-border/40">
                  {pendingRequests.map((req) => (
                    <FollowRequestRow
                      key={req._id}
                      request={req}
                      onResolved={() =>
                        setDismissedRequestIds((prev) =>
                          new Set(prev).add(req._id)
                        )
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {grouped.map((group) => (
              <section key={group.id}>
                <h2 className="sticky top-[8.25rem] z-[1] bg-background px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h2>
                <div className="divide-y divide-border/40">
                  {group.items.map((n) => (
                    <NotificationRow
                      key={n._id}
                      notification={n}
                      showActions={
                        !resolvedRequests.has(n._id) &&
                        ((n.type === "follow_request" && !!followRequestId(n)) ||
                          (n.type === "theme_proposal" && !!themeProposalMeta(n)))
                      }
                      onResolved={() =>
                        setResolvedRequests((prev) => new Set(prev).add(n._id))
                      }
                      onSelect={() => {
                        if (!n.read) markRead.mutate([n._id]);
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </PullToRefresh>
  );
}

function FollowRequestRow({
  request,
  onResolved,
}: {
  request: FollowRequestItem;
  onResolved: () => void;
}) {
  const respond = useRespondFollowRequest();
  const from = request.from;
  const name = from.fullname || from.username || "Someone";

  const handleRespond = async (
    e: React.MouseEvent,
    action: "accept" | "reject"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await respond.mutateAsync({ id: request._id, action });
      onResolved();
      toast.success(
        action === "accept" ? "Follow request accepted" : "Follow request rejected"
      );
    } catch {
      toast.error(
        action === "accept"
          ? "Could not accept request"
          : "Could not reject request"
      );
    }
  };

  return (
    <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
      <Link href={`/profile/${from.username}`} className="relative shrink-0">
        <Avatar className="size-11">
          <AvatarImage src={from.avatar || undefined} alt={name} />
          <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-0.5 -end-0.5 grid size-5 place-items-center rounded-full border border-background bg-background">
          <UserPlus className="size-3.5 text-primary" />
        </span>
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={`/profile/${from.username}`} className="block">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm leading-snug text-foreground">
              <span className="font-medium">{name}</span>{" "}
              <span className="text-muted-foreground">
                requested to follow you
              </span>
            </p>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelativeTime(request.createdAt)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            @{from.username}
          </p>
        </Link>

        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-full px-4"
            disabled={respond.isPending}
            onClick={(e) => handleRespond(e, "accept")}
          >
            Accept
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full px-4"
            disabled={respond.isPending}
            onClick={(e) => handleRespond(e, "reject")}
          >
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

function NotificationRow({
  notification: n,
  showActions,
  onResolved,
  onSelect,
}: {
  notification: Notification;
  showActions: boolean;
  onResolved: () => void;
  onSelect: () => void;
}) {
  const actor = n.actor;
  const name = actor?.fullname || actor?.username || "Someone";
  const snippet = postSnippet(n);
  const href = notificationHref(n);
  const respondFollow = useRespondFollowRequest();
  const respondTheme = useRespondChatThemeProposal();
  const requestId = followRequestId(n);
  const themeMeta = themeProposalMeta(n);
  const busy = respondFollow.isPending || respondTheme.isPending;

  const handleRespond = async (
    e: React.MouseEvent,
    action: "accept" | "reject"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (n.type === "theme_proposal" && themeMeta) {
        await respondTheme.mutateAsync({
          conversationId: themeMeta.conversationId,
          proposalId: themeMeta.proposalId,
          action,
        });
        onResolved();
        toast.success(
          action === "accept" ? "Chat theme applied" : "Theme invite declined"
        );
        return;
      }
      if (!requestId) return;
      await respondFollow.mutateAsync({ id: requestId, action });
      onResolved();
      toast.success(
        action === "accept" ? "Follow request accepted" : "Follow request rejected"
      );
    } catch {
      toast.error(
        action === "accept"
          ? "Could not accept"
          : "Could not reject"
      );
    }
  };

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
        !n.read ? "bg-primary/5" : ""
      }`}
    >
      <Link
        href={href}
        onClick={onSelect}
        className="relative shrink-0"
      >
        <Avatar className="size-11">
          <AvatarImage src={actor?.avatar || undefined} alt={name} />
          <AvatarFallback>
            {name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-0.5 -end-0.5 grid size-5 place-items-center rounded-full border border-background bg-background">
          <TypeIcon type={n.type} />
        </span>
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={href} onClick={onSelect} className="block">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm leading-snug text-foreground">
              <span className="font-medium">{name}</span>{" "}
              <span className="text-muted-foreground">{actionText(n.type)}</span>
            </p>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelativeTime(n.createdAt)}
            </span>
          </div>
          {snippet && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {snippet}
            </p>
          )}
          {actor?.username && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              @{actor.username}
            </p>
          )}
        </Link>

        {showActions && (
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-full px-4"
              disabled={busy}
              onClick={(e) => handleRespond(e, "accept")}
            >
              Accept
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full px-4"
              disabled={busy}
              onClick={(e) => handleRespond(e, "reject")}
            >
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
