import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import { ConversationModel } from "@/models/Conversation";
import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";

export async function POST(
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

    const conversation = await ConversationModel.findOne({
      _id: id,
      participants: userId,
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    const now = new Date();
    const existing = conversation.readState?.find(
      (r: { user: { toString(): string } }) => r.user?.toString() === userId
    );

    if (existing) {
      existing.lastReadAt = now;
    } else {
      conversation.readState.push({ user: userId, lastReadAt: now });
    }

    await conversation.save();

    return NextResponse.json({ ok: true, lastReadAt: now }, { status: 200 });
  } catch (err) {
    console.error("POST /api/conversations/[id]/read error:", err);
    return NextResponse.json(
      { error: "Failed to mark as read" },
      { status: 500 }
    );
  }
}
