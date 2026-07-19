import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import { getOptionalUserId } from "@/lib/auth/session";
import { getFollowingIds } from "@/lib/follow/edges";
import { saveFile } from "@/lib/fileHandler";
import {
  LeanStory,
  serializeStory,
  STORY_AUTHOR_SELECT,
} from "@/lib/stories/serializeStory";
import { StoryModel } from "@/models/Story";
import { UserModel } from "@/models/User";
import { STORY_BACKGROUND_COLORS, StoryGroup } from "@/types/story";
import { ObjectId } from "mongodb";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const userId = await getOptionalUserId(req);
    const now = new Date();

    // Account-level privacy: exclude stories authored by private accounts
    // unless the viewer is the author or already follows them.
    let followingIds: ObjectId[] = [];
    if (userId) {
      followingIds = await getFollowingIds(userId);
    }
    const allowedAuthorIds = new Set<string>(
      followingIds.map((id) => id.toString())
    );
    if (userId) allowedAuthorIds.add(userId);
    const privateAuthors = (await UserModel.find({ isPrivate: true })
      .select("_id")
      .lean()) as unknown as { _id: ObjectId }[];
    const deletedAuthors = (await UserModel.find({ isDeleted: true })
      .select("_id")
      .lean()) as unknown as { _id: ObjectId }[];
    const blockedAuthorIds = [
      ...privateAuthors
        .map((u) => u._id)
        .filter((id) => !allowedAuthorIds.has(id.toString())),
      ...deletedAuthors.map((u) => u._id),
    ];

    const storyQuery: Record<string, unknown> = { expiresAt: { $gt: now } };
    if (blockedAuthorIds.length > 0) {
      storyQuery.author = { $nin: blockedAuthorIds };
    }

    const stories = (await StoryModel.find(storyQuery)
      .populate("author", STORY_AUTHOR_SELECT)
      .sort({ createdAt: 1 })
      .lean()) as LeanStory[];

    const groupMap = new Map<string, StoryGroup>();

    for (const raw of stories) {
      const story = serializeStory(raw, userId);
      if (!story) continue;

      const key = story.author._id;
      const existing = groupMap.get(key);
      if (existing) {
        existing.stories.push(story);
        const created = new Date(story.createdAt).getTime();
        if (created > new Date(existing.latestAt).getTime()) {
          existing.latestAt = story.createdAt;
        }
      } else {
        groupMap.set(key, {
          author: story.author,
          stories: [story],
          hasUnseen: false,
          latestAt: story.createdAt,
        });
      }
    }

    for (const group of groupMap.values()) {
      const isOwn = userId === group.author._id;
      group.hasUnseen =
        !isOwn && group.stories.some((s) => !s.hasViewed);
    }

    const groups = Array.from(groupMap.values());
    groups.sort((a, b) => {
      if (userId) {
        if (a.author._id === userId) return -1;
        if (b.author._id === userId) return 1;
      }
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return (
        new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
      );
    });

    return NextResponse.json({ groups }, { status: 200 });
  } catch (err) {
    console.error("GET /api/stories error:", err);
    return NextResponse.json(
      { error: "Failed to fetch stories" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;

    // Video stories may be larger than images; keep a reasonable cap.
    const STORY_VIDEO_MAX_SIZE = 50 * 1024 * 1024; // 50MB
    const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];

    const contentType = req.headers.get("content-type") || "";
    let type: "text" | "image" | "video" = "text";
    let content = "";
    let backgroundColor: string = STORY_BACKGROUND_COLORS[0];
    let media: Awaited<ReturnType<typeof saveFile>>[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      content = String(formData.get("content") ?? "").trim();
      const bg = String(formData.get("backgroundColor") ?? "").trim();
      if (bg) backgroundColor = bg;

      const file = formData.get("media") as File | null;
      if (file && typeof file.arrayBuffer === "function") {
        const isImage = file.type.startsWith("image/");
        const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
        if (!isImage && !isVideo) {
          return NextResponse.json(
            { error: "Only images or mp4/webm videos are allowed for stories." },
            { status: 400 }
          );
        }
        if (isVideo && file.size > STORY_VIDEO_MAX_SIZE) {
          return NextResponse.json(
            { error: "Video is too large. Max size is 50MB." },
            { status: 400 }
          );
        }
        const saved = await saveFile(
          file,
          isVideo ? { maxSize: STORY_VIDEO_MAX_SIZE } : undefined
        );
        if (!saved) {
          return NextResponse.json(
            { error: `Failed to upload ${isVideo ? "video" : "image"}.` },
            { status: 400 }
          );
        }
        media = [saved];
        type = isVideo ? "video" : "image";
      } else {
        type = "text";
      }
    } else {
      const body = await req.json();
      content = String(body?.content ?? "").trim();
      type =
        body?.type === "image"
          ? "image"
          : body?.type === "video"
            ? "video"
            : "text";
      if (body?.backgroundColor) backgroundColor = body.backgroundColor;
    }

    if (type === "text" && !content) {
      return NextResponse.json(
        { error: "Text stories require content." },
        { status: 400 }
      );
    }

    if ((type === "image" || type === "video") && media.length === 0) {
      return NextResponse.json(
        { error: "Media stories require a file." },
        { status: 400 }
      );
    }

    if (
      !STORY_BACKGROUND_COLORS.includes(
        backgroundColor as (typeof STORY_BACKGROUND_COLORS)[number]
      )
    ) {
      backgroundColor = STORY_BACKGROUND_COLORS[0];
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const created = await StoryModel.create({
      author: userId,
      type,
      content,
      media,
      backgroundColor,
      expiresAt,
    });

    const populated = (await StoryModel.findById(created._id)
      .populate("author", STORY_AUTHOR_SELECT)
      .lean()) as LeanStory | null;

    if (!populated) {
      return NextResponse.json(
        { error: "Failed to create story." },
        { status: 500 }
      );
    }

    const story = serializeStory(populated, userId);
    return NextResponse.json({ story }, { status: 201 });
  } catch (err) {
    console.error("POST /api/stories error:", err);
    return NextResponse.json(
      { error: "Failed to create story" },
      { status: 500 }
    );
  }
}
