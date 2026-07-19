import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import { MESSAGE_POPULATE } from "@/lib/chat/populateMessage";
import { ConversationModel } from "@/models/Conversation";
import { MessageModel } from "@/models/Message";
import { REACTION_EMOJIS } from "@/types/chat";
import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

async function getOwnedConversation(conversationId: string, userId: string) {
  if (!isValidObjectId(conversationId)) return null;
  return ConversationModel.findOne({
    _id: conversationId,
    participants: userId,
  });
}

function isAllowedEmoji(emoji: string) {
  return (REACTION_EMOJIS as readonly string[]).includes(emoji);
}

async function loadPopulatedMessage(messageId: string) {
  return MessageModel.findById(messageId)
    .populate(MESSAGE_POPULATE)
    .lean();
}

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

    const body = await req.json();
    const emoji = (body?.emoji as string) || "";

    if (!emoji || !isAllowedEmoji(emoji)) {
      return NextResponse.json(
        { error: "Invalid emoji. Allowed: " + REACTION_EMOJIS.join(" ") },
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

    if (message.isDeleted) {
      return NextResponse.json(
        { error: "Cannot react to a deleted message." },
        { status: 400 }
      );
    }

    const existingIdx = (message.reactions ?? []).findIndex(
      (r: { emoji: string; user: { toString(): string }; createdAt: Date }) =>
        r.user.toString() === userId
    );

    if (existingIdx >= 0) {
      const existing = message.reactions[existingIdx];
      if (existing.emoji === emoji) {
        message.reactions.splice(existingIdx, 1);
      } else {
        existing.emoji = emoji;
        existing.createdAt = new Date();
      }
    } else {
      message.reactions.push({
        emoji,
        user: userId,
        createdAt: new Date(),
      });
    }

    message.reactionsUpdatedAt = new Date();
    message.markModified("reactions");
    await message.save();

    const populated = await loadPopulatedMessage(messageId);
    return NextResponse.json({ message: populated }, { status: 200 });
  } catch (err) {
    console.error("POST react error:", err);
    return NextResponse.json(
      { error: "Failed to react to message" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
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

    let emoji: string | undefined;
    try {
      const body = await req.json();
      emoji = body?.emoji as string | undefined;
    } catch {
      emoji = undefined;
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

    if (message.isDeleted) {
      return NextResponse.json(
        { error: "Cannot react to a deleted message." },
        { status: 400 }
      );
    }

    const before = (message.reactions ?? []).length;
    for (let i = message.reactions.length - 1; i >= 0; i--) {
      const r = message.reactions[i];
      const uid = r.user.toString();
      if (uid !== userId) continue;
      if (emoji && r.emoji !== emoji) continue;
      message.reactions.splice(i, 1);
    }

    if (message.reactions.length === before) {
      return NextResponse.json(
        { error: "No reaction to remove." },
        { status: 404 }
      );
    }

    message.reactionsUpdatedAt = new Date();
    message.markModified("reactions");
    await message.save();

    const populated = await loadPopulatedMessage(messageId);
    return NextResponse.json({ message: populated }, { status: 200 });
  } catch (err) {
    console.error("DELETE react error:", err);
    return NextResponse.json(
      { error: "Failed to remove reaction" },
      { status: 500 }
    );
  }
}
