import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import { MESSAGE_POPULATE } from "@/lib/chat/populateMessage";
import { createNotification } from "@/lib/notifications/createNotification";
import { canViewStoryAuthor } from "@/lib/stories/storyAccess";
import {
  buildParticipantKey,
  ConversationModel,
} from "@/models/Conversation";
import { MessageModel } from "@/models/Message";
import { StoryModel } from "@/models/Story";
import { UserModel } from "@/models/User";

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
      return NextResponse.json({ error: "Invalid story id." }, { status: 400 });
    }

    const body = await req.json();
    const content = String(body?.content ?? "").trim();
    if (!content) {
      return NextResponse.json(
        { error: "Reply content is required." },
        { status: 400 }
      );
    }
    if (content.length > 2000) {
      return NextResponse.json(
        { error: "Reply is too long." },
        { status: 400 }
      );
    }

    const now = new Date();
    const story = (await StoryModel.findOne({
      _id: id,
      expiresAt: { $gt: now },
    })
      .populate("author", "username fullname avatar")
      .lean()) as {
      _id: { toString(): string };
      type: "text" | "image" | "video";
      content?: string;
      media?: { url: string }[];
      backgroundColor?: string;
      author: { _id: { toString(): string }; username: string };
    } | null;

    if (!story) {
      return NextResponse.json(
        { error: "Story not found or expired." },
        { status: 404 }
      );
    }

    const author = story.author;
    const authorId = author._id.toString();

    // Account-level privacy: a private author's story is only visible to the
    // owner and existing followers.
    if (!(await canViewStoryAuthor(authorId, userId))) {
      return NextResponse.json(
        { error: "Story not found or expired." },
        { status: 404 }
      );
    }

    if (authorId === userId) {
      return NextResponse.json(
        { error: "Cannot reply to your own story." },
        { status: 400 }
      );
    }

    const mediaUrl =
      (story.type === "image" || story.type === "video") &&
      story.media?.[0]?.url
        ? story.media[0].url
        : null;

    // Preserve media type so video stories render correctly in DM (not as text).
    const snapshotType: "text" | "image" | "video" =
      story.type === "image"
        ? "image"
        : story.type === "video"
          ? "video"
          : "text";

    const storySnapshot = {
      type: snapshotType,
      content: story.content ?? "",
      mediaUrl,
      backgroundColor: story.backgroundColor ?? null,
      authorUsername: author.username,
    };

    const participantKey = buildParticipantKey(userId, authorId);
    let conversation = await ConversationModel.findOne({ participantKey });

    if (!conversation) {
      const otherUser = await UserModel.findById(authorId).select("_id").lean();
      if (!otherUser) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }

      conversation = await ConversationModel.create({
        participants: [userId, authorId],
        participantKey,
        readState: [
          { user: userId, lastReadAt: new Date() },
          { user: authorId, lastReadAt: new Date() },
        ],
      });
    }

    const message = await MessageModel.create({
      conversation: conversation._id,
      sender: userId,
      content,
      type: "story_reply",
      sharedStory: id,
      storySnapshot,
      media: [],
    });

    await ConversationModel.updateOne(
      { _id: conversation._id },
      {
        lastMessage: message._id,
        lastMessageAt: message.createdAt,
        $set: { "readState.$[elem].lastReadAt": new Date() },
      },
      { arrayFilters: [{ "elem.user": userId }] }
    );

    const populated = await MessageModel.findById(message._id)
      .populate(MESSAGE_POPULATE)
      .lean();

    await createNotification({
      recipient: authorId,
      actor: userId,
      type: "story_reply",
      story: id,
    });

    return NextResponse.json(
      {
        conversationId: conversation._id.toString(),
        message: populated,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/stories/[id]/reply error:", err);
    return NextResponse.json(
      { error: "Failed to reply to story" },
      { status: 500 }
    );
  }
}
