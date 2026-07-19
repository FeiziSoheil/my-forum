'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToggleFollow } from '@/hook/useFollow';
import { FollowListUser } from '@/types/user';

type FollowUserRowProps = {
  user: FollowListUser;
};

export function FollowUserRow({ user }: FollowUserRowProps) {
  const { user: currentUser, isAuthenticated } = useAuth();
  const toggleFollow = useToggleFollow();
  const router = useRouter();

  const isSelf = !!currentUser?.username && currentUser.username === user.username;

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    toggleFollow.mutate({ username: user.username, isFollowing: user.isFollowing });
  };

  return (
    <div className="flex items-center gap-3 px-1 py-3">
      <Link
        href={`/profile/${user.username}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <Avatar className="size-11">
          <AvatarImage src={user.avatar || undefined} alt={user.fullname} />
          <AvatarFallback />
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {user.fullname}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            @{user.username}
          </p>
        </div>
      </Link>

      {!isSelf && (
        <Button
          onClick={handleToggle}
          disabled={toggleFollow.isPending}
          variant={user.isFollowing ? 'outline' : 'default'}
          size="sm"
          className="shrink-0 rounded-full px-4"
        >
          {user.isFollowing ? 'Following' : 'Follow'}
        </Button>
      )}
    </div>
  );
}
