'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  CircleEllipsis,
  FileText,
  Globe,
  Image as ImageIcon,
  ImagePlay,
  List,
  Loader2,
  Lock,
  MoreHorizontal,
  Music2,
  SlidersHorizontal,
  Smile,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ComposerTextarea } from '@/components/composer/ComposerTextarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { extractHashtags } from '@/lib/tags/extractHashtags';
import {
  PollComposer,
  type PollDraft,
} from '@/components/post/PollComposer';

export type PostVisibility = 'public' | 'followers' | 'private';

const VISIBILITY_OPTIONS: {
  value: PostVisibility;
  label: string;
  description: string;
  icon: typeof Globe;
}[] = [
  {
    value: 'public',
    label: 'Public',
    description: 'Anyone can see this',
    icon: Globe,
  },
  {
    value: 'followers',
    label: 'Followers',
    description: 'Only people who follow you',
    icon: Users,
  },
  {
    value: 'private',
    label: 'Only me',
    description: 'Visible only to you',
    icon: Lock,
  },
];

type ThreadComposeLayoutProps = {
  title: string;
  submitLabel?: string;
  placeholder?: string;
  content: string;
  onContentChange: (value: string) => void;
  mediaFiles: File[];
  onMediaChange: (files: File[]) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  error?: string;
  maxCharacters?: number;
  showVisibility?: boolean;
  visibility?: PostVisibility;
  onVisibilityChange?: (value: PostVisibility) => void;
  context?: ReactNode;
  /** When set, overrides the default "non-empty content" submit rule */
  canSubmit?: boolean;
  pollDraft?: PollDraft | null;
  onPollDraftChange?: (draft: PollDraft) => void;
  onOpenPoll?: () => void;
  onClosePoll?: () => void;
};

export function ThreadComposeLayout({
  title,
  submitLabel = 'Post',
  placeholder = "What's new?",
  content,
  onContentChange,
  mediaFiles,
  onMediaChange,
  isSubmitting,
  onSubmit,
  error,
  maxCharacters = 500,
  showVisibility = false,
  visibility = 'public',
  onVisibilityChange,
  context,
  canSubmit: canSubmitProp,
  pollDraft = null,
  onPollDraftChange,
  onOpenPoll,
  onClosePoll,
}: ThreadComposeLayoutProps) {
  const router = useRouter();
  const { user } = useAuth();
  const mediaInputId = useId();
  const [optionsOpen, setOptionsOpen] = useState(false);

  const username = user?.username || 'you';
  const displayName = user?.fullname || username;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const characterCount = content.length;
  const canSubmit =
    canSubmitProp ??
    (content.trim().length > 0 && characterCount <= maxCharacters);
  const detectedTags = extractHashtags(content || '');
  const visibilityLabel =
    VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.label ?? 'Public';
  const pollOpen = !!pollDraft;

  const mediaPreviews = useMemo(
    () => mediaFiles.map((file) => URL.createObjectURL(file)),
    [mediaFiles]
  );

  useEffect(() => {
    return () => {
      mediaPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [mediaPreviews]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    if (pollOpen) {
      toast.message('Remove the poll to add media');
      return;
    }

    if (files.length + mediaFiles.length > 5) {
      toast.error('Maximum 5 files allowed');
      return;
    }

    const accepted: File[] = [];
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large. Maximum size is 10MB`);
        continue;
      }
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        toast.error(`File ${file.name} is not a valid image or video`);
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length) {
      onMediaChange([...mediaFiles, ...accepted]);
    }
  };

  const removeMedia = (index: number) => {
    onMediaChange(mediaFiles.filter((_, i) => i !== index));
  };

  const comingSoon = () => toast.message('Coming soon');

  const handlePollClick = () => {
    if (pollOpen) {
      onClosePoll?.();
      return;
    }
    if (mediaFiles.length > 0) {
      toast.message('Remove media to create a poll');
      return;
    }
    onOpenPoll?.();
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-background/95 px-3 py-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isSubmitting}
          className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          aria-label="Close"
        >
          <X className="size-6" strokeWidth={1.75} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={comingSoon}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Drafts"
          >
            <FileText className="size-5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={comingSoon}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="More"
          >
            <CircleEllipsis className="size-5" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-4 pb-28">
        {context && <div className="mb-4">{context}</div>}

        <div className="flex gap-3">
          <Avatar className="mt-0.5 size-10 shrink-0">
            <AvatarImage src={user?.avatar} alt={username} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-foreground">
              {username}
            </p>

            <ComposerTextarea
              value={content}
              onChange={onContentChange}
              placeholder={placeholder}
              rows={4}
              maxLength={maxCharacters}
              autoFocus
              className={cn(
                'mt-1 min-h-[96px] resize-none border-0 bg-transparent px-0 py-1 text-[16px] leading-relaxed shadow-none md:text-[16px]',
                'placeholder:text-muted-foreground/70 focus-visible:border-0 focus-visible:ring-0'
              )}
            />

            {error && <p className="mt-1 text-sm text-destructive">{error}</p>}

            {detectedTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {pollDraft && onPollDraftChange && onClosePoll && (
              <div className="w-[calc(100%+2.5rem+0.75rem)] -ms-[calc(2.5rem+0.75rem)]">
                <PollComposer
                  draft={pollDraft}
                  onChange={onPollDraftChange}
                  onRemove={onClosePoll}
                  disabled={isSubmitting}
                />
              </div>
            )}

            {mediaPreviews.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {mediaPreviews.map((preview, index) => (
                  <div
                    key={`${mediaFiles[index]?.name}-${index}`}
                    className="group relative aspect-square overflow-hidden rounded-2xl bg-muted"
                  >
                    {mediaFiles[index]?.type.startsWith('video/') ? (
                      <video
                        src={preview}
                        className="size-full object-cover"
                        controls={false}
                      />
                    ) : (
                      <img
                        src={preview}
                        alt=""
                        className="size-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute top-2 end-2 rounded-full bg-black/60 p-1 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Remove media"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center gap-1">
              <label
                htmlFor={mediaInputId}
                className={cn(
                  'flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  pollOpen && 'pointer-events-none opacity-40'
                )}
                aria-label="Add photo or video"
              >
                <ImageIcon className="size-[22px]" strokeWidth={1.5} />
              </label>
              <Input
                id={mediaInputId}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={pollOpen}
              />
              <ToolbarButton icon={ImagePlay} label="GIF" onClick={comingSoon} />
              <ToolbarButton
                icon={List}
                label="Poll"
                onClick={onOpenPoll ? handlePollClick : comingSoon}
                active={pollOpen}
              />
              <ToolbarButton icon={Music2} label="Music" onClick={comingSoon} />
              <ToolbarButton
                icon={MoreHorizontal}
                label="More"
                onClick={comingSoon}
              />
            </div>

            {characterCount > maxCharacters * 0.85 && (
              <p
                className={cn(
                  'mt-2 text-xs',
                  characterCount > maxCharacters
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                )}
              >
                {characterCount} / {maxCharacters}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {showVisibility ? (
            <button
              type="button"
              onClick={() => setOptionsOpen(true)}
              className="flex min-w-0 items-center gap-2 text-[15px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <SlidersHorizontal className="size-4 shrink-0" strokeWidth={1.75} />
              <span className="truncate">
                Post options
                <span className="text-muted-foreground/80"> · {visibilityLabel}</span>
              </span>
            </button>
          ) : (
            <span className="text-[15px] text-muted-foreground">Reply</span>
          )}

          <div className="flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={comingSoon}
              className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Extras"
            >
              <Smile className="size-4" strokeWidth={1.5} />
            </button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit || isSubmitting}
              className={cn(
                'h-9 min-w-[72px] rounded-full px-5 text-[15px] font-semibold',
                canSubmit
                  ? 'bg-foreground text-background hover:bg-foreground/90'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                submitLabel
              )}
            </Button>
          </div>
        </div>
      </div>

      {showVisibility && (
        <Sheet open={optionsOpen} onOpenChange={setOptionsOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl px-0 pb-8">
            <SheetHeader className="border-b border-border px-4 pb-3">
              <SheetTitle className="text-base">Who can see this?</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 px-2 pt-2">
              {VISIBILITY_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                const selected = visibility === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      onVisibilityChange?.(value);
                      setOptionsOpen(false);
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors',
                      selected ? 'bg-primary/10' : 'hover:bg-muted'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-10 items-center justify-center rounded-full border',
                        selected
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border text-muted-foreground'
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-foreground">
                        {label}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {description}
                      </span>
                    </span>
                    {selected && (
                      <span className="size-2.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof ImageIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex size-9 items-center justify-center rounded-full transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      aria-label={label}
      aria-pressed={active}
    >
      <Icon className="size-[22px]" strokeWidth={1.5} />
    </button>
  );
}
