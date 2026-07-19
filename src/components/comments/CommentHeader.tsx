'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InlineFollowButton } from '@/components/InlineFollowButton';
import { cn } from '@/lib/utils';

type CommentHeaderProps = {
  authorName: string;
  username: string;
  isOwner?: boolean;
  showFollowButton?: boolean;
  isFollowing?: boolean;
  isRequested?: boolean;
  /** Top-level comments use heavier name weight. */
  isRoot?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

export const CommentHeader = memo(function CommentHeader({
  authorName,
  username,
  isOwner,
  showFollowButton,
  isFollowing,
  isRequested,
  isRoot = false,
  onEdit,
  onDelete,
}: CommentHeaderProps) {
  const router = useRouter();

  const goProfile = () => router.push(`/profile/${username}`);

  return (
    <div className="mb-1 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <button
            type="button"
            onClick={goProfile}
            className={cn(
              'truncate text-left text-foreground hover:underline',
              isRoot ? 'text-base font-semibold' : 'text-[15px] font-medium'
            )}
          >
            {authorName}
          </button>
          <button
            type="button"
            onClick={goProfile}
            className="truncate text-[13px] text-muted-foreground hover:underline"
          >
            @{username}
          </button>
        </div>
      </div>

      <div
        className={cn(
          'flex shrink-0 items-center gap-0.5 transition-opacity duration-150',
          // Desktop: dim until hover/focus; mobile: always visible
          'opacity-100 sm:opacity-0 sm:group-hover/comment:opacity-100 sm:group-focus-within/comment:opacity-100'
        )}
      >
        {showFollowButton && (
          <InlineFollowButton
            username={username}
            isFollowing={isFollowing}
            isRequested={isRequested}
          />
        )}
        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-11 w-11 p-0 sm:h-9 sm:w-9"
                aria-label="Comment options"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
});
