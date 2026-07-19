"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useRespondChatThemeProposal } from "@/hook/useChatThemeShare";
import {
  useMarkNotificationsRead,
  useNotifications,
} from "@/hook/useNotifications";
import { getChatThemePack } from "@/lib/chat/themes";
import type { ChatUser } from "@/types/chat";
import type { PendingThemeProposal } from "@/types/chatTheme";
import { Loader2, Palette } from "lucide-react";
import { toast } from "sonner";

type ThemeProposalBannerProps = {
  conversationId: string;
  proposal: PendingThemeProposal;
  peer?: ChatUser | null;
};

export default function ThemeProposalBanner({
  conversationId,
  proposal,
  peer,
}: ThemeProposalBannerProps) {
  const respond = useRespondChatThemeProposal();
  const { data: notificationsData } = useNotifications(proposal.isIncoming);
  const markRead = useMarkNotificationsRead();
  const markedRef = useRef<string | null>(null);

  const peerName =
    peer?.fullname?.split(/\s+/)[0] || peer?.username || "Them";
  const pack = getChatThemePack(proposal.themeId);

  // Mark related Activity notifications as read when the banner is visible
  useEffect(() => {
    if (!proposal.isIncoming) return;
    if (markedRef.current === proposal._id) return;
    const list = notificationsData?.notifications ?? [];
    const unreadIds = list
      .filter(
        (n) =>
          n.type === "theme_proposal" &&
          !n.read &&
          String(n.conversation) === conversationId
      )
      .map((n) => n._id);
    if (unreadIds.length === 0) return;
    markedRef.current = proposal._id;
    markRead.mutate(unreadIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mark once per proposal
  }, [proposal.isIncoming, proposal._id, conversationId, notificationsData?.notifications]);

  const handleRespond = async (action: "accept" | "reject") => {
    try {
      await respond.mutateAsync({
        conversationId,
        proposalId: proposal._id,
        action,
      });
      toast.success(
        action === "accept" ? "Chat theme applied" : "Theme invite declined"
      );
    } catch {
      toast.error(
        action === "accept" ? "Could not accept theme" : "Could not decline theme"
      );
    }
  };

  return (
    <div className="border-t border-[color:var(--chat-chrome-border,var(--border))] bg-[color:var(--chat-surface-base,var(--background))]/95 px-3 py-2.5 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div
          className="relative mt-0.5 size-10 shrink-0 overflow-hidden rounded-lg border border-[color:var(--chat-chrome-border,var(--border))]"
          style={{ background: pack.preview.surface }}
          aria-hidden
        >
          {proposal.wallpaperUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proposal.wallpaperUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
              style={{ filter: `blur(${Math.min(proposal.blur, 4)}px)` }}
            />
          ) : (
            <div className="absolute inset-0 flex">
              <span
                className="w-1/2"
                style={{ background: pack.preview.mine }}
              />
              <span
                className="w-1/2"
                style={{ background: pack.preview.theirs }}
              />
            </div>
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/25">
            <Palette className="size-4 text-white drop-shadow" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          {proposal.isIncoming ? (
            <>
              <p className="text-sm leading-snug text-[color:var(--chat-chrome-fg,var(--foreground))]">
                <span className="font-medium">{peerName}</span>{" "}
                <span className="text-[color:var(--chat-chrome-muted,var(--muted-foreground))]">
                  wants to share a chat theme
                </span>
              </p>
              <p className="mt-0.5 text-xs text-[color:var(--chat-chrome-muted,var(--muted-foreground))]">
                {pack.name}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-full px-4"
                  disabled={respond.isPending}
                  onClick={() => void handleRespond("accept")}
                >
                  {respond.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    "Accept"
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full px-4"
                  disabled={respond.isPending}
                  onClick={() => void handleRespond("reject")}
                >
                  Reject
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm leading-snug text-[color:var(--chat-chrome-fg,var(--foreground))]">
                Theme invite sent
              </p>
              <p className="mt-0.5 text-xs text-[color:var(--chat-chrome-muted,var(--muted-foreground))]">
                Waiting for {peerName} to accept · {pack.name}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
