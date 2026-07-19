import { verifyAccessToken } from "@/lib/auth/jwt";
import { dbConnect } from "@/lib/db/mongodb";
import { PostModel } from "@/models/Post";
import { BookmarkModel } from "@/models/Bookmark";
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

        const post = await PostModel.findOne({ _id: id, isDeleted: false }).select('_id');
        if (!post) {
            return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
        }

        await BookmarkModel.updateOne(
            { user: userId, post: id },
            { $setOnInsert: { user: userId, post: id } },
            { upsert: true }
        );

        return NextResponse.json({ bookmarked: true }, { status: 200 });
    } catch (err) {
        console.error('POST /api/post/[id]/bookmark error:', err);
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

        await BookmarkModel.deleteOne({ user: userId, post: id });

        return NextResponse.json({ bookmarked: false }, { status: 200 });
    } catch (err) {
        console.error('DELETE /api/post/[id]/bookmark error:', err);
        return NextResponse.json(
            { error: 'Unexpected server error. Please try again later.' },
            { status: 500 }
        );
    }
}
