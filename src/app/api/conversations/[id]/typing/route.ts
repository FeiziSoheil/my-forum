import { requireUserId } from "@/lib/auth/requireUser";
import { TYPING_TTL_MS } from "@/lib/presence/constants";
import { dbConnect } from "@/lib/db/mongodb";
import { ConversationModel } from "@/models/Conversation";
import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

/**
 * Set or clear typing for the current user in a conversation.
 * Body: `{ typing: boolean }`. Entries expire after TYPING_TTL_MS.
 */
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
      return NextResponse.json(
        { error: "Invalid conversation id." },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { typing?: unknown };
    const typing = body.typing === true;

    const conv = await ConversationModel.findOne({
      _id: id,
      participants: userId,
    }).select("_id");

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    const now = new Date();

    // Drop this user's prior typing entry, then any expired ones
    await ConversationModel.updateOne(
      { _id: id },
      { $pull: { typing: { user: userId } } }
    );
    await ConversationModel.updateOne(
      { _id: id },
      { $pull: { typing: { expiresAt: { $lte: now } } } }
    );

    if (typing) {
      await ConversationModel.updateOne(
        { _id: id },
        {
          $push: {
            typing: {
              user: userId,
              expiresAt: new Date(now.getTime() + TYPING_TTL_MS),
            },
          },
        }
      );
    }

    return NextResponse.json({ ok: true, typing }, { status: 200 });
  } catch (err) {
    console.error("POST /api/conversations/[id]/typing error:", err);
    return NextResponse.json(
      { error: "Failed to update typing" },
      { status: 500 }
    );
  }
}
