import { dbConnect } from "@/lib/db/mongodb";
import { PostModel } from "@/models/Post";
import { UserModel } from "@/models/User";
import { BookmarkModel } from "@/models/Bookmark";
import {
    canViewPrivateAuthorAsync,
    getOptionalUserId,
    isLikedBy,
    isRepostedBy,
    LikeRef,
    RepostRef,
    viewerFollowsAuthor,
} from "@/lib/auth/session";
import { withPollViewerState } from "@/lib/poll/attachPollViewer";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    try {
        await dbConnect();

        const { username } = await params;

        const user = await UserModel.findOne({ username }).select('_id isPrivate') as
            | { _id: ObjectId; isPrivate?: boolean }
            | null;
        if (!user) {
            return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }

        const viewerId = await getOptionalUserId(req);
        const authorId = user._id.toString();
        const isAuthor = !!viewerId && viewerId === authorId;
        const isFollower = await viewerFollowsAuthor(viewerId, authorId);

        // Account-level privacy: a private account only exposes its posts to the
        // owner and existing followers. Everyone else gets a locked, empty list.
        if (!(await canViewPrivateAuthorAsync(user, viewerId))) {
            return NextResponse.json({ posts: [], locked: true }, { status: 200 });
        }

        // Which visibility levels the viewer is allowed to see on this profile.
        const allowedVisibilities = isAuthor
            ? ['public', 'followers', 'private']
            : isFollower
                ? ['public', 'followers']
                : ['public'];

        const posts = await PostModel.find({
            author: user._id,
            isDeleted: false,
            visibility: { $in: allowedVisibilities },
        })
            .populate('author', 'username fullname avatar')
            .sort({ isPinned: -1, pinnedAt: -1, _id: -1 })
            .lean();

        let bookmarkedSet = new Set<string>();
        if (viewerId && posts.length > 0) {
            const ids = posts.map((p) => p._id);
            const bookmarks = await BookmarkModel.find({ user: viewerId, post: { $in: ids } })
                .select('post')
                .lean() as unknown as { post: ObjectId }[];
            bookmarkedSet = new Set(bookmarks.map((b) => b.post.toString()));
        }

        const postsWithLike = posts.map(post =>
            withPollViewerState(
                {
                    ...post,
                    isLiked: isLikedBy(post.likes as LikeRef[] | undefined, viewerId),
                    isReposted: isRepostedBy(post.reposts as RepostRef[] | undefined, viewerId),
                    isBookmarked: bookmarkedSet.has(String(post._id))
                },
                viewerId
            )
        );

        return NextResponse.json({ posts: postsWithLike }, { status: 200 });
    } catch (err) {
        console.error('GET /api/user/[username]/posts error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch posts' },
            { status: 500 }
        );
    }
}
