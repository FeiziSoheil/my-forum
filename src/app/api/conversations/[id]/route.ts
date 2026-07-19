import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import {
  serializeConversation,
  type LeanConversation,
} from "@/lib/chat/serializeConversation";
import { ConversationModel } from "@/models/Conversation";
import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

const CONVERSATION_POPULATE = [
  { path: "participants", select: "username fullname avatar" },
  {
    path: "lastMessage",
    populate: { path: "sender", select: "username fullname avatar" },
  },
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { error: "Invalid conversation id." },
        { status: 400 }
      );
    }

    const conv = (await ConversationModel.findOne({
      _id: id,
      participants: userId,
    })
      .populate(CONVERSATION_POPULATE)
      .lean()) as unknown as LeanConversation | null;

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    const conversation = await serializeConversation(conv, userId, {
      includePresence: true,
      includePendingTheme: true,
    });

    return NextResponse.json({ conversation }, { status: 200 });
  } catch (err) {
    console.error("GET /api/conversations/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}

/** Update group title (admin only). */
export async function PATCH(
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
      return NextResponse.json(
        { error: "Invalid conversation id." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const title =
      typeof body?.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json(
        { error: "Title is required." },
        { status: 400 }
      );
    }

    const conv = await ConversationModel.findOne({
      _id: id,
      participants: userId,
      type: "group",
    });

    if (!conv) {
      return NextResponse.json(
        { error: "Group conversation not found." },
        { status: 404 }
      );
    }

    const admins = (conv.admins ?? []).map((a) => a.toString());
    if (!admins.includes(userId)) {
      return NextResponse.json(
        { error: "Only admins can update the group title." },
        { status: 403 }
      );
    }

    conv.title = title;
    await conv.save();

    const populated = (await ConversationModel.findById(id)
      .populate(CONVERSATION_POPULATE)
      .lean()) as unknown as LeanConversation;

    const conversation = await serializeConversation(populated, userId, {
      includePresence: true,
    });

    return NextResponse.json({ conversation }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/conversations/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}
