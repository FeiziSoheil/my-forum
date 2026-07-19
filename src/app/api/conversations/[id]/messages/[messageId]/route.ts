import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import { MESSAGE_POPULATE } from "@/lib/chat/populateMessage";
import { ConversationModel } from "@/models/Conversation";
import { MessageModel } from "@/models/Message";
import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

async function getOwnedConversation(conversationId: string, userId: string) {
  if (!isValidObjectId(conversationId)) return null;
  return ConversationModel.findOne({
    _id: conversationId,
    participants: userId,
  });
}

/** Soft-delete own message (visible as "Message deleted" to both sides). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;
    const { id, messageId } = await params;

    const conversation = await getOwnedConversation(id, userId);
    if (!conversation) {
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

    const message = await MessageModel.findOne({
      _id: messageId,
      conversation: id,
    });

    if (!message) {
      return NextResponse.json(
        { error: "Message not found." },
        { status: 404 }
      );
    }

    if (message.sender.toString() !== userId) {
      return NextResponse.json(
        { error: "You can only delete your own messages." },
        { status: 403 }
      );
    }

    if (message.isDeleted) {
      const populated = await MessageModel.findById(messageId)
        .populate(MESSAGE_POPULATE)
        .lean();
      return NextResponse.json({ message: populated }, { status: 200 });
    }

    const deletedAt = new Date();
    await MessageModel.updateOne(
      { _id: messageId },
      {
        $set: {
          isDeleted: true,
          deletedAt,
          content: "",
          media: [],
          type: "text",
          sharedPost: null,
          sharedStory: null,
          replyTo: null,
          reactions: [],
          reactionsUpdatedAt: null,
        },
        $unset: { storySnapshot: 1 },
      }
    );

    // If this was the conversation's last message, point at latest non-deleted
    if (conversation.lastMessage?.toString() === messageId) {
      const previous = await MessageModel.findOne({
        conversation: id,
        isDeleted: { $ne: true },
      })
        .sort({ _id: -1 })
        .select("_id createdAt")
        .lean();

      await ConversationModel.updateOne(
        { _id: id },
        {
          lastMessage: previous?._id ?? null,
          lastMessageAt: previous?.createdAt ?? conversation.lastMessageAt,
        }
      );
    }

    const populated = await MessageModel.findById(messageId)
      .populate(MESSAGE_POPULATE)
      .lean();

    return NextResponse.json({ message: populated }, { status: 200 });
  } catch (err) {
    console.error("DELETE message error:", err);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
