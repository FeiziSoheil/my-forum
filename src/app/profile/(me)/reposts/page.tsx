'use client';

import React from 'react';
import { PostCard } from '@/components/PostCard';
import { useUserReposts } from '@/hook/usePosts';
import { Loader2, Repeat2 } from 'lucide-react';

export default function RepostsPage() {
  const { data: reposts, isLoading } = useUserReposts();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!reposts || reposts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-muted/60">
          <Repeat2 className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No reposts yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Posts you repost will show up here.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/60">
      {reposts.map((post) => (
        <PostCard key={post._id} post={post} />
      ))}
    </div>
  );
}
