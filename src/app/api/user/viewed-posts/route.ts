import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import {
  isLikedBy,
  isRepostedBy,
  LikeRef,
  RepostRef,
} from "@/lib/auth/session";
import { withPollViewerState } from "@/lib/poll/attachPollViewer";
import {
  getBlockedPrivateAuthorIds,
  visibilityClause,
} from "@/lib/recommendations/visibility";
import { getFollowingIds } from "@/lib/follow/edges";
import { BookmarkModel } from "@/models/Bookmark";
import { PostModel } from "@/models/Post";
import { PostViewModel } from "@/models/PostView";

type ViewRow = {
  _id: ObjectId;
  post: ObjectId;
  sortAt: Date;
};

function encodeCursor(sortAt: Date, id: ObjectId | string): string {
  return `${sortAt.toISOString()}|${id.toString()}`;
}

function decodeCursor(
  cursor: string | null
): { sortAt: Date; id: ObjectId } | null {
  if (!cursor) return null;
  const [iso, id] = cursor.split("|");
  if (!iso || !id || !isValidObjectId(id)) return null;
  const sortAt = new Date(iso);
  if (Number.isNaN(sortAt.getTime())) return null;
  return { sortAt, id: new ObjectId(id) };
}

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
    const cursor = decodeCursor(req.nextUrl.searchParams.get("cursor"));

    const followingIds = await getFollowingIds(userId);

    const blockedAuthorIds = await getBlockedPrivateAuthorIds(
      userId,
      followingIds
    );

    const views = (await PostViewModel.aggregate([
      { $match: { user: new ObjectId(userId) } },
      {
        $addFields: {
          sortAt: { $ifNull: ["$viewedAt", "$createdAt"] },
        },
      },
      ...(cursor
        ? [
            {
              $match: {
                $or: [
                  { sortAt: { $lt: cursor.sortAt } },
                  {
                    sortAt: cursor.sortAt,
                    _id: { $lt: cursor.id },
                  },
                ],
              },
            },
          ]
        : []),
      { $sort: { sortAt: -1, _id: -1 } },
      { $limit: limit + 1 },
      { $project: { post: 1, sortAt: 1 } },
    ])) as ViewRow[];

    const hasMore = views.length > limit;
    if (hasMore) views.pop();

    if (views.length === 0) {
      return NextResponse.json(
        { posts: [], hasMore: false, nextCursor: null },
        { status: 200 }
      );
    }

    const postIds = views.map((v) => v.post);
    const postQuery: Record<string, unknown> = {
      _id: { $in: postIds },
      isDeleted: false,
      ...visibilityClause(userId, followingIds),
    };
    if (blockedAuthorIds.length > 0) {
      postQuery.author = { $nin: blockedAuthorIds };
    }

    const posts = await PostModel.find(postQuery)
      .populate("author", "username fullname avatar")
      .lean();

    const postById = new Map(
      posts.map((p) => [String(p._id), p] as const)
    );

    const ordered = views
      .map((v) => postById.get(String(v.post)))
      .filter((p): p is (typeof posts)[number] => Boolean(p));

    let bookmarkedSet = new Set<string>();
    if (ordered.length > 0) {
      const ids = ordered.map((p) => p._id);
      const bookmarks = (await BookmarkModel.find({
        user: userId,
        post: { $in: ids },
      })
        .select("post")
        .lean()) as unknown as { post: ObjectId }[];
      bookmarkedSet = new Set(bookmarks.map((b) => b.post.toString()));
    }

    const postsWithFlags = ordered.map((post) =>
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

    const lastView = views[views.length - 1];
    const nextCursor =
      hasMore && lastView
        ? encodeCursor(lastView.sortAt, lastView._id)
        : null;

    return NextResponse.json(
      {
        posts: postsWithFlags,
        hasMore,
        nextCursor,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/user/viewed-posts error:", err);
    return NextResponse.json(
      { error: "Failed to fetch viewed posts" },
      { status: 500 }
    );
  }
}
