'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { FollowList } from '@/components/profile/FollowList';
import { useFollowers, usePublicProfile } from '@/hook/useFollow';

export default function UserFollowersPage() {
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
  } = useFollowers(username, canView);

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
      emptyTitle="No followers yet"
      emptyDescription={`@${username} doesn't have any followers.`}
      onLoadMore={() => fetchNextPage()}
    />
  );
}
