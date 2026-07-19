'use client';

import { PostCard } from '@/components/PostCard';
import { usePosts } from '@/hook/usePosts';
import { Post } from '@/types/post';
import { useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Hash, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function TagPage() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug || '').trim().toLowerCase();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = usePosts(slug || undefined);

  const router = useRouter();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-32 lg:max-w-2xl lg:pb-10 xl:max-w-3xl">
      <div className="sticky top-14 z-30 -mx-4 mb-2 border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <Hash className="size-5 text-primary" />
          <h1 className="text-lg font-bold tracking-tight" dir="auto">
            {slug || 'tag'}
          </h1>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Posts tagged with #{slug}
        </p>
      </div>

      {isLoading ? (
        <TagFeedSkeleton />
      ) : posts.length === 0 ? (
        <EmptyTagFeed slug={slug} />
      ) : (
        <div className="divide-y divide-border/60">
          {posts.map((post: Post, index: number) => (
            <PostCard
              key={post._id ?? index}
              post={post}
              onReply={(postId) => router.push(`/post/${postId}/reply`)}
            />
          ))}
        </div>
      )}

      {!isLoading && posts.length > 0 && (
        <div ref={loadMoreRef} className="flex items-center justify-center py-8">
          {isFetchingNextPage ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : hasNextPage ? (
            <button
              onClick={() => fetchNextPage()}
              className="rounded-full border border-border bg-muted/40 px-5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Load more
            </button>
          ) : (
            <span className="text-sm text-muted-foreground">You&apos;re all caught up</span>
          )}
        </div>
      )}
    </main>
  );
}

function TagFeedSkeleton() {
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 p-4">
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-3">
            <div className="h-3 w-32 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyTagFeed({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-muted/60">
        <Hash className="size-7 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold" dir="auto">
        No posts with #{slug}
      </h2>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
        Be the first to post about this topic.
      </p>
      <Link
        href="/post/new"
        className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105 active:scale-95"
      >
        Create a post
      </Link>
    </div>
  );
}
