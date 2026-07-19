import { dbConnect } from "@/lib/db/mongodb";
import { ReplyModel } from "@/models/Reply";
import { UserModel } from "@/models/User";
import { canViewPrivateAuthorAsync, getOptionalUserId, isLikedBy, LikeRef } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    try {
        await dbConnect();

        const { username } = await params;

        const user = await UserModel.findOne({ username }).select('_id isPrivate') as
            | { _id: { toString(): string }; isPrivate?: boolean }
            | null;
        if (!user) {
            return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }

        const viewerId = await getOptionalUserId(req);

        // Account-level privacy: a private account only exposes its replies to
        // the owner and existing followers. Everyone else gets a locked list.
        if (!(await canViewPrivateAuthorAsync(user, viewerId))) {
            return NextResponse.json({ replies: [], locked: true }, { status: 200 });
        }

        const replies = await ReplyModel.find({ author: user._id, isDeleted: false })
            .populate('author', 'username fullname avatar')
            .sort({ _id: -1 })
            .lean();

        const repliesWithLike = replies.map(reply => ({
            ...reply,
            isLiked: isLikedBy(reply.likes as LikeRef[] | undefined, viewerId),
        }));

        return NextResponse.json({ replies: repliesWithLike }, { status: 200 });
    } catch (err) {
        console.error('GET /api/user/[username]/replies error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch replies' },
            { status: 500 }
        );
    }
}
