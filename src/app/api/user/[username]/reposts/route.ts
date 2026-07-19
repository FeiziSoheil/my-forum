import { dbConnect } from "@/lib/db/mongodb";
import { PostModel } from "@/models/Post";
import { UserModel } from "@/models/User";
import { canViewPrivateAuthorAsync, getOptionalUserId, isLikedBy, isRepostedBy, LikeRef, RepostRef } from "@/lib/auth/session";
import { withPollViewerState } from "@/lib/poll/attachPollViewer";
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

        // Account-level privacy: a private account only exposes its reposts to
        // the owner and existing followers. Everyone else gets a locked list.
        if (!(await canViewPrivateAuthorAsync(user, viewerId))) {
            return NextResponse.json({ posts: [], locked: true }, { status: 200 });
        }

        const posts = await PostModel.find({ 'reposts.user': user._id, isDeleted: false })
            .populate('author', 'username fullname avatar')
            .sort({ _id: -1 })
            .lean();

        const postsWithLike = posts.map(post =>
            withPollViewerState(
                {
                    ...post,
                    isLiked: isLikedBy(post.likes as LikeRef[] | undefined, viewerId),
                    isReposted: isRepostedBy(post.reposts as RepostRef[] | undefined, viewerId),
                },
                viewerId
            )
        );

        return NextResponse.json({ posts: postsWithLike }, { status: 200 });
    } catch (err) {
        console.error('GET /api/user/[username]/reposts error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch reposts' },
            { status: 500 }
        );
    }
}
