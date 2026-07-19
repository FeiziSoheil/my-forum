import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import {
  serializeConversation,
  type LeanConversation,
} from "@/lib/chat/serializeConversation";
import { ConversationModel } from "@/models/Conversation";
import { UserModel } from "@/models/User";
import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

const CONVERSATION_POPULATE = [
  { path: "participants", select: "username fullname avatar" },
  {
    path: "lastMessage",
    populate: { path: "sender", select: "username fullname avatar" },
  },
];

const MAX_GROUP_MEMBERS = 50;

/** Add members to a group (admin only). Body: `{ userIds: string[] }` */
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

    const body = await req.json().catch(() => ({})) as {
      userIds?: unknown;
    };
    const rawIds = Array.isArray(body.userIds) ? body.userIds : [];
    const userIds = [
      ...new Set(
        rawIds.filter(
          (uid: unknown): uid is string =>
            typeof uid === "string" && isValidObjectId(uid)
        )
      ),
    ];

    if (userIds.length === 0) {
      return NextResponse.json(
        { error: "At least one valid userId is required." },
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
        { error: "Only admins can add members." },
        { status: 403 }
      );
    }

    const existing = new Set(
      (conv.participants ?? []).map((p) => p.toString())
    );
    const toAdd = userIds.filter((uid) => !existing.has(uid));

    if (toAdd.length === 0) {
      return NextResponse.json(
        { error: "All users are already members." },
        { status: 400 }
      );
    }

    if (existing.size + toAdd.length > MAX_GROUP_MEMBERS) {
      return NextResponse.json(
        { error: `Groups cannot have more than ${MAX_GROUP_MEMBERS} members.` },
        { status: 400 }
      );
    }

    const found = await UserModel.find({ _id: { $in: toAdd } })
      .select("_id")
      .lean();
    if (found.length !== toAdd.length) {
      return NextResponse.json(
        { error: "One or more users were not found." },
        { status: 404 }
      );
    }

    const now = new Date();
    await ConversationModel.updateOne(
      { _id: id },
      {
        $addToSet: { participants: { $each: toAdd } },
        $push: {
          readState: {
            $each: toAdd.map((uid) => ({
              user: uid,
              lastReadAt: now,
            })),
          },
        },
      }
    );

    const populated = (await ConversationModel.findById(id)
      .populate(CONVERSATION_POPULATE)
      .lean()) as unknown as LeanConversation;

    const conversation = await serializeConversation(populated, userId, {
      includePresence: true,
    });

    return NextResponse.json({ conversation }, { status: 200 });
  } catch (err) {
    console.error("POST /api/conversations/[id]/members error:", err);
    return NextResponse.json(
      { error: "Failed to add members" },
      { status: 500 }
    );
  }
}
