import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import {
  canViewPrivateAuthorAsync,
  viewerFollowsAuthor,
} from "@/lib/auth/session";
import { PostFeedbackModel } from "@/models/PostFeedback";
import { PostModel } from "@/models/Post";
import { UserModel } from "@/models/User";

const FEEDBACK_TYPES = ["not_interested"] as const;
type FeedbackType = (typeof FEEDBACK_TYPES)[number];

async function assertCanSeePost(postId: string, userId: string) {
  const post = await PostModel.findOne({ _id: postId, isDeleted: false }).select(
    "author visibility"
  );
  if (!post) return { error: NextResponse.json({ error: "Post not found." }, { status: 404 }) };

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
    if (!allowed && visibility === "followers") allowed = isFollower;
    if (!allowed) {
      return { error: NextResponse.json({ error: "Post not found." }, { status: 404 }) };
    }
  }

  if (author && !(await canViewPrivateAuthorAsync(author, userId))) {
    return { error: NextResponse.json({ error: "Post not found." }, { status: 404 }) };
  }

  return { post, authorId, isAuthor };
}

export async function POST(
  req: NextRequest,
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

    const body = (await req.json().catch(() => ({}))) as { type?: string };
    const type = (body.type || "not_interested") as FeedbackType;
    if (!FEEDBACK_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid feedback type." }, { status: 400 });
    }

    const access = await assertCanSeePost(id, userId);
    if ("error" in access) return access.error;
    if (access.isAuthor) {
      return NextResponse.json(
        { error: "Cannot mark your own post as not interested." },
        { status: 400 }
      );
    }

    await PostFeedbackModel.updateOne(
      { user: userId, post: id, type },
      {
        $set: {
          user: userId,
          post: id,
          author: access.authorId,
          type,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, type }, { status: 200 });
  } catch (err) {
    console.error("POST /api/post/[id]/feedback error:", err);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    await PostFeedbackModel.deleteOne({
      user: userId,
      post: id,
      type: "not_interested",
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/post/[id]/feedback error:", err);
    return NextResponse.json(
      { error: "Failed to remove feedback" },
      { status: 500 }
    );
  }
}
