'use client';

import { FollowUserRow } from '@/components/profile/FollowUserRow';
import { FollowListUser } from '@/types/user';
import { Loader2, Users } from 'lucide-react';

type FollowListProps = {
  users: FollowListUser[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  emptyTitle: string;
  emptyDescription: string;
  onLoadMore: () => void;
};

export function FollowList({
  users,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  emptyTitle,
  emptyDescription,
  onLoadMore,
}: FollowListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-muted/60">
          <Users className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/60">
      {users.map((user) => (
        <FollowUserRow key={user._id} user={user} />
      ))}

      {hasNextPage && (
        <div className="flex justify-center py-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
          >
            {isFetchingNextPage ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              'Load more'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
