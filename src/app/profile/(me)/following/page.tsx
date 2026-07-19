'use client';

import React from 'react';
import { FollowList } from '@/components/profile/FollowList';
import { useFollowing } from '@/hook/useFollow';
import { useMe } from '@/hook/useMe';

export default function MyFollowingPage() {
  const { data: me } = useMe();
  const username = me?.username ?? '';
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useFollowing(username);

  const users = data?.pages.flatMap((page) => page.users) ?? [];

  return (
    <FollowList
      users={users}
      isLoading={isLoading || !username}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={!!hasNextPage}
      emptyTitle="Not following anyone"
      emptyDescription="When you follow people, they'll show up here."
      onLoadMore={() => fetchNextPage()}
    />
  );
}
