'use client';

import React from 'react';
import { FollowList } from '@/components/profile/FollowList';
import { useFollowers } from '@/hook/useFollow';
import { useMe } from '@/hook/useMe';

export default function MyFollowersPage() {
  const { data: me } = useMe();
  const username = me?.username ?? '';
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useFollowers(username);

  const users = data?.pages.flatMap((page) => page.users) ?? [];

  return (
    <FollowList
      users={users}
      isLoading={isLoading || !username}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={!!hasNextPage}
      emptyTitle="No followers yet"
      emptyDescription="When people follow you, they'll show up here."
      onLoadMore={() => fetchNextPage()}
    />
  );
}
