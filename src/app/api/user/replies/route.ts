import { verifyAccessToken } from "@/lib/auth/jwt";
import { dbConnect } from "@/lib/db/mongodb";
import { ReplyModel } from "@/models/Reply";
import { getOptionalUserId, isLikedBy, LikeRef } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        await dbConnect()

        const cookieStore = cookies()
        const atk = (await cookieStore).get('atk')?.value
        if (!atk) {
            return NextResponse.json({ error: 'Authentication token missing.' }, { status: 401 });
        }

        const payload = await verifyAccessToken(atk)
        const userId = payload.uid as string

        const myReplies = await ReplyModel.find({ author: userId, isDeleted: false })
            .populate('author', 'username fullname avatar')
            .sort({ _id: -1 })
            .lean()

        const viewerId = await getOptionalUserId(req)
        const repliesWithLike = myReplies.map(reply => ({
            ...reply,
            isLiked: isLikedBy(reply.likes as LikeRef[] | undefined, viewerId)
        }))

        return NextResponse.json({ myReply: repliesWithLike }, { status: 200 })
    } catch (err) {
        console.error('GET /api/user/replies error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch replies' },
            { status: 500 }
        );
    }
}
