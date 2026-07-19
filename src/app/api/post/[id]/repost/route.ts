import { verifyAccessToken } from "@/lib/auth/jwt";
import { dbConnect } from "@/lib/db/mongodb";
import { createNotification } from "@/lib/notifications/createNotification";
import { PostModel } from "@/models/Post";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

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

        const result = await PostModel.updateOne(
            { _id: id, isDeleted: false, 'reposts.user': { $ne: userId } },
            { $push: { reposts: { user: userId } }, $inc: { repostsCount: 1 } }
        );

        const post = await PostModel.findOne({ _id: id, isDeleted: false }).select('repostsCount author');
        if (!post) {
            return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
        }

        if (result.modifiedCount > 0) {
            await createNotification({
                recipient: post.author.toString(),
                actor: userId,
                type: 'repost',
                post: id,
            });
        }

        return NextResponse.json({ reposted: true, repostsCount: post.repostsCount }, { status: 200 });
    } catch (err) {
        console.error('POST /api/post/[id]/repost error:', err);
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

        await PostModel.updateOne(
            { _id: id, isDeleted: false, 'reposts.user': userId },
            { $pull: { reposts: { user: userId } }, $inc: { repostsCount: -1 } }
        );

        const post = await PostModel.findOne({ _id: id, isDeleted: false }).select('repostsCount');
        if (!post) {
            return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
        }

        return NextResponse.json({ reposted: false, repostsCount: post.repostsCount }, { status: 200 });
    } catch (err) {
        console.error('DELETE /api/post/[id]/repost error:', err);
        return NextResponse.json(
            { error: 'Unexpected server error. Please try again later.' },
            { status: 500 }
        );
    }
}
