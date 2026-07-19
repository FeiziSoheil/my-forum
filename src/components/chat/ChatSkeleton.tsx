"use client";

import { cn } from "@/lib/utils";

function BubbleSkeleton({
  align,
  width,
}: {
  align: "start" | "end";
  width: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full",
        align === "end" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "h-12 animate-pulse rounded-2xl bg-muted/70",
          width,
          align === "end" ? "rounded-br-md" : "rounded-bl-md"
        )}
      />
    </div>
  );
}

export default function ChatSkeleton() {
  return (
    <div
      className="flex flex-1 flex-col"
      aria-busy="true"
      aria-label="Loading conversation"
    >
      {/* Messages area */}
      <div className="flex flex-1 flex-col justify-end gap-3 px-3 py-4">
        <BubbleSkeleton align="start" width="w-[55%]" />
        <BubbleSkeleton align="start" width="w-[40%]" />
        <div className="h-3" />
        <BubbleSkeleton align="end" width="w-[48%]" />
        <BubbleSkeleton align="end" width="w-[62%]" />
        <div className="h-3" />
        <BubbleSkeleton align="start" width="w-[50%]" />
        <BubbleSkeleton align="end" width="w-[36%]" />
      </div>

      {/* Composer skeleton */}
      <div className="shrink-0 border-t border-border/40 px-3 py-3">
        <div className="flex items-end gap-2">
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="h-10 flex-1 animate-pulse rounded-2xl bg-muted/70" />
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}
