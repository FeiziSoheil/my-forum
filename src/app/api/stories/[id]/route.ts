import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import { getOptionalUserId } from "@/lib/auth/session";
import {
  LeanStory,
  serializeStory,
  STORY_AUTHOR_SELECT,
} from "@/lib/stories/serializeStory";
import { canViewStoryAuthor } from "@/lib/stories/storyAccess";
import { StoryModel } from "@/models/Story";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid story id." }, { status: 400 });
    }

    const userId = await getOptionalUserId(req);
    const now = new Date();

    const story = (await StoryModel.findOne({
      _id: id,
      expiresAt: { $gt: now },
    })
      .populate("author", STORY_AUTHOR_SELECT)
      .lean()) as LeanStory | null;

    if (!story) {
      return NextResponse.json(
        { error: "Story not found or expired." },
        { status: 404 }
      );
    }

    const serialized = serializeStory(story, userId);
    if (!serialized) {
      return NextResponse.json({ error: "Story not found." }, { status: 404 });
    }

    // Account-level privacy: hide a private author's story from non-followers.
    if (!(await canViewStoryAuthor(serialized.author._id, userId))) {
      return NextResponse.json(
        { error: "Story not found or expired." },
        { status: 404 }
      );
    }

    return NextResponse.json({ story: serialized }, { status: 200 });
  } catch (err) {
    console.error("GET /api/stories/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch story" },
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
      return NextResponse.json({ error: "Invalid story id." }, { status: 400 });
    }

    const story = await StoryModel.findById(id);
    if (!story) {
      return NextResponse.json({ error: "Story not found." }, { status: 404 });
    }

    if (story.author.toString() !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    await StoryModel.deleteOne({ _id: id });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/stories/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete story" },
      { status: 500 }
    );
  }
}
