import { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";
import {
  canViewPrivateAuthorAsync,
  viewerFollowsAuthor,
} from "@/lib/follow/edges";

export type LikeRef = { user?: { toString(): string } | null };
export type RepostRef = { user?: { toString(): string } | null };
export type FollowRef = { user?: { toString(): string } | null };

export function isLikedBy(likes: LikeRef[] | undefined, userId: string | null): boolean {
    if (!userId) return false;
    return (likes ?? []).some(like => like.user?.toString() === userId);
}

export function isRepostedBy(reposts: RepostRef[] | undefined, userId: string | null): boolean {
    if (!userId) return false;
    return (reposts ?? []).some(repost => repost.user?.toString() === userId);
}

export function isFollowedBy(followers: FollowRef[] | undefined, userId: string | null): boolean {
    if (!userId) return false;
    return (followers ?? []).some(follower => follower.user?.toString() === userId);
}

/**
 * Account-level privacy gate. A private account only exposes its content
 * (profile details, posts, replies, reposts, follow lists, stories) to the
 * owner and existing followers. Public accounts are always viewable.
 *
 * Prefer `canViewPrivateAuthorAsync` (Follow-first) at async API boundaries.
 */
export function canViewPrivateAuthor(
    author: { _id: { toString(): string }; isPrivate?: boolean; followers?: FollowRef[] },
    viewerId: string | null
): boolean {
    if (!author.isPrivate) return true;
    if (viewerId && author._id.toString() === viewerId) return true;
    return isFollowedBy(author.followers, viewerId);
}

export { canViewPrivateAuthorAsync, viewerFollowsAuthor };

export async function getOptionalUserId(req: NextRequest): Promise<string | null> {
    try {
        const atk = req.cookies.get('atk')?.value;
        if (!atk) return null;
        const payload = await verifyAccessToken(atk);
        return (payload.uid as string) ?? null;
    } catch {
        return null;
    }
}
