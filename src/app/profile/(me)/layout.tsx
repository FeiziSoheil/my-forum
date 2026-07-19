'use client'
import React, { useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, CalendarDays, Settings, Pencil, Lock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import PullToRefresh from '@/components/PullToRefresh';
import ProfileTabs from '@/components/profile/ProfileTabs';
import StoryAvatarRing from '@/components/stories/StoryAvatarRing';
import { useMe } from '@/hook/useMe';

const contentTabs = [
    { href: '/profile/posts', label: 'Threads' },
    { href: '/profile/reposts', label: 'Reposts' },
    { href: '/profile/replies', label: 'Replies' },
];

const followTabs = [
    { href: '/profile/followers', label: 'Followers' },
    { href: '/profile/following', label: 'Following' },
];

function formatCount(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
    return `${n}`;
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    const { data: user, isLoading } = useMe();
    const pathname = usePathname();
    const queryClient = useQueryClient();

    const handlePullRefresh = useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['me'] }),
            queryClient.invalidateQueries({ queryKey: ['user-posts'] }),
            queryClient.invalidateQueries({ queryKey: ['user-reposts'] }),
            queryClient.invalidateQueries({ queryKey: ['user-replies'] }),
            queryClient.invalidateQueries({ queryKey: ['followers'] }),
            queryClient.invalidateQueries({ queryKey: ['following'] }),
            queryClient.invalidateQueries({ queryKey: ['stories'] }),
        ]);
    }, [queryClient]);

    if (isLoading || !user) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
        );
    }

    const isFollowList =
        pathname === '/profile/followers' || pathname === '/profile/following';
    const tabs = isFollowList ? followTabs : contentTabs;

    const joined = user.createdAt
        ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : null;

    return (
        <main
            data-profile-shell
            className="mx-auto w-full max-w-xl px-4 pb-32 lg:max-w-2xl lg:pb-10 xl:max-w-3xl"
        >
            {/* Banner */}
            <div className="relative -mx-4 h-32 overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-background sm:mx-0 sm:mt-4 sm:rounded-2xl">
                {user.banner ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={user.banner}
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                    />
                ) : (
                    <div className="absolute -right-8 -top-10 size-40 rounded-full bg-primary/20 blur-2xl" />
                )}
            </div>

            {/* Identity */}
            <div className="relative">
                <div className="-mt-12 flex items-end justify-between">
                    {user._id ? (
                      <StoryAvatarRing
                        userId={user._id}
                        username={user.username}
                        avatar={user.avatar}
                        fullname={user.fullname}
                      />
                    ) : null}

                    <div className="mb-2 flex items-center gap-2">
                        <Link
                            href="/settings"
                            aria-label="Settings"
                            className="grid size-10 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <Settings className="size-5" />
                        </Link>
                        <Link
                            href="/settings"
                            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.03] active:scale-95"
                        >
                            <Pencil className="size-4" />
                            Edit profile
                        </Link>
                    </div>
                </div>

                <div className="mt-3">
                    <h1 className="text-xl font-bold tracking-tight text-foreground">{user.fullname}</h1>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                </div>

                {/* Bio */}
                <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
                    {user.bio || 'No bio yet.'}
                </p>

                {/* Meta */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {user.isPrivate && (
                        <span className="inline-flex items-center gap-1">
                            <Lock className="size-4" />
                            Private
                        </span>
                    )}
                    {user.location && (
                        <span className="inline-flex items-center gap-1">
                            <MapPin className="size-4" />
                            {user.location}
                        </span>
                    )}
                    {joined && (
                        <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-4" />
                            Joined {joined}
                        </span>
                    )}
                </div>

                {/* Stats */}
                <div className="mt-4 flex items-center gap-5 text-sm">
                    <Link
                        href="/profile/followers"
                        className="transition-colors hover:underline"
                    >
                        <span className="font-bold text-foreground">{formatCount(user.followersCount ?? 0)}</span>{' '}
                        <span className="text-muted-foreground">Followers</span>
                    </Link>
                    <Link
                        href="/profile/following"
                        className="transition-colors hover:underline"
                    >
                        <span className="font-bold text-foreground">{formatCount(user.followingCount ?? 0)}</span>{' '}
                        <span className="text-muted-foreground">Following</span>
                    </Link>
                </div>
            </div>

            <ProfileTabs tabs={tabs} activeHref={pathname} />

            {/* Page content */}
            <PullToRefresh onRefresh={handlePullRefresh}>
                <div className="mt-1">{children}</div>
            </PullToRefresh>
        </main>
    );
}
