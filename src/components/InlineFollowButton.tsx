'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToggleFollow } from '@/hook/useFollow';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type InlineFollowButtonProps = {
  username: string;
  isFollowing?: boolean;
  isRequested?: boolean;
  className?: string;
};

/**
 * Compact follow CTA for post/reply headers.
 * Hidden when already following or when viewing your own content.
 */
export function InlineFollowButton({
  username,
  isFollowing,
  isRequested,
  className,
}: InlineFollowButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const toggleFollow = useToggleFollow();
  const router = useRouter();

  const isSelf = !!user?.username && user.username === username;
  if (isSelf || isFollowing) return null;

  const label = isRequested ? 'Requested' : 'Follow';

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    toggleFollow.mutate({
      username,
      isFollowing: !!isFollowing,
      isRequested: !!isRequested,
    });
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={toggleFollow.isPending}
      variant={isRequested ? 'outline' : 'default'}
      size="sm"
      className={cn('h-7 shrink-0 rounded-full px-3 text-xs font-semibold', className)}
    >
      {label}
    </Button>
  );
}
