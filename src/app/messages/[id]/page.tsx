"use client";

import ChatEmptyState from "@/components/chat/ChatEmptyState";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatOverview from "@/components/chat/ChatOverview";
import ChatSkeleton from "@/components/chat/ChatSkeleton";
import ChatThemePicker from "@/components/chat/ChatThemePicker";
import ForwardMessageModal from "@/components/chat/ForwardMessageModal";
import MessageBubble from "@/components/chat/MessageBubble";
import MessageComposer from "@/components/chat/MessageComposer";
import ThemeProposalBanner from "@/components/chat/ThemeProposalBanner";
import { useAuth } from "@/context/AuthContext";
import {
  useConversation,
  useConversationStream,
  useDeleteMessage,
  useMarkConversationRead,
  useMessages,
  useReactToMessage,
} from "@/hook/useChat";
import { useChatTheme } from "@/hook/useChatTheme";
import { useProposeChatTheme } from "@/hook/useChatThemeShare";
import { getChatPatternImage } from "@/lib/chat/patterns";
import { getChatThemePack } from "@/lib/chat/themes";
import {
  getMessageGroupMeta,
  senderId,
} from "@/lib/chat/messageGroup";
import { ChatMessage, ChatUser } from "@/types/chat";
import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const { user } = useAuth();
  const myId = user?._id;

  const { data: conversation, isLoading: conversationLoading } =
    useConversation(conversationId);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
  } = useMessages(conversationId);

  const { mutate: markRead } = useMarkConversationRead(conversationId);
  const reactToMessage = useReactToMessage(conversationId);
  const deleteMessage = useDeleteMessage(conversationId);
  const { typingUsers } = useConversationStream(
    conversationId,
    !!conversationId
  );
  const isGroup = conversation?.type === "group";
  const isGroupAdmin = !!isGroup && !!conversation?.isAdmin;
  const otherUser: ChatUser | undefined = conversation?.otherUser;

  const {
    themeId,
    setThemeId,
    blur,
    setBlur,
    dim,
    setDim,
    hasWallpaper,
    wallpaperUrl,
    setWallpaperFromFile,
    clearWallpaper,
    resetAll,
    useSharedTheme,
    buildShareFormData,
    uploading,
    followingShared,
    ready: themeReady,
    style: chatThemeStyle,
  } = useChatTheme(conversationId, conversation?.sharedTheme, {
    // Non-admin members always follow the admin's group theme
    forceShared: !!isGroup && !isGroupAdmin,
  });

  const proposeTheme = useProposeChatTheme(conversationId);
  const themeSyncSkipRef = useRef(true);

  // After load settles, allow admin auto-sync (avoids re-pushing on open)
  useEffect(() => {
    themeSyncSkipRef.current = true;
    if (!themeReady) return;
    const t = setTimeout(() => {
      themeSyncSkipRef.current = false;
    }, 1200);
    return () => clearTimeout(t);
  }, [conversationId, themeReady]);

  // Group admin: any theme change syncs to everyone automatically
  useEffect(() => {
    if (!isGroupAdmin || !themeReady || uploading) return;
    if (themeSyncSkipRef.current) return;
    if (proposeTheme.isPending) return;

    const shared = conversation?.sharedTheme;
    const needsWallpaperUpload =
      hasWallpaper && !!wallpaperUrl && wallpaperUrl.startsWith("blob:");
    const matchesShared =
      !!shared &&
      shared.themeId === themeId &&
      shared.blur === blur &&
      shared.dim === dim &&
      !needsWallpaperUpload &&
      ((hasWallpaper && !!shared.wallpaperUrl) ||
        (!hasWallpaper && !shared.wallpaperUrl));

    if (matchesShared) return;

    const t = setTimeout(() => {
      void (async () => {
        try {
          const form = await buildShareFormData();
          await proposeTheme.mutateAsync(form);
        } catch {
          /* keep local; retry on next change */
        }
      })();
    }, 750);

    return () => clearTimeout(t);
  }, [
    isGroupAdmin,
    themeReady,
    uploading,
    themeId,
    blur,
    dim,
    hasWallpaper,
    wallpaperUrl,
    conversation?.sharedTheme,
    buildShareFormData,
    proposeTheme.isPending,
    proposeTheme.mutateAsync,
  ]);

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [forwardTarget, setForwardTarget] = useState<ChatMessage | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);
  const markedOnOpenRef = useRef<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOverviewOpen(false);
    setThemePickerOpen(false);
  }, [conversationId]);

  // Keep the chat shell pinned: focusing the composer (e.g. reply) can scroll
  // the document, and after canceling reply that offset often remains as a
  // blank gap under the input.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [conversationId]);

  const cancelReply = useCallback(() => {
    setReplyTo(null);
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
      window.scrollTo(0, 0);
    });
  }, []);

  const messages = useMemo(() => {
    if (!data?.pages) return [] as ChatMessage[];
    return [...data.pages].reverse().flatMap((p) => p.messages);
  }, [data]);

  useEffect(() => {
    if (!conversationId || markedOnOpenRef.current === conversationId) return;
    markedOnOpenRef.current = conversationId;
    markRead();
  }, [conversationId, markRead]);

  useEffect(() => {
    if (!conversationId || !myId || messages.length === 0) return;
    if (markedOnOpenRef.current !== conversationId) return;
    const last = messages[messages.length - 1];
    if (senderId(last.sender) === myId) return;
    const t = setTimeout(() => markRead(), 600);
    return () => clearTimeout(t);
  }, [conversationId, messages, myId, markRead]);

  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLenRef.current = messages.length;
  }, [messages.length]);

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    []
  );

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    if (el.scrollTop < 80) {
      const prevHeight = el.scrollHeight;
      fetchNextPage().then(() => {
        requestAnimationFrame(() => {
          if (scrollerRef.current) {
            scrollerRef.current.scrollTop =
              scrollerRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    try {
      await reactToMessage.mutateAsync({ messageId, emoji });
    } catch {
      toast.error("Failed to update reaction");
    }
  };

  const handleDelete = async (message: ChatMessage) => {
    if (message.isDeleted) return;
    try {
      await deleteMessage.mutateAsync(message._id);
      if (replyTo?._id === message._id) cancelReply();
      toast.success("Message deleted");
    } catch {
      toast.error("Failed to delete message");
    }
  };

  const jumpToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) {
      toast.message("Original message isn’t loaded yet");
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(messageId);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 1400);
  }, []);

  const showSkeleton = isLoading && messages.length === 0;

  return (
    <main
      className="chat-themed mx-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden bg-[var(--chat-surface-base,var(--background))] lg:mx-0 lg:h-full lg:max-h-none lg:max-w-none"
      style={chatThemeStyle}
      data-chat-theme={themeId}
    >
      <ChatHeader
        otherUser={otherUser}
        presence={conversation?.otherUserPresence}
        typingUsers={typingUsers}
        isLoading={conversationLoading && !conversation}
        isGroup={isGroup}
        title={conversation?.title}
        memberCount={conversation?.memberCount}
        onlineCount={conversation?.onlineCount}
        onIdentityClick={
          conversation ? () => setOverviewOpen(true) : undefined
        }
        onThemeClick={
          conversation ? () => setThemePickerOpen(true) : undefined
        }
      />

      {showSkeleton ? (
        <ChatSkeleton />
      ) : (
        <>
          <div className="relative min-h-0 flex-1">
            {wallpaperUrl ? (
              <div className="chat-wallpaper-layer" aria-hidden>
                <div
                  className="chat-wallpaper-image"
                  style={{
                    backgroundImage: `url(${wallpaperUrl})`,
                    filter: `blur(${blur}px)`,
                  }}
                />
                <div
                  className="chat-wallpaper-dim"
                  style={{ opacity: dim / 100 }}
                />
              </div>
            ) : (
              <>
                <div className="chat-surface-base" aria-hidden />
                <div
                  className="chat-pattern-layer"
                  style={{
                    backgroundImage: getChatPatternImage(
                      themeId,
                      getChatThemePack(themeId).vars.patternColor
                    ),
                  }}
                  aria-hidden
                />
                <div className="chat-surface-glow" aria-hidden />
              </>
            )}

            <div
              ref={scrollerRef}
              onScroll={onScroll}
              className="chat-scrollbar chat-surface absolute inset-0 z-[1] overflow-y-auto px-3 py-3"
            >
              {isFetchingNextPage && (
                <div className="flex justify-center py-2">
                  <Loader2
                    size={16}
                    className="animate-spin text-muted-foreground"
                  />
                </div>
              )}

              {isError ? (
                <p className="py-10 text-center text-sm text-destructive">
                  Failed to load messages
                </p>
              ) : messages.length === 0 ? (
                <ChatEmptyState
                  name={
                    isGroup
                      ? conversation?.title || "the group"
                      : otherUser?.fullname || otherUser?.username
                  }
                />
              ) : (
                // Virtualization deferred: keep DOM scroll + load-older height
                // restoration intact for reply jump + infinite history.
                <div className="flex flex-col">
                  {messages.map((msg, index) => {
                    const group = getMessageGroupMeta(messages, index);
                    return (
                      <div
                        key={msg._id}
                        className={
                          group.isGroupStart ? "mt-3 first:mt-0" : "mt-0.5"
                        }
                      >
                        <MessageBubble
                          message={msg}
                          isMine={!!myId && senderId(msg.sender) === myId}
                          currentUserId={myId}
                          isFirstInGroup={group.isFirst}
                          isLastInGroup={group.isLast}
                          isHighlighted={highlightId === msg._id}
                          showSenderLabel={!!isGroup}
                          isGroupChat={!!isGroup}
                          onReply={(m) => {
                            if (m.isDeleted) return;
                            setReplyTo(m);
                          }}
                          onReact={handleReact}
                          onJumpToReply={jumpToMessage}
                          onDelete={(m) => void handleDelete(m)}
                          onForward={setForwardTarget}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="relative z-[1] shrink-0 pb-[env(safe-area-inset-bottom)]">
            {conversation?.type === "direct" &&
              conversation.pendingThemeProposal && (
                <ThemeProposalBanner
                  conversationId={conversationId}
                  proposal={conversation.pendingThemeProposal}
                  peer={otherUser}
                />
              )}
            <MessageComposer
              conversationId={conversationId}
              replyTo={replyTo}
              onCancelReply={cancelReply}
            />
          </div>
        </>
      )}

      <ForwardMessageModal
        sourceConversationId={conversationId}
        messageId={forwardTarget?._id ?? ""}
        open={!!forwardTarget}
        onClose={() => setForwardTarget(null)}
      />

      <ChatOverview
        conversation={conversation}
        open={overviewOpen}
        onClose={() => setOverviewOpen(false)}
        onOpenTheme={() => setThemePickerOpen(true)}
      />

      <ChatThemePicker
        open={themePickerOpen}
        onClose={() => setThemePickerOpen(false)}
        themeId={themeId}
        onSelectTheme={setThemeId}
        hasWallpaper={hasWallpaper}
        wallpaperUrl={wallpaperUrl}
        blur={blur}
        dim={dim}
        onBlurChange={setBlur}
        onDimChange={setDim}
        onUploadWallpaper={setWallpaperFromFile}
        onClearWallpaper={clearWallpaper}
        onResetAll={resetAll}
        uploading={uploading}
        shareEnabled={!!conversation && conversation.type === "direct"}
        shareLabel={`Share with ${
          otherUser?.fullname?.split(/\s+/)[0] ||
          otherUser?.username ||
          "them"
        }`}
        sharing={proposeTheme.isPending}
        followingShared={followingShared}
        readOnly={!!isGroup && !isGroupAdmin}
        groupAdminHint={isGroupAdmin}
        onUseShared={
          conversation?.sharedTheme && !isGroup
            ? () => void useSharedTheme()
            : undefined
        }
        onShare={async () => {
          try {
            const form = await buildShareFormData();
            const res = await proposeTheme.mutateAsync(form);
            if (res.applied) {
              toast.success("Theme applied for the group");
            } else {
              toast.success("Theme invite sent");
            }
          } catch {
            toast.error("Could not share theme");
          }
        }}
      />
    </main>
  );
}
