'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isPollEnded } from '@/lib/poll/constants';
import type { PostPoll } from '@/types/post';

type PostPollProps = {
  poll: PostPoll;
  myVoteOptionId?: string | null;
  onVote: (optionId: string) => void;
  disabled?: boolean;
  isVoting?: boolean;
};

function formatTimeLeft(endsAt: Date | string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Final results';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m left`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h left`;
  const day = Math.round(hr / 24);
  return `${day}d left`;
}

export function PostPoll({
  poll,
  myVoteOptionId,
  onVote,
  disabled,
  isVoting,
}: PostPollProps) {
  const ended = isPollEnded(poll.endsAt);
  const showResults = ended || !!myVoteOptionId;
  const total = poll.votesCount || 0;

  return (
    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-col gap-2">
        {poll.options.map((option) => {
          const pct =
            showResults && total > 0
              ? Math.round((option.votesCount / total) * 100)
              : 0;
          const selected = myVoteOptionId === option.id;
          const isLeading =
            showResults &&
            total > 0 &&
            option.votesCount ===
              Math.max(...poll.options.map((o) => o.votesCount));

          if (!showResults) {
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled || isVoting || ended}
                onClick={() => onVote(option.id)}
                className={cn(
                  'w-full rounded-xl border border-primary/40 px-3 py-2.5 text-start text-[15px] font-medium text-primary transition-colors',
                  'hover:bg-primary/5 disabled:opacity-60'
                )}
              >
                {option.text}
              </button>
            );
          }

          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled || isVoting || ended}
              onClick={() => {
                if (!ended && !disabled) onVote(option.id);
              }}
              className={cn(
                'relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-start text-[15px] transition-colors',
                selected
                  ? 'border-primary/50'
                  : 'border-border hover:border-border/80',
                !ended && !disabled && 'cursor-pointer',
                (ended || disabled) && 'cursor-default'
              )}
              aria-pressed={selected}
            >
              <span
                className={cn(
                  'absolute inset-y-0 start-0 bg-muted transition-[width] duration-500 ease-out',
                  isLeading && 'bg-primary/15'
                )}
                style={{ width: `${pct}%` }}
              />
              <span className="relative z-10 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'flex min-w-0 items-center gap-1.5 font-medium text-foreground',
                    isLeading && 'font-semibold'
                  )}
                >
                  <span className="truncate">{option.text}</span>
                  {selected && (
                    <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} />
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-sm text-muted-foreground">
                  {pct}%
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {total} {total === 1 ? 'vote' : 'votes'}
        <span className="mx-1.5">·</span>
        {ended ? 'Final results' : formatTimeLeft(poll.endsAt)}
      </p>
    </div>
  );
}
