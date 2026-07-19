import { verifyAccessToken } from "@/lib/auth/jwt";
import { dbConnect } from "@/lib/db/mongodb";
import { resolveMentionsFromContent } from "@/lib/mentions/resolveMentions";
import { createNotification } from "@/lib/notifications/createNotification";
import { extractHashtags } from "@/lib/tags/extractHashtags";
import { PostModel } from "@/models/Post";
import { ReplyModel } from "@/models/Reply";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { getOptionalUserId, isLikedBy, LikeRef } from "@/lib/auth/session";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; replyId: string }> }
) {
    try {
        await dbConnect();

        const { id, replyId } = await params;
        if (!isValidObjectId(id) || !isValidObjectId(replyId)) {
            return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
        }

        const reply = await ReplyModel.findOne({
            _id: replyId,
            parentPost: id,
            isDeleted: false,
        })
            .populate('author', 'username fullname avatar')
            .populate({
                path: 'parentReply',
                select: 'content author',
                populate: { path: 'author', select: 'username fullname avatar' },
            })
            .lean();

        if (!reply) {
            return NextResponse.json({ error: 'Reply not found.' }, { status: 404 });
        }

        const userId = await getOptionalUserId(req);
        const likes = (reply as { likes?: LikeRef[] }).likes;

        return NextResponse.json(
            {
                reply: {
                    ...reply,
                    isLiked: isLikedBy(likes, userId),
                },
            },
            { status: 200 }
        );
    } catch (err) {
        console.error('GET /api/post/[id]/replies/[replyId] error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch reply' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; replyId: string }> }
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

        const { id, replyId } = await params;
        if (!isValidObjectId(id) || !isValidObjectId(replyId)) {
            return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
        }

        const reply = await ReplyModel.findOne({ _id: replyId, parentPost: id, isDeleted: false });
        if (!reply) {
            return NextResponse.json({ error: 'Reply not found.' }, { status: 404 });
        }

        if (reply.author.toString() !== userId) {
            return NextResponse.json({ error: 'You are not allowed to edit this reply.' }, { status: 403 });
        }

        const body = await req.json();
        const content = body?.content;

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return NextResponse.json({ error: 'Content is required.' }, { status: 400 });
        }
        if (content.length > 500) {
            return NextResponse.json({ error: 'Content cannot be more than 500 characters.' }, { status: 400 });
        }

        const trimmed = content.trim();
        const previousMentionIds = new Set(
            (reply.mentions ?? []).map((m: { user: { toString(): string } }) => m.user.toString())
        );

        const tagsArray = extractHashtags(trimmed);
        const mentionsArray = await resolveMentionsFromContent(trimmed);

        reply.content = trimmed;
        reply.tags = tagsArray;
        reply.mentions = mentionsArray;
        reply.editedAt = new Date();
        await reply.save();

        const newMentions = mentionsArray.filter((m) => !previousMentionIds.has(m.user));
        await Promise.all(
            newMentions.map((m) =>
                createNotification({
                    recipient: m.user,
                    actor: userId,
                    type: "mention",
                    post: id,
                    reply: replyId,
                })
            )
        );

        const populatedReply = await reply.populate('author', 'username fullname avatar');

        return NextResponse.json({ reply: populatedReply }, { status: 200 });
    } catch (err) {
        console.error('PATCH /api/post/[id]/replies/[replyId] error:', err);
        return NextResponse.json(
            { error: 'Unexpected server error. Please try again later.' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; replyId: string }> }
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

        const { id, replyId } = await params;
        if (!isValidObjectId(id) || !isValidObjectId(replyId)) {
            return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
        }

        const reply = await ReplyModel.findOne({ _id: replyId, parentPost: id, isDeleted: false });
        if (!reply) {
            return NextResponse.json({ error: 'Reply not found.' }, { status: 404 });
        }

        if (reply.author.toString() !== userId) {
            return NextResponse.json({ error: 'You are not allowed to delete this reply.' }, { status: 403 });
        }

        reply.isDeleted = true;
        await reply.save();

        await PostModel.updateOne({ _id: id }, { $inc: { repliesCount: -1 } });

        if (reply.parentReply) {
            await ReplyModel.updateOne(
                { _id: reply.parentReply },
                { $inc: { repliesCount: -1 } }
            );
        }

        return NextResponse.json({ msg: 'reply deleted successfully' }, { status: 200 });
    } catch (err) {
        console.error('DELETE /api/post/[id]/replies/[replyId] error:', err);
        return NextResponse.json(
            { error: 'Unexpected server error. Please try again later.' },
            { status: 500 }
        );
    }
}
