import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import { StoryModel } from "@/models/Story";

export async function GET(
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
    const story = (await StoryModel.findOne({
      _id: id,
      expiresAt: { $gt: now },
    })
      .select("author viewsCount viewers")
      .populate("viewers.user", "username fullname avatar")
      .lean()) as {
      author: { toString(): string };
      viewsCount?: number;
      viewers?: Array<{
        user?: {
          _id: { toString(): string };
          username: string;
          fullname: string;
          avatar?: string;
        } | null;
        viewedAt?: Date;
      }>;
    } | null;

    if (!story) {
      return NextResponse.json(
        { error: "Story not found or expired." },
        { status: 404 }
      );
    }

    if (story.author.toString() !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const viewers = (story.viewers ?? [])
      .map((v) => {
        if (!v.user || typeof v.user === "string" || !("username" in v.user)) {
          return null;
        }
        return {
          _id: v.user._id.toString(),
          username: v.user.username,
          fullname: v.user.fullname,
          avatar: v.user.avatar,
          viewedAt: v.viewedAt ?? new Date(),
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .reverse();

    return NextResponse.json(
      { viewers, viewsCount: story.viewsCount ?? 0 },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/stories/[id]/viewers error:", err);
    return NextResponse.json(
      { error: "Failed to fetch viewers" },
      { status: 500 }
    );
  }
}
