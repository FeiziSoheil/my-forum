"use client";

import { api } from "@/lib/api/axios";
import { applySharedThemeLocally } from "@/hook/useChatTheme";
import type { Conversation } from "@/types/chat";
import type {
  PendingThemeProposal,
  SharedChatTheme,
  ThemeProposalPreview,
} from "@/types/chatTheme";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useProposeChatTheme(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (form: FormData) => {
      const res = await api.post(
        `/conversations/${conversationId}/theme/propose`,
        form
      );
      return res.data as {
        proposed?: boolean;
        applied?: boolean;
        sharedTheme?: SharedChatTheme;
        proposal?: ThemeProposalPreview;
      };
    },
    onSuccess: (data) => {
      if (data.sharedTheme) {
        applySharedThemeLocally(conversationId, data.sharedTheme);
        queryClient.setQueryData(["conversation", conversationId], (old: unknown) =>
          old && typeof old === "object"
            ? {
                ...old,
                sharedTheme: data.sharedTheme,
                pendingThemeProposal: null,
              }
            : old
        );
      } else if (data.proposal) {
        const conv = queryClient.getQueryData<Conversation>([
          "conversation",
          conversationId,
        ]);
        const pending: PendingThemeProposal = {
          _id: data.proposal._id,
          status: "pending",
          themeId: data.proposal.themeId,
          blur: data.proposal.blur,
          dim: data.proposal.dim,
          wallpaperUrl: data.proposal.wallpaperUrl ?? null,
          conversation: data.proposal.conversation || conversationId,
          from: "",
          to: conv?.otherUser?._id ?? "",
          isIncoming: false,
        };
        queryClient.setQueryData<Conversation>(
          ["conversation", conversationId],
          (old) =>
            old ? { ...old, pendingThemeProposal: pending } : old
        );
      }
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useRespondChatThemeProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      proposalId,
      action,
    }: {
      conversationId: string;
      proposalId: string;
      action: "accept" | "reject";
    }) => {
      const res = await api.post(
        `/conversations/${conversationId}/theme/proposals/${proposalId}/${action}`
      );
      return {
        action,
        conversationId,
        ...(res.data as {
          accepted?: boolean;
          rejected?: boolean;
          sharedTheme?: SharedChatTheme;
        }),
      };
    },
    onSuccess: (data) => {
      if (data.action === "accept" && data.sharedTheme) {
        applySharedThemeLocally(data.conversationId, data.sharedTheme);
        queryClient.setQueryData(
          ["conversation", data.conversationId],
          (old: unknown) =>
            old && typeof old === "object"
              ? {
                  ...old,
                  sharedTheme: data.sharedTheme,
                  pendingThemeProposal: null,
                }
              : old
        );
      } else {
        queryClient.setQueryData(
          ["conversation", data.conversationId],
          (old: unknown) =>
            old && typeof old === "object"
              ? { ...old, pendingThemeProposal: null }
              : old
        );
      }
      queryClient.invalidateQueries({
        queryKey: ["conversation", data.conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}
