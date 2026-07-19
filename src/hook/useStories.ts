"use client";

import { api } from "@/lib/api/axios";
import {
  StoriesFeedResponse,
  Story,
  StoryGroup,
  StoryViewersResponse,
} from "@/types/story";
import { ChatMessage } from "@/types/chat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useStoriesFeed(enabled = true) {
  return useQuery({
    queryKey: ["stories"],
    queryFn: async () => {
      const res = await api.get("/stories");
      return res.data as StoriesFeedResponse;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      content,
      backgroundColor,
      media,
    }: {
      content?: string;
      backgroundColor?: string;
      media?: File | null;
    }) => {
      const formData = new FormData();
      if (content) formData.append("content", content);
      if (backgroundColor) formData.append("backgroundColor", backgroundColor);
      if (media) formData.append("media", media);
      const res = await api.post("/stories", formData);
      return res.data.story as Story;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      toast.success("Story posted");
    },
    onError: () => {
      toast.error("Failed to post story");
    },
  });
}

export function useDeleteStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      await api.delete(`/stories/${storyId}`);
      return storyId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      toast.success("Story deleted");
    },
    onError: () => {
      toast.error("Failed to delete story");
    },
  });
}

export function useLikeStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      storyId,
      isLiked,
    }: {
      storyId: string;
      isLiked: boolean;
    }) => {
      const res = await api.post(`/stories/${storyId}/like`);
      return {
        storyId,
        liked: res.data.liked as boolean,
        likesCount: res.data.likesCount as number,
        wasLiked: isLiked,
      };
    },
    onMutate: async ({ storyId, isLiked }) => {
      await queryClient.cancelQueries({ queryKey: ["stories"] });
      const prev = queryClient.getQueryData<StoriesFeedResponse>(["stories"]);

      queryClient.setQueryData<StoriesFeedResponse>(["stories"], (old) => {
        if (!old) return old;
        return {
          groups: old.groups.map((g) => ({
            ...g,
            stories: g.stories.map((s) =>
              s._id === storyId
                ? {
                    ...s,
                    isLiked: !isLiked,
                    likesCount: Math.max(
                      0,
                      s.likesCount + (isLiked ? -1 : 1)
                    ),
                  }
                : s
            ),
          })),
        };
      });

      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["stories"], ctx.prev);
      }
      toast.error("Failed to update like");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
    },
  });
}

export function useViewStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      const res = await api.post(`/stories/${storyId}/view`);
      return { storyId, ...res.data };
    },
    onSuccess: ({ storyId }) => {
      queryClient.setQueryData<StoriesFeedResponse>(["stories"], (old) => {
        if (!old) return old;
        return {
          groups: old.groups.map((g) => {
            const stories = g.stories.map((s) =>
              s._id === storyId ? { ...s, hasViewed: true } : s
            );
            return {
              ...g,
              stories,
              hasUnseen: stories.some((s) => !s.hasViewed),
            };
          }),
        };
      });
    },
  });
}

export function useStoryViewers(storyId: string | null, enabled = false) {
  return useQuery({
    queryKey: ["story-viewers", storyId],
    queryFn: async () => {
      const res = await api.get(`/stories/${storyId}/viewers`);
      return res.data as StoryViewersResponse;
    },
    enabled: !!storyId && enabled,
  });
}

export function useReplyToStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      storyId,
      content,
    }: {
      storyId: string;
      content: string;
    }) => {
      const res = await api.post(`/stories/${storyId}/reply`, { content });
      return {
        conversationId: res.data.conversationId as string,
        message: res.data.message as ChatMessage,
      };
    },
    onSuccess: ({ conversationId, message }) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({
        queryKey: ["messages", conversationId],
      });
      // Optimistically prepend if cache exists
      queryClient.setQueryData(["messages", conversationId], (old: unknown) => {
        if (!old || typeof old !== "object" || !("pages" in old)) return old;
        const data = old as {
          pages: { messages: ChatMessage[]; hasMore: boolean; nextCursor?: string }[];
          pageParams: unknown[];
        };
        if (!data.pages.length) return old;
        const pages = [...data.pages];
        pages[0] = {
          ...pages[0],
          messages: [...(pages[0].messages ?? []), message],
        };
        return { ...data, pages };
      });
      toast.success("Reply sent");
    },
    onError: () => {
      toast.error("Failed to send reply");
    },
  });
}

/** Find a group by author id or username from feed data */
export function findStoryGroup(
  groups: StoryGroup[] | undefined,
  opts: { authorId?: string; username?: string }
): StoryGroup | undefined {
  if (!groups) return undefined;
  return groups.find((g) => {
    if (opts.authorId && g.author._id === opts.authorId) return true;
    if (opts.username && g.author.username === opts.username) return true;
    return false;
  });
}
