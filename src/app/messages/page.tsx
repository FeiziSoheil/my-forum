"use client";

import ConversationListPanel from "@/components/chat/ConversationListPanel";
import PullToRefresh from "@/components/PullToRefresh";
import { useConversations } from "@/hook/useChat";
import { useCallback } from "react";

export default function MessagesPage() {
  const { refetch } = useConversations();

  const handlePullRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
      <main className="mx-auto min-h-[calc(100dvh-8rem)] w-full max-w-xl pb-24 lg:hidden">
        <ConversationListPanel />
      </main>
    </PullToRefresh>
  );
}
