'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { FollowList } from '@/components/profile/FollowList';
import { useFollowing, usePublicProfile } from '@/hook/useFollow';

export default function UserFollowingPage() {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const { data: profile } = usePublicProfile(username);
  const canView = !!profile && (profile.canView || false);
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useFollowing(username, canView);

  if (!canView) {
    return null;
  }

  const users = data?.pages.flatMap((page) => page.users) ?? [];

  return (
    <FollowList
      users={users}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={!!hasNextPage}
      emptyTitle="Not following anyone"
      emptyDescription={`@${username} isn't following anyone yet.`}
      onLoadMore={() => fetchNextPage()}
    />
  );
}
