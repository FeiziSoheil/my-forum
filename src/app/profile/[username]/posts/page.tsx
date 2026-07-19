'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PostCard } from '@/components/PostCard';
import { usePublicProfile, useUserPostsByUsername } from '@/hook/useFollow';
import { Loader2, FileText } from 'lucide-react';

export default function UserPostsPage() {
    const params = useParams<{ username: string }>();
    const username = params.username;
    const { data: profile, isLoading: profileLoading } = usePublicProfile(username);
    const canView = !!profile && (profile.canView || false);
    const { data: posts, isLoading } = useUserPostsByUsername(username, canView);

    if (profileLoading || (canView && isLoading)) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!canView) {
        return null;
    }

    if (!posts || posts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-muted/60">
                    <FileText className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No threads yet</p>
                <p className="mt-1 text-sm text-muted-foreground">@{username} hasn&apos;t posted anything.</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-border/60">
            {posts.map((post) => (
                <PostCard key={post._id} post={post} />
            ))}
        </div>
    );
}
