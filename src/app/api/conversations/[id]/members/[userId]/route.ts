import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import {
  serializeConversation,
  type LeanConversation,
} from "@/lib/chat/serializeConversation";
import { ConversationModel } from "@/models/Conversation";
import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";

const CONVERSATION_POPULATE = [
  { path: "participants", select: "username fullname avatar" },
  {
    path: "lastMessage",
    populate: { path: "sender", select: "username fullname avatar" },
  },
];

/**
 * Remove a member or leave a group.
 * - Anyone can remove themselves (leave).
 * - Admins can remove others.
 * - Cannot remove the last admin (must promote another first — not in MVP).
 * - If leaving would drop below 3 members, still allow leave (group shrinks).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId: me } = auth;
    const { id, userId: targetUserId } = await params;

    if (!isValidObjectId(id) || !isValidObjectId(targetUserId)) {
      return NextResponse.json(
        { error: "Invalid id." },
        { status: 400 }
      );
    }

    const conv = await ConversationModel.findOne({
      _id: id,
      participants: me,
      type: "group",
    });

    if (!conv) {
      return NextResponse.json(
        { error: "Group conversation not found." },
        { status: 404 }
      );
    }

    const participants = (conv.participants ?? []).map((p) => p.toString());
    if (!participants.includes(targetUserId)) {
      return NextResponse.json(
        { error: "User is not a member of this group." },
        { status: 404 }
      );
    }

    const admins = (conv.admins ?? []).map((a) => a.toString());
    const isSelf = targetUserId === me;
    const amAdmin = admins.includes(me);

    if (!isSelf && !amAdmin) {
      return NextResponse.json(
        { error: "Only admins can remove other members." },
        { status: 403 }
      );
    }

    const targetIsAdmin = admins.includes(targetUserId);
    if (targetIsAdmin && admins.length === 1) {
      // Last admin leaving: promote another member if possible
      if (isSelf) {
        const nextAdmin = participants.find((p) => p !== me);
        if (nextAdmin) {
          await ConversationModel.updateOne(
            { _id: id },
            {
              $pull: {
                participants: targetUserId,
                admins: targetUserId,
                readState: { user: targetUserId },
                typing: { user: targetUserId },
              },
              $addToSet: { admins: nextAdmin },
              $set: { createdBy: nextAdmin },
            }
          );
        } else {
          // Alone — dissolve by deleting the conversation
          await ConversationModel.deleteOne({ _id: id });
          return NextResponse.json({ ok: true, dissolved: true }, { status: 200 });
        }
      } else {
        return NextResponse.json(
          { error: "Cannot remove the last admin." },
          { status: 400 }
        );
      }
    } else {
      await ConversationModel.updateOne(
        { _id: id },
        {
          $pull: {
            participants: targetUserId,
            admins: targetUserId,
            readState: { user: targetUserId },
            typing: { user: targetUserId },
          },
        }
      );
    }

    // If the requester left, don't try to serialize for them as a participant
    if (isSelf) {
      return NextResponse.json({ ok: true, left: true }, { status: 200 });
    }

    const populated = (await ConversationModel.findById(id)
      .populate(CONVERSATION_POPULATE)
      .lean()) as unknown as LeanConversation | null;

    if (!populated) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const conversation = await serializeConversation(populated, me, {
      includePresence: true,
    });

    return NextResponse.json({ conversation }, { status: 200 });
  } catch (err) {
    console.error(
      "DELETE /api/conversations/[id]/members/[userId] error:",
      err
    );
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
