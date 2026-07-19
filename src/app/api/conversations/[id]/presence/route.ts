import { requireUserId } from "@/lib/auth/requireUser";
import { dbConnect } from "@/lib/db/mongodb";
import { PRESENCE_ONLINE_MS } from "@/lib/presence/constants";
import { presenceFromLastSeen } from "@/lib/presence/status";
import { ConversationModel } from "@/models/Conversation";
import { UserModel } from "@/models/User";
import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";

/** Read presence for a conversation (peer for direct; online count for groups). */
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
      .select("participants type")
      .lean()) as {
      participants?: Array<{ toString(): string }>;
      type?: string;
    } | null;

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    const participantIds = (conv.participants ?? []).map((p) => p.toString());
    const otherIds = participantIds.filter((p) => p !== userId);

    if (conv.type === "group") {
      const cutoff = new Date(Date.now() - PRESENCE_ONLINE_MS);
      const onlineCount =
        otherIds.length === 0
          ? 0
          : await UserModel.countDocuments({
              _id: { $in: otherIds },
              lastSeenAt: { $gte: cutoff },
            });

      return NextResponse.json(
        {
          presence: {
            onlineCount,
            memberCount: participantIds.length,
          },
        },
        { status: 200 }
      );
    }

    const peerId = otherIds[0];
    if (!peerId) {
      return NextResponse.json(
        { presence: { online: false, lastSeenAt: null } },
        { status: 200 }
      );
    }

    const peer = (await UserModel.findById(peerId)
      .select("lastSeenAt")
      .lean()) as { lastSeenAt?: Date | null } | null;

    return NextResponse.json(
      {
        presence: presenceFromLastSeen(peer?.lastSeenAt ?? null),
        userId: peerId,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/conversations/[id]/presence error:", err);
    return NextResponse.json(
      { error: "Failed to fetch presence" },
      { status: 500 }
    );
  }
}
