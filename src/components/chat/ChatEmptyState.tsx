"use client";

import { MessageCircle } from "lucide-react";

export default function ChatEmptyState({
  name,
}: {
  name?: string;
}) {
  return (
    <div className="flex h-full min-h-[40vh] flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-full bg-muted/60 text-muted-foreground">
        <MessageCircle size={28} strokeWidth={1.5} aria-hidden />
      </div>
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        {name ? `Message ${name}` : "No messages yet"}
      </h2>
      <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-muted-foreground">
        Say hello — send the first message to start the conversation.
      </p>
    </div>
  );
}
