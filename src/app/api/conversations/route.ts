import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import {
  serializeConversation,
  type LeanConversation,
} from "@/lib/chat/serializeConversation";
import {
  buildGroupParticipantKey,
  buildParticipantKey,
  ConversationModel,
} from "@/models/Conversation";
import { UserModel } from "@/models/User";
import { isValidObjectId, Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

const CONVERSATION_POPULATE = [
  { path: "participants", select: "username fullname avatar" },
  {
    path: "lastMessage",
    populate: { path: "sender", select: "username fullname avatar" },
  },
];

export async function GET() {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;

    const conversations = (await ConversationModel.find({
      participants: userId,
    })
      .populate(CONVERSATION_POPULATE)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean()) as unknown as LeanConversation[];

    const enriched = await Promise.all(
      conversations.map((conv) => serializeConversation(conv, userId))
    );

    return NextResponse.json({ conversations: enriched }, { status: 200 });
  } catch (err) {
    console.error("GET /api/conversations error:", err);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;

    const body = await req.json();
    const type = body?.type === "group" ? "group" : "direct";

    if (type === "group") {
      return createGroup(userId, body);
    }
    return createDirect(userId, body);
  } catch (err) {
    console.error("POST /api/conversations error:", err);
    return NextResponse.json(
      { error: "Failed to start conversation" },
      { status: 500 }
    );
  }
}

async function createDirect(
  userId: string,
  body: { userId?: string }
) {
  const otherUserId = body?.userId as string | undefined;

  if (!otherUserId || !isValidObjectId(otherUserId)) {
    return NextResponse.json(
      { error: "Valid userId is required." },
      { status: 400 }
    );
  }

  if (otherUserId === userId) {
    return NextResponse.json(
      { error: "Cannot start a conversation with yourself." },
      { status: 400 }
    );
  }

  const otherUser = await UserModel.findById(otherUserId)
    .select("username fullname avatar")
    .lean();
  if (!otherUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const participantKey = buildParticipantKey(userId, otherUserId);
  let conversation = await ConversationModel.findOne({ participantKey }).populate(
    CONVERSATION_POPULATE
  );

  if (!conversation) {
    conversation = await ConversationModel.create({
      type: "direct",
      participants: [userId, otherUserId],
      participantKey,
      createdBy: userId,
      admins: [],
      title: null,
      readState: [
        { user: userId, lastReadAt: new Date() },
        { user: otherUserId, lastReadAt: new Date() },
      ],
    });
    conversation = await ConversationModel.findById(conversation._id).populate(
      CONVERSATION_POPULATE
    );
  }

  const serialized = await serializeConversation(
    conversation!.toObject() as unknown as LeanConversation,
    userId
  );

  return NextResponse.json({ conversation: serialized }, { status: 200 });
}

async function createGroup(
  userId: string,
  body: { title?: string; participantIds?: string[] }
) {
  const title =
    typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json(
      { error: "Group title is required." },
      { status: 400 }
    );
  }

  const rawIds = Array.isArray(body?.participantIds)
    ? body.participantIds
    : [];
  const otherIds = [
    ...new Set(
      rawIds.filter(
        (id): id is string =>
          typeof id === "string" &&
          isValidObjectId(id) &&
          id !== userId
      )
    ),
  ];

  // Group = creator + at least 2 others → min 3 total
  if (otherIds.length < 2) {
    return NextResponse.json(
      { error: "Groups need at least 2 other members (3 total)." },
      { status: 400 }
    );
  }

  if (otherIds.length > 49) {
    return NextResponse.json(
      { error: "Groups cannot have more than 50 members." },
      { status: 400 }
    );
  }

  const foundUsers = await UserModel.find({ _id: { $in: otherIds } })
    .select("_id")
    .lean();
  if (foundUsers.length !== otherIds.length) {
    return NextResponse.json(
      { error: "One or more users were not found." },
      { status: 404 }
    );
  }

  const participants = [userId, ...otherIds];
  const groupId = new Types.ObjectId();
  const now = new Date();

  const conversation = await ConversationModel.create({
    _id: groupId,
    type: "group",
    title,
    participants,
    participantKey: buildGroupParticipantKey(groupId.toString()),
    createdBy: userId,
    admins: [userId],
    readState: participants.map((id) => ({
      user: id,
      lastReadAt: now,
    })),
  });

  const populated = await ConversationModel.findById(conversation._id).populate(
    CONVERSATION_POPULATE
  );

  const serialized = await serializeConversation(
    populated!.toObject() as unknown as LeanConversation,
    userId
  );

  return NextResponse.json({ conversation: serialized }, { status: 201 });
}
