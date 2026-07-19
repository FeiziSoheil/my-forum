import { verifyAccessToken } from "@/lib/auth/jwt";
import { dbConnect } from "@/lib/db/mongodb";
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

        const post = await PostModel.findOne({ _id: id, isDeleted: false });
        if (!post) {
            return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
        }

        if (post.author.toString() !== userId) {
            return NextResponse.json({ error: 'You are not allowed to pin this post.' }, { status: 403 });
        }

        // Only one pinned post per author: unpin any others first.
        await PostModel.updateMany(
            { author: userId, isPinned: true, _id: { $ne: id } },
            { $set: { isPinned: false }, $unset: { pinnedAt: '' } }
        );

        post.isPinned = true;
        post.pinnedAt = new Date();
        await post.save();

        return NextResponse.json({ isPinned: true, pinnedAt: post.pinnedAt }, { status: 200 });
    } catch (err) {
        console.error('POST /api/post/[id]/pin error:', err);
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
            return NextResponse.json({ error: 'You are not allowed to unpin this post.' }, { status: 403 });
        }

        post.isPinned = false;
        post.pinnedAt = undefined;
        await post.save();

        return NextResponse.json({ isPinned: false }, { status: 200 });
    } catch (err) {
        console.error('DELETE /api/post/[id]/pin error:', err);
        return NextResponse.json(
            { error: 'Unexpected server error. Please try again later.' },
            { status: 500 }
        );
    }
}
