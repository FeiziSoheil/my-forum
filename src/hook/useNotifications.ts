"use client";

import { api } from "@/lib/api/axios";
import {
  Notification,
  NotificationsResponse,
} from "@/types/notification";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await api.get("/notifications");
      return res.data as NotificationsResponse;
    },
    enabled,
  });
}

export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await api.get("/notifications/unread-count");
      return (res.data.unreadCount as number) ?? 0;
    },
    enabled,
    // Fallback poll; SSE (useNotificationStream) updates the cache when available
    refetchInterval: 60_000,
  });
}

/**
 * SSE stream for realtime unread badge updates.
 * Reconnects with exponential backoff on disconnect; never breaks the page.
 */
export function useNotificationStream(enabled = true) {
  const queryClient = useQueryClient();
  const backoffRef = useRef(1000);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let cancelled = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;

      es = new EventSource(`/api/notifications/stream`);

      es.addEventListener("ready", () => {
        backoffRef.current = 1000;
      });

      es.addEventListener("unread", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as { unreadCount?: number };
          if (typeof data.unreadCount === "number") {
            queryClient.setQueryData(
              ["notifications", "unread-count"],
              data.unreadCount
            );
            // Soft-refresh list so Activity page stays current if open
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }
        } catch {
          /* ignore malformed */
        }
      });

      es.onerror = () => {
        es?.close();
        es = null;
        if (cancelled) return;

        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, 30_000);
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [enabled, queryClient]);
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids?: string[]) => {
      const res = await api.post("/notifications/read", ids ? { ids } : {});
      return res.data as { marked: number };
    },
    onSuccess: (_data, ids) => {
      const markAll = !ids || ids.length === 0;

      queryClient.setQueryData<NotificationsResponse>(
        ["notifications"],
        (prev) => {
          if (!prev) return prev;
          if (markAll) {
            return {
              notifications: prev.notifications.map((n) => ({
                ...n,
                read: true,
              })),
              unreadCount: 0,
            };
          }
          const idSet = new Set(ids);
          let newlyRead = 0;
          const notifications = prev.notifications.map((n) => {
            if (idSet.has(n._id) && !n.read) {
              newlyRead += 1;
              return { ...n, read: true };
            }
            return n;
          });
          return {
            notifications,
            unreadCount: Math.max(0, prev.unreadCount - newlyRead),
          };
        }
      );

      if (markAll) {
        queryClient.setQueryData(["notifications", "unread-count"], 0);
      } else {
        queryClient.setQueryData<number>(
          ["notifications", "unread-count"],
          (prev) => {
            if (typeof prev !== "number") return prev;
            // Approximate; invalidate below for accuracy
            return Math.max(0, prev - (ids?.length ?? 0));
          }
        );
      }

      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export type { Notification };
