"use client";

import ConversationListPanel from "@/components/chat/ConversationListPanel";
import { useAuth } from "@/context/AuthContext";
import { usePresenceHeartbeat } from "@/hook/useChat";
import { cn } from "@/lib/utils";
import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";

/**
 * Presence heartbeat is scoped to /messages (list + threads), not the whole app.
 * Desktop (lg+): list | thread split. Mobile: stacked routes unchanged.
 * Children are rendered once to avoid double-mounting chat streams.
 */
export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  usePresenceHeartbeat(!!user);
  const pathname = usePathname();
  const isThread = pathname.startsWith("/messages/") && pathname !== "/messages";

  return (
    <div className={cn("lg:flex lg:h-dvh", isThread && "h-dvh overflow-hidden")}>
      <aside className="hidden w-[22rem] shrink-0 flex-col border-e border-border/60 bg-background lg:flex xl:w-[24rem]">
        <ConversationListPanel />
      </aside>

      <section
        className={cn(
          "min-w-0 flex-1 lg:bg-muted/15",
          isThread && "h-full overflow-hidden"
        )}
      >
        {isThread ? (
          children
        ) : (
          <>
            <div className="lg:hidden">{children}</div>
            <div className="hidden h-full flex-col items-center justify-center gap-3 px-8 text-center lg:flex">
              <div className="grid size-16 place-items-center rounded-2xl bg-muted/60">
                <MessageCircle className="size-7 text-muted-foreground" />
              </div>
              <p className="text-lg font-semibold tracking-tight">
                Select a conversation
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Choose a chat from the list, search for someone, or start a new
                group.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
