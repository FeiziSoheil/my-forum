'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToggleFollow } from '@/hook/useFollow';
import { useSuggestedPeople } from '@/hook/useSuggestions';
import { SuggestedUser, SuggestionReason } from '@/types/user';
import { Users } from 'lucide-react';

function reasonLabel(user: SuggestedUser): string {
  switch (user.reason as SuggestionReason) {
    case 'mutuals':
      return user.mutualCount && user.mutualCount > 0
        ? `${user.mutualCount} mutual${user.mutualCount === 1 ? '' : 's'}`
        : 'Followed by people you follow';
    case 'shared_interests':
      return 'Shared interests';
    case 'popular':
    default:
      return 'Popular on Parakgram';
  }
}

type SuggestedPeopleProps = {
  limit?: number;
  title?: string;
  className?: string;
  showSeeMore?: boolean;
};

export default function SuggestedPeople({
  limit = 5,
  title = 'Who to follow',
  className,
  showSeeMore = true,
}: SuggestedPeopleProps) {
  const { isAuthenticated } = useAuth();
  const { data: users = [], isLoading } = useSuggestedPeople(limit, true);
  const toggleFollow = useToggleFollow();
  const router = useRouter();
  const { user: currentUser } = useAuth();

  if (isLoading) {
    return (
      <section className={className}>
        <div className="mb-3 flex items-center gap-2 px-1">
          <Users className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex w-[148px] shrink-0 flex-col items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4"
            >
              <div className="size-16 animate-pulse rounded-full bg-muted" />
              <div className="w-full space-y-2">
                <div className="mx-auto h-3 w-20 animate-pulse rounded-full bg-muted" />
                <div className="mx-auto h-2.5 w-16 animate-pulse rounded-full bg-muted/70" />
                <div className="mx-auto h-2 w-24 animate-pulse rounded-full bg-muted/50" />
              </div>
              <div className="h-7 w-full animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (users.length === 0) return null;

  return (
    <section className={className}>
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {showSeeMore && (
          <Link
            href="/search?tab=users"
            className="text-xs font-medium text-primary hover:underline"
          >
            See more
          </Link>
        )}
      </div>

      <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-none">
        {users.map((u) => {
          const isSelf =
            !!currentUser?.username && currentUser.username === u.username;

          return (
            <li
              key={u._id}
              className="flex w-[148px] shrink-0 flex-col items-center rounded-2xl border border-border/60 bg-muted/20 p-4 text-center"
            >
              <Link
                href={`/profile/${u.username}`}
                className="flex min-w-0 w-full flex-col items-center gap-2"
              >
                <Avatar className="size-16">
                  <AvatarImage src={u.avatar || undefined} alt={u.fullname} />
                  <AvatarFallback>
                    {(u.fullname || u.username).slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 w-full">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {u.fullname}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{u.username}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
                    {reasonLabel(u)}
                  </p>
                </div>
              </Link>

              {!isSelf && !u.isFollowing && (
                <Button
                  type="button"
                  size="sm"
                  variant={u.isRequested ? 'outline' : 'default'}
                  className="mt-3 h-7 w-full rounded-full px-3 text-xs font-semibold"
                  disabled={toggleFollow.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isAuthenticated) {
                      router.push('/auth');
                      return;
                    }
                    toggleFollow.mutate({
                      username: u.username,
                      isFollowing: false,
                      isRequested: !!u.isRequested,
                    });
                  }}
                >
                  {u.isRequested ? 'Requested' : 'Follow'}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
