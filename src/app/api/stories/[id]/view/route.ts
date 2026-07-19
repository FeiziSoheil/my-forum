import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
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
    }).select("author viewers viewsCount");

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

    // Don't count owner's own views
    if (story.author.toString() === userId) {
      return NextResponse.json(
        { viewed: true, viewsCount: story.viewsCount },
        { status: 200 }
      );
    }

    const alreadyViewed = story.viewers?.some(
      (v: { user?: { toString(): string } }) => v.user?.toString() === userId
    );

    if (alreadyViewed) {
      return NextResponse.json(
        { viewed: true, viewsCount: story.viewsCount },
        { status: 200 }
      );
    }

    await StoryModel.updateOne(
      { _id: id, "viewers.user": { $ne: userId } },
      {
        $push: { viewers: { user: userId, viewedAt: new Date() } },
        $inc: { viewsCount: 1 },
      }
    );

    const updated = await StoryModel.findById(id).select("viewsCount");
    return NextResponse.json(
      {
        viewed: true,
        viewsCount: updated?.viewsCount ?? story.viewsCount + 1,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/stories/[id]/view error:", err);
    return NextResponse.json(
      { error: "Failed to record view" },
      { status: 500 }
    );
  }
}
