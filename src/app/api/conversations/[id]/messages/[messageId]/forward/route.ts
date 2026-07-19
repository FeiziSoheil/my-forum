import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import { MESSAGE_POPULATE } from "@/lib/chat/populateMessage";
import { ConversationModel } from "@/models/Conversation";
import { MessageModel } from "@/models/Message";
import { PostModel } from "@/models/Post";
import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

async function getOwnedConversation(conversationId: string, userId: string) {
  if (!isValidObjectId(conversationId)) return null;
  return ConversationModel.findOne({
    _id: conversationId,
    participants: userId,
  });
}

/**
 * Forward a message into another conversation the user participates in.
 * Copies text, media URLs, shared post, or story snapshot as a new message.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;
    const { id, messageId } = await params;

    const sourceConversation = await getOwnedConversation(id, userId);
    if (!sourceConversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    if (!isValidObjectId(messageId)) {
      return NextResponse.json(
        { error: "Invalid message id." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const targetConversationId = (body?.conversationId as string) || "";

    if (!isValidObjectId(targetConversationId)) {
      return NextResponse.json(
        { error: "Invalid target conversation id." },
        { status: 400 }
      );
    }

    const targetConversation = await getOwnedConversation(
      targetConversationId,
      userId
    );
    if (!targetConversation) {
      return NextResponse.json(
        { error: "Target conversation not found." },
        { status: 404 }
      );
    }

    const source = await MessageModel.findOne({
      _id: messageId,
      conversation: id,
    }).lean();

    if (!source) {
      return NextResponse.json(
        { error: "Message not found." },
        { status: 404 }
      );
    }

    if (source.isDeleted) {
      return NextResponse.json(
        { error: "Cannot forward a deleted message." },
        { status: 400 }
      );
    }

    const content = ((source.content as string) || "").trim();
    const media = Array.isArray(source.media) ? source.media : [];
    const sharedPostId = source.sharedPost
      ? source.sharedPost.toString()
      : null;
    const storySnapshot = source.storySnapshot ?? undefined;
    const type =
      source.type === "shared_post" ||
      source.type === "story_reply" ||
      source.type === "image" ||
      source.type === "text"
        ? source.type
        : media.length > 0
          ? "image"
          : "text";

    if (sharedPostId) {
      const post = await PostModel.findOne({
        _id: sharedPostId,
        isDeleted: { $ne: true },
      })
        .select("_id")
        .lean();
      if (!post) {
        return NextResponse.json(
          { error: "Shared post is no longer available." },
          { status: 404 }
        );
      }
    }

    if (
      !content &&
      media.length === 0 &&
      !sharedPostId &&
      !(type === "story_reply" && storySnapshot)
    ) {
      return NextResponse.json(
        { error: "Nothing to forward." },
        { status: 400 }
      );
    }

    const message = await MessageModel.create({
      conversation: targetConversationId,
      sender: userId,
      content,
      media,
      type:
        sharedPostId
          ? "shared_post"
          : type === "story_reply"
            ? "story_reply"
            : media.length > 0
              ? "image"
              : "text",
      sharedPost: sharedPostId,
      storySnapshot: type === "story_reply" ? storySnapshot : undefined,
    });

    await ConversationModel.updateOne(
      { _id: targetConversationId },
      {
        lastMessage: message._id,
        lastMessageAt: message.createdAt,
        $set: {
          "readState.$[elem].lastReadAt": new Date(),
        },
      },
      { arrayFilters: [{ "elem.user": userId }] }
    );

    const populated = await MessageModel.findById(message._id)
      .populate(MESSAGE_POPULATE)
      .lean();

    return NextResponse.json(
      {
        message: populated,
        conversationId: targetConversationId,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST forward message error:", err);
    return NextResponse.json(
      { error: "Failed to forward message" },
      { status: 500 }
    );
  }
}
