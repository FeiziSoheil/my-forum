import { verifyAccessToken } from "@/lib/auth/jwt";
import { dbConnect } from "@/lib/db/mongodb";
import { saveFile } from "@/lib/fileHandler";
import { resolveMentionsFromContent } from "@/lib/mentions/resolveMentions";
import { createNotification } from "@/lib/notifications/createNotification";
import { extractHashtags } from "@/lib/tags/extractHashtags";
import { PostModel } from "@/models/Post";
import { ReplyModel } from "@/models/Reply";
import { MediaItem } from "@/types/post";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { isValidObjectId } from "mongoose";
import { getOptionalUserId, isLikedBy, LikeRef } from "@/lib/auth/session";
import { MAX_THREAD_LEVEL } from "@/lib/replies/constants";
import { orderRepliesThreaded } from "@/lib/replies/threadOrder";
import { FollowRequestModel } from "@/models/FollowRequest";
import { getFollowingIds } from "@/lib/follow/edges";

const replyPopulate = [
    { path: 'author', select: 'username fullname avatar' },
    {
        path: 'parentReply',
        select: 'content author',
        populate: { path: 'author', select: 'username fullname avatar' },
    },
];

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

        const MAX_LIMIT = 50;
        const limit = Math.min(
            parseInt(req.nextUrl.searchParams.get('limit') || '10'),
            MAX_LIMIT
        );
        const cursor = req.nextUrl.searchParams.get('cursor');

        // Paginate top-level replies only; nest children under each parent in the response.
        const topQuery: Record<string, unknown> = {
            parentPost: id,
            isDeleted: false,
            $or: [{ parentReply: null }, { parentReply: { $exists: false } }],
        };
        if (cursor) {
            topQuery._id = { $gt: new ObjectId(cursor) };
        }

        const topReplies = await ReplyModel.find(topQuery)
            .populate(replyPopulate)
            .sort({ _id: 1 })
            .limit(limit + 1)
            .lean();

        const hasMore = topReplies.length > limit;
        if (hasMore) {
            topReplies.pop();
        }

        const nextCursor =
            topReplies.length > 0 ? topReplies[topReplies.length - 1]._id : null;

        const topIds = topReplies.map((r) => r._id);
        let nested: typeof topReplies = [];

        if (topIds.length > 0) {
            // Direct children of this page's top-level replies
            const level1 = await ReplyModel.find({
                parentPost: id,
                isDeleted: false,
                parentReply: { $in: topIds },
            })
                .populate(replyPopulate)
                .sort({ _id: 1 })
                .lean();

            const level1Ids = level1.map((r) => r._id);
            const level2 =
                level1Ids.length > 0
                    ? await ReplyModel.find({
                          parentPost: id,
                          isDeleted: false,
                          parentReply: { $in: level1Ids },
                      })
                          .populate(replyPopulate)
                          .sort({ _id: 1 })
                          .lean()
                    : [];

            nested = [...level1, ...level2];
        }

        const replies = orderRepliesThreaded([...topReplies, ...nested]);

        const userId = await getOptionalUserId(req);

        const authorIds = [
            ...new Set(
                replies
                    .map((r) => {
                        const a = r.author as { _id?: { toString(): string } } | null;
                        return a?._id?.toString();
                    })
                    .filter((aid): aid is string => !!aid)
            ),
        ];

        const followingSet = new Set<string>();
        const requestedSet = new Set<string>();

        if (userId && authorIds.length > 0) {
            const myFollowing = await getFollowingIds(userId);
            const myFollowingSet = new Set(myFollowing.map((fid) => fid.toString()));
            for (const aid of authorIds) {
                if (myFollowingSet.has(aid)) followingSet.add(aid);
            }

            const pending = await FollowRequestModel.find({
                from: userId,
                to: { $in: authorIds },
                status: "pending",
            })
                .select("to")
                .lean();

            for (const reqDoc of pending) {
                requestedSet.add(reqDoc.to.toString());
            }
        }

        const repliesWithLike = replies.map((reply) => {
            const authorId = (reply.author as { _id?: { toString(): string } } | null)?._id?.toString();
            return {
                ...reply,
                isLiked: isLikedBy(reply.likes as LikeRef[] | undefined, userId),
                isFollowing: !!authorId && followingSet.has(authorId),
                isRequested: !!authorId && requestedSet.has(authorId),
            };
        });

        return NextResponse.json({
            hasMore,
            replies: repliesWithLike,
            nextCursor: nextCursor?.toString()
        }, { status: 200 });
    } catch (err) {
        console.error('GET /api/post/[id]/replies error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch replies' },
            { status: 500 }
        );
    }
}

export async function POST(
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

        const parentPost = await PostModel.findOne({ _id: id, isDeleted: false });
        if (!parentPost) {
            return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
        }

        const formData = await req.formData();
        const content = formData.get('content') as string;
        const mediaFiles = formData.getAll('media') as File[];
        const parentReplyRaw =
            (formData.get('parentReply') as string | null) ||
            (formData.get('parentReplyId') as string | null) ||
            null;

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return NextResponse.json({ error: 'Content is required.' }, { status: 400 });
        }
        if (content.length > 500) {
            return NextResponse.json({ error: 'Content cannot be more than 500 characters.' }, { status: 400 });
        }

        let parentReplyId: string | null = null;
        let threadLevel = 0;
        let parentReplyAuthorId: string | null = null;

        if (parentReplyRaw) {
            if (!isValidObjectId(parentReplyRaw)) {
                return NextResponse.json({ error: 'Invalid parent reply id.' }, { status: 400 });
            }

            const parentReply = await ReplyModel.findOne({
                _id: parentReplyRaw,
                isDeleted: false,
            });

            if (!parentReply) {
                return NextResponse.json({ error: 'Parent reply not found.' }, { status: 404 });
            }

            if (parentReply.parentPost.toString() !== id) {
                return NextResponse.json(
                    { error: 'Parent reply does not belong to this post.' },
                    { status: 400 }
                );
            }

            if (parentReply.threadLevel >= MAX_THREAD_LEVEL) {
                return NextResponse.json(
                    {
                        error: `Maximum nesting depth exceeded. Replies can only nest up to ${MAX_THREAD_LEVEL} levels.`,
                    },
                    { status: 400 }
                );
            }

            parentReplyId = parentReply._id.toString();
            threadLevel = parentReply.threadLevel + 1;
            parentReplyAuthorId = parentReply.author.toString();
        }

        const media: MediaItem[] = [];
        for (const file of mediaFiles) {
            if (file && file.size > 0) {
                const mediaResult = await saveFile(file);
                if (mediaResult) {
                    media.push(mediaResult);
                }
            }
        }

        const tagsArray = extractHashtags(content);
        const mentionsArray = await resolveMentionsFromContent(content);

        const newReply = {
            content,
            author: userId,
            parentPost: id,
            parentReply: parentReplyId,
            threadLevel,
            media,
            tags: tagsArray,
            mentions: mentionsArray,
            likesCount: 0,
            repliesCount: 0,
            likes: [],
            isDeleted: false,
            visibility: 'public'
        };

        const reply = await ReplyModel.create(newReply);
        await PostModel.updateOne({ _id: id }, { $inc: { repliesCount: 1 } });

        if (parentReplyId) {
            await ReplyModel.updateOne(
                { _id: parentReplyId },
                { $inc: { repliesCount: 1 } }
            );
        }

        const postAuthorId = parentPost.author.toString();
        const replyId = reply._id.toString();

        // Notify post author of any reply on their post
        await createNotification({
            recipient: postAuthorId,
            actor: userId,
            type: 'reply',
            post: id,
            reply: replyId,
        });

        // Notify parent reply author when nesting (skip if same as post author — already notified)
        if (parentReplyAuthorId && parentReplyAuthorId !== postAuthorId) {
            await createNotification({
                recipient: parentReplyAuthorId,
                actor: userId,
                type: 'reply',
                post: id,
                reply: replyId,
            });
        }

        await Promise.all(
            mentionsArray.map((m) =>
                createNotification({
                    recipient: m.user,
                    actor: userId,
                    type: "mention",
                    post: id,
                    reply: replyId,
                })
            )
        );

        const populatedReply = await ReplyModel.findById(reply._id)
            .populate('author', 'username fullname avatar')
            .populate({
                path: 'parentReply',
                select: 'content author',
                populate: { path: 'author', select: 'username fullname avatar' },
            });

        return NextResponse.json({ msg: 'reply create successfull ', reply: populatedReply }, { status: 201 });
    } catch (err) {
        console.error('POST /api/post/[id]/replies error:', err);
        return NextResponse.json(
            { error: 'Unexpected server error. Please try again later.' },
            { status: 500 }
        );
    }
}
