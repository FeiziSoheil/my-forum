import { verifyAccessToken } from "@/lib/auth/jwt";
import { dbConnect } from "@/lib/db/mongodb";
import { PostModel } from "@/models/Post";
import { getOptionalUserId, isLikedBy, isRepostedBy, LikeRef, RepostRef } from "@/lib/auth/session";
import { withPollViewerState } from "@/lib/poll/attachPollViewer";
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

        const myReposts = await PostModel.find({ 'reposts.user': userId, isDeleted: false })
            .populate('author', 'username fullname avatar')
            .sort({ _id: -1 })
            .lean()

        const viewerId = await getOptionalUserId(req)
        const postsWithLike = myReposts.map(post =>
            withPollViewerState(
                {
                    ...post,
                    isLiked: isLikedBy(post.likes as LikeRef[] | undefined, viewerId),
                    isReposted: isRepostedBy(post.reposts as RepostRef[] | undefined, viewerId)
                },
                viewerId
            )
        )

        return NextResponse.json({ myReposts: postsWithLike }, { status: 200 })
    } catch (err) {
        console.error('GET /api/user/reposts error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch reposts' },
            { status: 500 }
        );
    }
}
