'use client';

import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DEFAULT_POLL_DURATION,
  POLL_DURATIONS,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  type PollDurationKey,
} from '@/lib/poll/constants';
import { Input } from '@/components/ui/input';

export type PollDraft = {
  options: string[];
  duration: PollDurationKey;
};

export function emptyPollDraft(): PollDraft {
  return {
    options: ['', ''],
    duration: DEFAULT_POLL_DURATION,
  };
}

export function isPollDraftValid(draft: PollDraft): boolean {
  const filled = draft.options.map((o) => o.trim()).filter(Boolean);
  if (filled.length < POLL_MIN_OPTIONS) return false;
  if (filled.some((o) => o.length > POLL_OPTION_MAX_LENGTH)) return false;
  const unique = new Set(filled.map((o) => o.toLowerCase()));
  return unique.size === filled.length;
}

type PollComposerProps = {
  draft: PollDraft;
  onChange: (draft: PollDraft) => void;
  onRemove: () => void;
  disabled?: boolean;
};

export function PollComposer({
  draft,
  onChange,
  onRemove,
  disabled,
}: PollComposerProps) {
  const updateOption = (index: number, value: string) => {
    const options = draft.options.map((o, i) => (i === index ? value : o));
    onChange({ ...draft, options });
  };

  const addOption = () => {
    if (draft.options.length >= POLL_MAX_OPTIONS) return;
    onChange({ ...draft, options: [...draft.options, ''] });
  };

  const removeOption = (index: number) => {
    if (draft.options.length <= POLL_MIN_OPTIONS) return;
    onChange({
      ...draft,
      options: draft.options.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="mt-3 w-full rounded-2xl border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Poll</p>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Remove poll"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {draft.options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={option}
              onChange={(e) => updateOption(index, e.target.value)}
              placeholder={`Choice ${index + 1}`}
              maxLength={POLL_OPTION_MAX_LENGTH}
              disabled={disabled}
              className="h-10 rounded-xl"
            />
            {draft.options.length > POLL_MIN_OPTIONS && (
              <button
                type="button"
                onClick={() => removeOption(index)}
                disabled={disabled}
                className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove choice ${index + 1}`}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {draft.options.length < POLL_MAX_OPTIONS && (
        <button
          type="button"
          onClick={addOption}
          disabled={disabled}
          className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          <Plus className="size-4" />
          Add choice
        </button>
      )}

      <div className="mt-3 border-t border-border pt-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Poll length
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(POLL_DURATIONS) as PollDurationKey[]).map((key) => {
            const selected = draft.duration === key;
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...draft, duration: key })}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {POLL_DURATIONS[key].label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
