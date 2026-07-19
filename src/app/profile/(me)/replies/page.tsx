'use client';

import React from 'react';
import { ReplyCard } from '@/components/ReplyCard';
import { useUserReplies } from '@/hook/useReplies';
import { Loader2, MessageCircle } from 'lucide-react';

export default function RepliesPage() {
  const { data: replies, isLoading } = useUserReplies();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!replies || replies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-muted/60">
          <MessageCircle className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No replies yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Your replies will show up here.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/60">
      {replies.map((reply) => (
        <ReplyCard key={reply._id} reply={reply} />
      ))}
    </div>
  );
}
