import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import {
  isLikedBy,
  isRepostedBy,
  LikeRef,
  RepostRef,
} from "@/lib/auth/session";
import { withPollViewerState } from "@/lib/poll/attachPollViewer";
import { getRankedForYouPosts } from "@/lib/recommendations/rankPosts";
import { BookmarkModel } from "@/models/Bookmark";
import { PostModel } from "@/models/Post";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;

    const MAX_LIMIT = 50;
    const limit = Math.min(
      parseInt(req.nextUrl.searchParams.get("limit") || "10", 10) || 10,
      MAX_LIMIT
    );
    const cursor = req.nextUrl.searchParams.get("cursor");

    const ranked = await getRankedForYouPosts({
      userId,
      limit,
      cursor,
    });

    const posts = ranked.posts;
    await PostModel.populate(posts, {
      path: "author",
      select: "username fullname avatar",
    });

    let bookmarkedSet = new Set<string>();
    if (posts.length > 0) {
      const ids = posts.map((p) => p._id);
      const bookmarks = (await BookmarkModel.find({
        user: userId,
        post: { $in: ids },
      })
        .select("post")
        .lean()) as unknown as { post: ObjectId }[];
      bookmarkedSet = new Set(bookmarks.map((b) => b.post.toString()));
    }

    const postsWithFlags = posts.map((post) =>
      withPollViewerState(
        {
          ...post,
          isLiked: isLikedBy(post.likes as LikeRef[] | undefined, userId),
          isReposted: isRepostedBy(post.reposts as RepostRef[] | undefined, userId),
          isBookmarked: bookmarkedSet.has(String(post._id)),
        },
        userId
      )
    );

    return NextResponse.json(
      {
        hasMore: ranked.hasMore,
        posts: postsWithFlags,
        nextCursor: ranked.nextCursor,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/recommendations/posts error:", err);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
