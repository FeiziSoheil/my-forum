import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import { createNotification } from "@/lib/notifications/createNotification";
import { canViewStoryAuthor } from "@/lib/stories/storyAccess";
import { StoryModel } from "@/models/Story";

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
      return NextResponse.json({ error: "Invalid story id." }, { status: 400 });
    }

    const now = new Date();
    const story = await StoryModel.findOne({
      _id: id,
      expiresAt: { $gt: now },
    }).select("likesCount author likes");

    if (!story) {
      return NextResponse.json(
        { error: "Story not found or expired." },
        { status: 404 }
      );
    }

    // Account-level privacy: a private author's story is only visible to the
    // owner and existing followers.
    if (!(await canViewStoryAuthor(story.author.toString(), userId))) {
      return NextResponse.json(
        { error: "Story not found or expired." },
        { status: 404 }
      );
    }

    const alreadyLiked = (story.likes ?? []).some(
      (l) => l.user?.toString() === userId
    );

    if (alreadyLiked) {
      await StoryModel.updateOne(
        { _id: id, "likes.user": userId },
        { $pull: { likes: { user: userId } }, $inc: { likesCount: -1 } }
      );
      const updated = await StoryModel.findById(id).select("likesCount");
      return NextResponse.json(
        { liked: false, likesCount: updated?.likesCount ?? 0 },
        { status: 200 }
      );
    }

    await StoryModel.updateOne(
      { _id: id, "likes.user": { $ne: userId } },
      { $push: { likes: { user: userId } }, $inc: { likesCount: 1 } }
    );

    const updated = await StoryModel.findById(id).select("likesCount author");
    await createNotification({
      recipient: story.author.toString(),
      actor: userId,
      type: "like_story",
      story: id,
    });

    return NextResponse.json(
      { liked: true, likesCount: updated?.likesCount ?? story.likesCount + 1 },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/stories/[id]/like error:", err);
    return NextResponse.json(
      { error: "Failed to like story" },
      { status: 500 }
    );
  }
}
