import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import {
  canViewPrivateAuthorAsync,
  viewerFollowsAuthor,
} from "@/lib/auth/session";
import { PostModel } from "@/models/Post";
import { PostViewModel } from "@/models/PostView";
import { UserModel } from "@/models/User";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
    }

    const post = await PostModel.findOne({ _id: id, isDeleted: false }).select(
      "author visibility viewsCount"
    );

    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const authorId = post.author.toString();
    const isAuthor = authorId === userId;
    const visibility = post.visibility ?? "public";

    const author = (await UserModel.findById(authorId)
      .select("isPrivate")
      .lean()) as {
      _id: { toString(): string };
      isPrivate?: boolean;
    } | null;

    const isFollower = await viewerFollowsAuthor(userId, authorId);

    if (visibility !== "public") {
      let allowed = isAuthor;
      if (!allowed && visibility === "followers") {
        allowed = isFollower;
      }
      if (!allowed) {
        return NextResponse.json({ error: "Post not found." }, { status: 404 });
      }
    }

    if (author && !(await canViewPrivateAuthorAsync(author, userId))) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const viewsCount = post.viewsCount ?? 0;

    // Don't count owner's own views
    if (isAuthor) {
      return NextResponse.json(
        { viewed: true, viewsCount },
        { status: 200 }
      );
    }

    const now = new Date();

    try {
      await PostViewModel.create({ user: userId, post: id, viewedAt: now });
    } catch (err: unknown) {
      // Duplicate unique index → already viewed; bump recency only
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code: number }).code
          : null;
      if (code === 11000) {
        await PostViewModel.updateOne(
          { user: userId, post: id },
          { $set: { viewedAt: now } }
        );
        return NextResponse.json(
          { viewed: true, viewsCount },
          { status: 200 }
        );
      }
      throw err;
    }

    const updated = await PostModel.findByIdAndUpdate(
      id,
      { $inc: { viewsCount: 1 } },
      { new: true }
    ).select("viewsCount");

    return NextResponse.json(
      {
        viewed: true,
        viewsCount: updated?.viewsCount ?? viewsCount + 1,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/post/[id]/view error:", err);
    return NextResponse.json(
      { error: "Failed to record view" },
      { status: 500 }
    );
  }
}
