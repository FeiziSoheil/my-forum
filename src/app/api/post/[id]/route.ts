import { dbConnect } from "@/lib/db/mongodb";
import { PostModel } from "@/models/Post";
import { BookmarkModel } from "@/models/Bookmark";
import { UserModel } from "@/models/User";
import { ReplyModel } from "@/models/Reply";
import { FollowRequestModel } from "@/models/FollowRequest";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { resolveMentionsFromContent } from "@/lib/mentions/resolveMentions";
import { createNotification } from "@/lib/notifications/createNotification";
import { extractHashtags } from "@/lib/tags/extractHashtags";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { getOptionalUserId, isLikedBy, isRepostedBy, LikeRef, RepostRef, canViewPrivateAuthorAsync, viewerFollowsAuthor } from "@/lib/auth/session";
import { withPollViewerState } from "@/lib/poll/attachPollViewer";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();

        const { id } = await params;

        if (!isValidObjectId(id)) {
            return NextResponse.json({ error: 'Invalid post id.' }, { status: 400 });
        }

        const post = await PostModel.findOne({ _id: id, isDeleted: false })
            .populate('author', 'username fullname avatar')
            .lean();

        if (!post) {
            return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
        }

        const userId = await getOptionalUserId(req);

        // Enforce per-post visibility AND account-level privacy.
        const visibility = (post as { visibility?: string }).visibility ?? 'public';
        const authorId = (post as { author?: { _id?: { toString(): string } } }).author?._id?.toString();
        const isAuthor = !!userId && authorId === userId;

        const author = await UserModel.findById(authorId)
            .select('isPrivate')
            .lean() as { _id: { toString(): string }; isPrivate?: boolean } | null;
        const isFollower = authorId
            ? await viewerFollowsAuthor(userId, authorId)
            : false;

        if (visibility !== 'public') {
            let allowed = isAuthor;
            if (!allowed && visibility === 'followers') {
                allowed = isFollower;
            }
            if (!allowed) {
                return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
            }
        }

        // A public post by a private account is only visible to the author and
        // existing followers.
        if (author && !(await canViewPrivateAuthorAsync(author, userId))) {
            return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
        }

        let isBookmarked = false;
        let isRequested = false;
        if (userId) {
            const bm = await BookmarkModel.exists({ user: userId, post: id });
            isBookmarked = !!bm;

            if (!isAuthor && !isFollower) {
                const pending = await FollowRequestModel.exists({
                    from: userId,
                    to: authorId,
                    status: "pending",
                });
                isRequested = !!pending;
            }
        }

        const postWithLike = withPollViewerState(
            {
                ...post,
                isLiked: isLikedBy((post as { likes?: LikeRef[] }).likes, userId),
                isReposted: isRepostedBy((post as { reposts?: RepostRef[] }).reposts, userId),
                isBookmarked,
                isFollowing: isFollower,
                isRequested,
            },
            userId
        );

        return NextResponse.json({ post: postWithLike }, { status: 200 });
    } catch (err) {
        console.error('GET /api/post/[id] error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch post' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();

        const cookieStore = cookies();
        const atk = (await cookieStore).get('atk')?.value;
        if (!atk) {
            return NextResponse.json({ error: 'Authentication token missing.' }, { status: 401 });
        }

        const payload = await verifyAccessToken(atk);
        const userId = payload.uid as string;

        const { id } = await params;
        if (!isValidObjectId(id)) {
            return NextResponse.json({ error: 'Invalid post id.' }, { status: 400 });
        }

        const post = await PostModel.findOne({ _id: id, isDeleted: false });
        if (!post) {
            return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
        }

        if (post.author.toString() !== userId) {
            return NextResponse.json({ error: 'You are not allowed to edit this post.' }, { status: 403 });
        }

        const body = await req.json();
        const content = body?.content;
        const visibilityInput = body?.visibility as string | undefined;
        const VISIBILITY_VALUES = ['public', 'followers', 'private'] as const;
        type Visibility = (typeof VISIBILITY_VALUES)[number];

        const hasContent = typeof content === 'string';
        const hasVisibility = typeof visibilityInput === 'string';

        if (!hasContent && !hasVisibility) {
            return NextResponse.json(
                { error: 'Provide content and/or visibility to update.' },
                { status: 400 }
            );
        }

        if (hasVisibility) {
            if (!(VISIBILITY_VALUES as readonly string[]).includes(visibilityInput)) {
                return NextResponse.json(
                    { error: 'Visibility must be public, followers, or private.' },
                    { status: 400 }
                );
            }
            post.visibility = visibilityInput as Visibility;
        }

        if (hasContent) {
            if (content.trim().length === 0 && !post.poll) {
                return NextResponse.json({ error: 'Content is required.' }, { status: 400 });
            }
            if (content.length > 500) {
                return NextResponse.json({ error: 'Content cannot be more than 500 characters.' }, { status: 400 });
            }

            const trimmed = content.trim();
            const previousMentionIds = new Set(
                (post.mentions ?? []).map((m: { user: { toString(): string } }) => m.user.toString())
            );

            const tagsArray = extractHashtags(trimmed);
            const mentionsArray = await resolveMentionsFromContent(trimmed);

            post.content = trimmed;
            post.tags = tagsArray;
            post.mentions = mentionsArray;

            const newMentions = mentionsArray.filter((m) => !previousMentionIds.has(m.user));
            await Promise.all(
                newMentions.map((m) =>
                    createNotification({
                        recipient: m.user,
                        actor: userId,
                        type: "mention",
                        post: post._id.toString(),
                    })
                )
            );
        }

        post.editedAt = new Date();
        await post.save();

        await post.populate('author', 'username fullname avatar');

        const updatedPost = post.toObject();
        const postWithLike = withPollViewerState(
            {
                ...updatedPost,
                isLiked: isLikedBy((updatedPost as { likes?: LikeRef[] }).likes, userId),
                isReposted: isRepostedBy((updatedPost as { reposts?: RepostRef[] }).reposts, userId)
            },
            userId
        );

        return NextResponse.json({ post: postWithLike }, { status: 200 });
    } catch (err) {
        console.error('PATCH /api/post/[id] error:', err);
        return NextResponse.json(
            { error: 'Unexpected server error. Please try again later.' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();

        const cookieStore = cookies();
        const atk = (await cookieStore).get('atk')?.value;
        if (!atk) {
            return NextResponse.json({ error: 'Authentication token missing.' }, { status: 401 });
        }

        const payload = await verifyAccessToken(atk);
        const userId = payload.uid as string;

        const { id } = await params;
        if (!isValidObjectId(id)) {
            return NextResponse.json({ error: 'Invalid post id.' }, { status: 400 });
        }

        const post = await PostModel.findOne({ _id: id, isDeleted: false });
        if (!post) {
            return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
        }

        if (post.author.toString() !== userId) {
            return NextResponse.json({ error: 'You are not allowed to delete this post.' }, { status: 403 });
        }

        post.isDeleted = true;
        await post.save();

        await ReplyModel.updateMany({ parentPost: id, isDeleted: false }, { isDeleted: true });

        return NextResponse.json({ msg: 'post deleted successfully' }, { status: 200 });
    } catch (err) {
        console.error('DELETE /api/post/[id] error:', err);
        return NextResponse.json(
            { error: 'Unexpected server error. Please try again later.' },
            { status: 500 }
        );
    }
}
