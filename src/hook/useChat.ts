"use client";

import { api } from "@/lib/api/axios";
import {
  PRESENCE_HEARTBEAT_MS,
  TYPING_IDLE_MS,
} from "@/lib/presence/constants";
import {
  ChatMessage,
  ChatUser,
  Conversation,
  MessagesPage,
  PresenceStatus,
  TypingStatus,
  TypingUser,
} from "@/types/chat";
import type {
  PendingThemeProposal,
  SharedChatTheme,
} from "@/types/chatTheme";
import { applySharedThemeLocally } from "@/hook/useChatTheme";
import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await api.get("/conversations");
      return res.data.conversations as Conversation[];
    },
    enabled,
  });
}

export function useConversation(conversationId: string) {
  return useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const res = await api.get(`/conversations/${conversationId}`);
      return res.data.conversation as Conversation;
    },
    enabled: !!conversationId,
  });
}

export function useUserSearch(q: string) {
  return useQuery({
    queryKey: ["users-search", q],
    queryFn: async () => {
      const res = await api.get("/users/search", { params: { q } });
      return res.data.users as ChatUser[];
    },
    enabled: q.trim().length >= 1,
  });
}

export function useStartConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.post("/conversations", { userId });
      return res.data.conversation as Conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useCreateGroupConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      title,
      participantIds,
    }: {
      title: string;
      participantIds: string[];
    }) => {
      const res = await api.post("/conversations", {
        type: "group",
        title,
        participantIds,
      });
      return res.data.conversation as Conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

function upsertConversationCache(
  queryClient: ReturnType<typeof useQueryClient>,
  conversation: Conversation
) {
  queryClient.setQueryData(["conversation", conversation._id], conversation);
  queryClient.setQueryData<Conversation[]>(["conversations"], (old) => {
    if (!old) return old;
    const idx = old.findIndex((c) => c._id === conversation._id);
    if (idx === -1) return [conversation, ...old];
    const next = [...old];
    next[idx] = { ...next[idx], ...conversation };
    return next;
  });
}

export function useUpdateGroupTitle(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title: string) => {
      const res = await api.patch(`/conversations/${conversationId}`, {
        title,
      });
      return res.data.conversation as Conversation;
    },
    onSuccess: (conversation) => {
      upsertConversationCache(queryClient, conversation);
    },
  });
}

export function useAddGroupMembers(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const res = await api.post(
        `/conversations/${conversationId}/members`,
        { userIds }
      );
      return res.data.conversation as Conversation;
    },
    onSuccess: (conversation) => {
      upsertConversationCache(queryClient, conversation);
    },
  });
}

export function useRemoveGroupMember(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.delete(
        `/conversations/${conversationId}/members/${userId}`
      );
      return {
        conversation: res.data.conversation as Conversation | undefined,
        left: !!res.data.left,
        dissolved: !!res.data.dissolved,
        userId,
      };
    },
    onSuccess: ({ conversation, left, dissolved }) => {
      if (left || dissolved) {
        queryClient.removeQueries({
          queryKey: ["conversation", conversationId],
        });
        queryClient.setQueryData<Conversation[]>(["conversations"], (old) =>
          old ? old.filter((c) => c._id !== conversationId) : old
        );
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        return;
      }
      if (conversation) {
        upsertConversationCache(queryClient, conversation);
      }
    },
  });
}

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: "30" };
      if (pageParam) params.cursor = pageParam as string;
      const res = await api.get(`/conversations/${conversationId}/messages`, {
        params,
      });
      return res.data as MessagesPage;
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: undefined as string | undefined,
    enabled: !!conversationId,
    refetchInterval: (query) => {
      return query.state.error ? 5000 : false;
    },
  });
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      content,
      media,
      replyTo,
      sharedPostId,
    }: {
      content?: string;
      media?: File[];
      replyTo?: string;
      sharedPostId?: string;
    }) => {
      if (sharedPostId && !media?.length) {
        const res = await api.post(`/conversations/${conversationId}/messages`, {
          content: content || "",
          replyTo,
          sharedPostId,
        });
        return res.data.message as ChatMessage;
      }

      const formData = new FormData();
      if (content) formData.append("content", content);
      if (replyTo) formData.append("replyTo", replyTo);
      if (sharedPostId) formData.append("sharedPostId", sharedPostId);
      if (media) {
        for (const file of media) {
          formData.append("media", file);
        }
      }
      const res = await api.post(
        `/conversations/${conversationId}/messages`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return res.data.message as ChatMessage;
    },
    onSuccess: (message) => {
      appendMessageToCache(queryClient, conversationId, message);
    },
  });
}

export function useReactToMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      emoji,
      remove,
    }: {
      messageId: string;
      emoji: string;
      remove?: boolean;
    }) => {
      if (remove) {
        const res = await api.delete(
          `/conversations/${conversationId}/messages/${messageId}/react`,
          { data: { emoji } }
        );
        return res.data.message as ChatMessage;
      }
      const res = await api.post(
        `/conversations/${conversationId}/messages/${messageId}/react`,
        { emoji }
      );
      return res.data.message as ChatMessage;
    },
    onSuccess: (message) => {
      upsertMessageInCache(queryClient, conversationId, message);
    },
  });
}

export function useDeleteMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const res = await api.delete(
        `/conversations/${conversationId}/messages/${messageId}`
      );
      return res.data.message as ChatMessage;
    },
    onSuccess: (message) => {
      upsertMessageInCache(queryClient, conversationId, message);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useForwardMessage(sourceConversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      conversationId,
    }: {
      messageId: string;
      conversationId: string;
    }) => {
      const res = await api.post(
        `/conversations/${sourceConversationId}/messages/${messageId}/forward`,
        { conversationId }
      );
      return {
        message: res.data.message as ChatMessage,
        conversationId: res.data.conversationId as string,
      };
    },
    onSuccess: ({ message, conversationId }) => {
      appendMessageToCache(queryClient, conversationId, message);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useSharePostToChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      postId,
      content,
    }: {
      conversationId: string;
      postId: string;
      content?: string;
    }) => {
      const res = await api.post(`/conversations/${conversationId}/messages`, {
        sharedPostId: postId,
        content: content || "",
      });
      return {
        message: res.data.message as ChatMessage,
        conversationId,
      };
    },
    onSuccess: ({ message, conversationId }) => {
      appendMessageToCache(queryClient, conversationId, message);
    },
  });
}

export function useMarkConversationRead(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await api.post(`/conversations/${conversationId}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.setQueryData<Conversation[]>(["conversations"], (old) => {
        if (!old) return old;
        return old.map((c) =>
          c._id === conversationId ? { ...c, unreadCount: 0 } : c
        );
      });
    },
  });
}

/**
 * Heartbeat while the user is on /messages (list or thread).
 * Marks the user online via lastSeenAt; offline after ~55s without beats.
 */
export function usePresenceHeartbeat(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const beat = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void api.post("/presence/heartbeat").catch(() => {
        /* ignore transient errors */
      });
    };

    beat();
    const interval = setInterval(beat, PRESENCE_HEARTBEAT_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
}

/** Notify peers that this user is typing (refreshed while typing, cleared on idle/send). */
export function useTypingEmitter(conversationId: string) {
  const typingRef = useRef(false);
  const lastSentAt = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendTyping = useCallback(
    async (typing: boolean, force = false) => {
      if (!conversationId) return;
      if (!typing && !typingRef.current) return;

      const now = Date.now();
      // Avoid spamming while already typing; refresh TTL at least every ~1.2s
      if (
        typing &&
        typingRef.current &&
        !force &&
        now - lastSentAt.current < 1200
      ) {
        return;
      }

      typingRef.current = typing;
      lastSentAt.current = now;
      try {
        await api.post(`/conversations/${conversationId}/typing`, { typing });
      } catch {
        /* ignore */
      }
    },
    [conversationId]
  );

  const onTypingActivity = useCallback(() => {
    if (!conversationId) return;
    void sendTyping(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      void sendTyping(false, true);
    }, TYPING_IDLE_MS);
  }, [conversationId, sendTyping]);

  const stopTyping = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    void sendTyping(false, true);
  }, [sendTyping]);

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (typingRef.current) {
        void api
          .post(`/conversations/${conversationId}/typing`, { typing: false })
          .catch(() => {});
      }
    };
  }, [conversationId]);

  return { onTypingActivity, stopTyping };
}

function appendMessageToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  message: ChatMessage
) {
  queryClient.setQueryData<InfiniteData<MessagesPage>>(
    ["messages", conversationId],
    (old) => {
      if (!old) {
        return {
          pages: [{ messages: [message], hasMore: false }],
          pageParams: [undefined],
        };
      }
      const already = old.pages.some((p) =>
        p.messages.some((m) => m._id === message._id)
      );
      if (already) return old;

      const pages = [...old.pages];
      pages[0] = {
        ...pages[0],
        messages: [...pages[0].messages, message],
      };
      return { ...old, pages };
    }
  );
  queryClient.invalidateQueries({ queryKey: ["conversations"] });
}

function upsertMessageInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  message: ChatMessage
) {
  queryClient.setQueryData<InfiniteData<MessagesPage>>(
    ["messages", conversationId],
    (old) => {
      if (!old) return old;
      let found = false;
      const pages = old.pages.map((page) => ({
        ...page,
        messages: page.messages.map((m) => {
          if (m._id === message._id) {
            found = true;
            return message;
          }
          return m;
        }),
      }));
      if (!found) return old;
      return { ...old, pages };
    }
  );
}

function setConversationPresence(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  patch: Partial<
    Pick<Conversation, "otherUserPresence" | "onlineCount" | "memberCount">
  >
) {
  queryClient.setQueryData<Conversation>(
    ["conversation", conversationId],
    (old) => (old ? { ...old, ...patch } : old)
  );
}

/** SSE stream for new messages + reaction updates + presence + typing */
export function useConversationStream(
  conversationId: string,
  enabled = true
) {
  const queryClient = useQueryClient();
  const lastIdRef = useRef<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  useEffect(() => {
    if (!enabled || !conversationId) return;

    setTypingUsers([]);

    const data = queryClient.getQueryData<InfiniteData<MessagesPage>>([
      "messages",
      conversationId,
    ]);
    if (data?.pages?.length) {
      const all = data.pages.flatMap((p) => p.messages);
      if (all.length > 0) {
        lastIdRef.current = all[all.length - 1]._id;
      }
    }

    const since = lastIdRef.current
      ? `?since=${lastIdRef.current}`
      : "";
    const es = new EventSource(
      `/api/conversations/${conversationId}/stream${since}`
    );

    const onMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as ChatMessage;
        lastIdRef.current = message._id;
        appendMessageToCache(queryClient, conversationId, message);
        setTypingUsers([]);
      } catch {
        /* ignore malformed */
      }
    };

    const onReaction = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as ChatMessage;
        upsertMessageInCache(queryClient, conversationId, message);
      } catch {
        /* ignore malformed */
      }
    };

    const onDeleted = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as ChatMessage;
        upsertMessageInCache(queryClient, conversationId, message);
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      } catch {
        /* ignore malformed */
      }
    };

    const onPresence = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as PresenceStatus & {
          userId?: string;
          onlineCount?: number;
          memberCount?: number;
        };
        if (typeof data.onlineCount === "number") {
          setConversationPresence(queryClient, conversationId, {
            onlineCount: data.onlineCount,
            memberCount: data.memberCount,
          });
        } else {
          setConversationPresence(queryClient, conversationId, {
            otherUserPresence: {
              online: !!data.online,
              lastSeenAt: data.lastSeenAt ?? null,
            },
          });
        }
      } catch {
        /* ignore malformed */
      }
    };

    const onTyping = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as TypingStatus;
        if (Array.isArray(data.users)) {
          setTypingUsers(data.typing === false ? [] : data.users);
        } else if (data.typing && data.userId) {
          setTypingUsers([{ userId: data.userId }]);
        } else {
          setTypingUsers([]);
        }
      } catch {
        /* ignore malformed */
      }
    };

    const onTheme = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as
          | SharedChatTheme
          | { sharedTheme: null };
        const shared =
          data && "sharedTheme" in data && data.sharedTheme === null
            ? null
            : (data as SharedChatTheme);

        if (shared?.themeId && shared.acceptedAt) {
          applySharedThemeLocally(conversationId, shared);
          queryClient.setQueryData<Conversation>(
            ["conversation", conversationId],
            (old) =>
              old
                ? {
                    ...old,
                    sharedTheme: shared,
                    pendingThemeProposal: null,
                  }
                : old
          );
        } else {
          queryClient.setQueryData<Conversation>(
            ["conversation", conversationId],
            (old) => (old ? { ...old, sharedTheme: null } : old)
          );
        }
      } catch {
        /* ignore malformed */
      }
    };

    const onThemeProposal = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as {
          pendingThemeProposal?: PendingThemeProposal | null;
        };
        queryClient.setQueryData<Conversation>(
          ["conversation", conversationId],
          (old) =>
            old
              ? {
                  ...old,
                  pendingThemeProposal: data.pendingThemeProposal ?? null,
                }
              : old
        );
        if (data.pendingThemeProposal?.isIncoming) {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({
            queryKey: ["notifications", "unread-count"],
          });
        }
      } catch {
        /* ignore malformed */
      }
    };

    es.addEventListener("message", onMessage);
    es.addEventListener("reaction", onReaction);
    es.addEventListener("deleted", onDeleted);
    es.addEventListener("presence", onPresence);
    es.addEventListener("typing", onTyping);
    es.addEventListener("theme", onTheme);
    es.addEventListener("theme_proposal", onThemeProposal);

    let errorInvalidateTimer: ReturnType<typeof setTimeout> | null = null;
    es.onerror = () => {
      if (errorInvalidateTimer) return;
      errorInvalidateTimer = setTimeout(() => {
        errorInvalidateTimer = null;
        queryClient.invalidateQueries({
          queryKey: ["messages", conversationId],
        });
      }, 8000);
    };

    return () => {
      if (errorInvalidateTimer) clearTimeout(errorInvalidateTimer);
      es.removeEventListener("message", onMessage);
      es.removeEventListener("reaction", onReaction);
      es.removeEventListener("deleted", onDeleted);
      es.removeEventListener("presence", onPresence);
      es.removeEventListener("typing", onTyping);
      es.removeEventListener("theme", onTheme);
      es.removeEventListener("theme_proposal", onThemeProposal);
      es.close();
      setTypingUsers([]);
    };
  }, [conversationId, enabled, queryClient]);

  return {
    typingUsers,
    /** @deprecated use typingUsers — true when anyone else is typing */
    peerTyping: typingUsers.length > 0,
  };
}
