'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ProfileTabs from '@/components/profile/ProfileTabs';
import StoryAvatarRing from '@/components/stories/StoryAvatarRing';
import { usePublicProfile, useToggleFollow } from '@/hook/useFollow';
import { useStartConversation } from '@/hook/useChat';
import { useAuth } from '@/context/AuthContext';
import { MapPin, CalendarDays, Pencil, UserRound, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';

function formatCount(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
    return `${n}`;
}

export default function PublicProfileLayout({ children }: { children: React.ReactNode }) {
    const params = useParams<{ username: string }>();
    const username = params.username;
    const pathname = usePathname();
    const router = useRouter();

    const { user: currentUser, isAuthenticated } = useAuth();
    const { data: profile, isLoading, isError } = usePublicProfile(username);
    const toggleFollow = useToggleFollow();
    const startConversation = useStartConversation();

    const isFollowList =
        pathname.endsWith('/followers') || pathname.endsWith('/following');

    const tabs = isFollowList
        ? [
              { href: `/profile/${username}/followers`, label: 'Followers' },
              { href: `/profile/${username}/following`, label: 'Following' },
          ]
        : [
              { href: `/profile/${username}/posts`, label: 'Threads' },
              { href: `/profile/${username}/reposts`, label: 'Reposts' },
              { href: `/profile/${username}/replies`, label: 'Replies' },
          ];

    if (isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
        );
    }

    if (isError || !profile) {
        return (
            <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-4 text-center lg:max-w-2xl xl:max-w-3xl">
                <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-muted/60">
                    <UserRound className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">User not found</p>
                <p className="mt-1 text-sm text-muted-foreground">@{username} doesn&apos;t exist.</p>
            </main>
        );
    }

    const isOwnProfile = !!currentUser?.username && currentUser.username === profile.username;
    // Account-level privacy: when locked we render an identity header + a private
    // notice instead of the tabs and their content. Children are intentionally
    // omitted so sub-routes cannot mount or fetch.
    const locked = profile.isPrivate && !profile.canView && !isOwnProfile;

    const joined = profile.createdAt
        ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : null;

    const handleToggleFollow = () => {
        if (!isAuthenticated) {
            router.push('/auth');
            return;
        }
        toggleFollow.mutate({
            username: profile.username,
            isFollowing: profile.isFollowing,
            isRequested: profile.isRequested,
        });
    };

    const followLabel = profile.isFollowing
        ? 'Following'
        : profile.isRequested
          ? 'Requested'
          : 'Follow';

    const handleMessage = async () => {
        if (!isAuthenticated) {
            router.push('/auth');
            return;
        }
        try {
            const conversation = await startConversation.mutateAsync(profile._id);
            router.push(`/messages/${conversation._id}`);
        } catch {
            toast.error('Could not start conversation');
        }
    };

    return (
        <main
            data-profile-shell
            className="mx-auto w-full max-w-xl px-4 pb-32 lg:max-w-2xl lg:pb-10 xl:max-w-3xl"
        >
            {/* Banner */}
            <div className="relative -mx-4 h-32 overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-background sm:mx-0 sm:mt-4 sm:rounded-2xl">
                {profile.banner ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={profile.banner}
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
                    {locked ? (
                        <div className="rounded-full bg-background p-[3px]">
                            <Avatar className="size-24 rounded-full border-0">
                                <AvatarImage src={profile.avatar || undefined} />
                                <AvatarFallback />
                            </Avatar>
                        </div>
                    ) : (
                        <StoryAvatarRing
                            userId={profile._id}
                            username={profile.username}
                            avatar={profile.avatar}
                            fullname={profile.fullname}
                        />
                    )}

                    <div className="mb-2 flex items-center gap-2">
                        {isOwnProfile ? (
                            <Link
                                href="/settings"
                                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-transform hover:scale-[1.03] active:scale-95"
                            >
                                <Pencil className="size-4" />
                                Edit profile
                            </Link>
                        ) : (
                            <>
                                {!locked && (
                                    <Button
                                        onClick={handleMessage}
                                        disabled={startConversation.isPending}
                                        variant="outline"
                                        size="icon"
                                        className="size-10 rounded-full"
                                        aria-label="Message"
                                    >
                                        <Mail className="size-4" />
                                    </Button>
                                )}
                                <Button
                                    onClick={handleToggleFollow}
                                    disabled={toggleFollow.isPending}
                                    variant={
                                        profile.isFollowing || profile.isRequested
                                            ? 'outline'
                                            : 'default'
                                    }
                                    className="rounded-full px-5"
                                >
                                    {followLabel}
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                <div className="mt-3">
                    <h1 className="text-xl font-bold tracking-tight text-foreground">{profile.fullname}</h1>
                    <p className="text-sm text-muted-foreground">@{profile.username}</p>
                </div>

                {!locked && (
                <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
                    {profile.bio || 'No bio yet.'}
                </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {profile.isPrivate && (
                        <span className="inline-flex items-center gap-1">
                            <Lock className="size-4" />
                            Private
                        </span>
                    )}
                    {!locked && profile.location && (
                        <span className="inline-flex items-center gap-1">
                            <MapPin className="size-4" />
                            {profile.location}
                        </span>
                    )}
                    {!locked && joined && (
                        <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-4" />
                            Joined {joined}
                        </span>
                    )}
                </div>

                {!locked && (
                <div className="mt-4 flex items-center gap-5 text-sm">
                    <Link
                        href={`/profile/${username}/followers`}
                        className="transition-colors hover:underline"
                    >
                        <span className="font-bold text-foreground">{formatCount(profile.followersCount)}</span>{' '}
                        <span className="text-muted-foreground">Followers</span>
                    </Link>
                    <Link
                        href={`/profile/${username}/following`}
                        className="transition-colors hover:underline"
                    >
                        <span className="font-bold text-foreground">{formatCount(profile.followingCount)}</span>{' '}
                        <span className="text-muted-foreground">Following</span>
                    </Link>
                </div>
                )}
            </div>

            {locked ? (
                <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-muted/20 px-6 py-14 text-center">
                    <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-muted/60">
                        <Lock className="size-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">This account is private</p>
                    <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                        {profile.isRequested
                            ? `Your follow request is pending. You’ll see @${profile.username}’s content once they accept.`
                            : `Follow @${profile.username} to see their threads, replies and reposts.`}
                    </p>
                </div>
            ) : (
                <>
                    <ProfileTabs tabs={tabs} activeHref={pathname} />

                    <div className="mt-1">{children}</div>
                </>
            )}
        </main>
    );
}
