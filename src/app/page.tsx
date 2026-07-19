'use client';

import { PostCard } from '@/components/PostCard';
import PullToRefresh from '@/components/PullToRefresh';
import SuggestedPeople from '@/components/SuggestedPeople';
import StoryRail from '@/components/stories/StoryRail';
import { useAuth } from '@/context/AuthContext';
import { usePosts } from '@/hook/usePosts';
import { Post } from '@/types/post';
import { useQueryClient } from '@tanstack/react-query';
import { Feather, Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type FeedTab = 'for-you' | 'following';

export default function HomePage() {
    const { isAuthenticated } = useAuth();
    const [activeTab, setActiveTab] = useState<FeedTab>('for-you');
    const queryClient = useQueryClient();

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        refetch,
    } = usePosts(
        activeTab === 'following'
            ? { feed: 'following', enabled: isAuthenticated }
            : isAuthenticated
              ? { feed: 'for-you' }
              : {}
    );

    const router = useRouter();
    const loadMoreRef = useRef<HTMLDivElement>(null);

    const handlePullRefresh = useCallback(async () => {
        await Promise.all([
            refetch(),
            queryClient.invalidateQueries({ queryKey: ['stories'] }),
            queryClient.invalidateQueries({ queryKey: ['user-suggestions'] }),
        ]);
    }, [queryClient, refetch]);

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

    const handleLike = (postId: string) => {
        console.log('Like post:', postId);
    };

    const handleReply = (postId: string) => {
        router.push(`/post/${postId}/reply`);
    };

    const handleRepost = (postId: string) => {
        console.log('Repost:', postId);
    };

    const handleShare = (postId: string) => {
        console.log('Share post:', postId);
    };

    const handleMore = (postId: string) => {
        console.log('More options for post:', postId);
    };

    const posts = data?.pages.flatMap((page) => page.posts) ?? [];
    // Guard against rare duplicate IDs across ranked pages.
    const seenIds = new Set<string>();
    const uniquePosts = posts.filter((post) => {
        const id = post._id;
        if (!id || seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
    });

    return (
        <PullToRefresh onRefresh={handlePullRefresh}>
            <main className="mx-auto w-full max-w-xl px-4 pb-32 lg:max-w-2xl lg:pb-10 xl:max-w-3xl">
                <StoryRail />

                <div className="sticky top-14 z-30 mb-1 flex border-b border-border bg-background">
                    {([
                        { id: 'for-you', label: 'For you' },
                        { id: 'following', label: 'Following' },
                    ] as { id: FeedTab; label: string }[]).map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className="relative flex-1 py-3 text-sm font-medium transition-colors hover:bg-muted/40"
                        >
                            <span className={activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground'}>
                                {tab.label}
                            </span>
                            {activeTab === tab.id && (
                                <span className="absolute inset-x-0 bottom-0 mx-auto h-0.5 w-12 rounded-full bg-primary" />
                            )}
                        </button>
                    ))}
                </div>

                {activeTab === 'for-you' && (
                    <SuggestedPeople limit={5} className="mb-4 mt-3" />
                )}

                {activeTab === 'following' && !isAuthenticated ? (
                    <FollowingSignedOut />
                ) : isLoading ? (
                    <FeedSkeleton />
                ) : uniquePosts.length === 0 ? (
                    activeTab === 'following' ? <EmptyFollowing /> : <EmptyFeed />
                ) : (
                    <div className="divide-y divide-border/60">
                        {uniquePosts.map((post: Post) => (
                            <PostCard
                                key={post._id}
                                post={post}
                                onLike={handleLike}
                                onReply={handleReply}
                                onRepost={handleRepost}
                                onShare={handleShare}
                                onMore={handleMore}
                            />
                        ))}
                    </div>
                )}

                {/* Load more trigger */}
                {!isLoading && uniquePosts.length > 0 && (
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
        </PullToRefresh>
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
                        <div className="flex gap-6 pt-1">
                            {Array.from({ length: 4 }).map((_, j) => (
                                <div key={j} className="h-3 w-8 animate-pulse rounded-full bg-muted/70" />
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyFeed() {
    return (
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
            <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-muted/60">
                <Feather className="size-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">You&apos;re caught up</h2>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
                No more fresh posts to recommend right now. Check Following, or share something new.
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

function EmptyFollowing() {
    return (
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
            <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-muted/60">
                <Users className="size-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Nothing here yet</h2>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
                Follow some people to see their posts in this feed.
            </p>
        </div>
    );
}

function FollowingSignedOut() {
    return (
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
            <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-muted/60">
                <Users className="size-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Sign in to see your feed</h2>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
                Log in to follow people and build your personalized Following feed.
            </p>
            <Link
                href="/auth"
                className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105 active:scale-95"
            >
                Sign in
            </Link>
        </div>
    );
}
