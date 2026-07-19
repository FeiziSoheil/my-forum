'use client';

import { PostCard } from '@/components/PostCard';
import { useBookmarks } from '@/hook/useBookmarks';
import { Post } from '@/types/post';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Bookmark } from 'lucide-react';
import Link from 'next/link';

export default function BookmarksPage() {
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading
    } = useBookmarks();

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

    const handleReply = (postId: string) => {
        router.push(`/post/${postId}/reply`);
    };

    const posts = data?.pages.flatMap((page) => page.posts) ?? [];

    return (
        <main className="mx-auto w-full max-w-xl px-4 pb-32 lg:max-w-2xl lg:pb-10 xl:max-w-3xl">
            <div className="sticky top-14 z-30 border-b border-border bg-background px-1 py-3">
                <h1 className="text-lg font-semibold tracking-tight">Bookmarks</h1>
            </div>

            {isLoading ? (
                <FeedSkeleton />
            ) : posts.length === 0 ? (
                <EmptyBookmarks />
            ) : (
                <div className="divide-y divide-border/60">
                    {posts.map((post: Post, index: number) => (
                        <PostCard
                            key={post._id ?? index}
                            post={post}
                            onReply={handleReply}
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
                        <span className="text-sm text-muted-foreground">You&apos;re all caught up ✦</span>
                    )}
                </div>
            )}
        </main>
    );
}

function FeedSkeleton() {
    return (
        <div className="divide-y divide-border/60">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-4">
                    <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
                            <div className="h-3 w-16 animate-pulse rounded-full bg-muted/70" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
                            <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyBookmarks() {
    return (
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
            <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-muted/60">
                <Bookmark className="size-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">No bookmarks yet</h2>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
                Tap the bookmark icon on any post to save it here for later.
            </p>
            <Link
                href="/"
                className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105 active:scale-95"
            >
                Explore posts
            </Link>
        </div>
    );
}
