import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import { saveFile } from "@/lib/fileHandler";
import { MESSAGE_POPULATE } from "@/lib/chat/populateMessage";
import { createNotification } from "@/lib/notifications/createNotification";
import { ConversationModel } from "@/models/Conversation";
import { MessageModel } from "@/models/Message";
import { PostModel } from "@/models/Post";
import { MediaItem } from "@/types/post";
import { ObjectId } from "mongodb";
import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

async function getOwnedConversation(conversationId: string, userId: string) {
  if (!isValidObjectId(conversationId)) return null;
  return ConversationModel.findOne({
    _id: conversationId,
    participants: userId,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;
    const { id } = await params;

    const conversation = await getOwnedConversation(id, userId);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    const MAX_LIMIT = 50;
    const limit = Math.min(
      parseInt(req.nextUrl.searchParams.get("limit") || "30"),
      MAX_LIMIT
    );
    const cursor = req.nextUrl.searchParams.get("cursor");

    const query: Record<string, unknown> = { conversation: id };
    if (cursor && isValidObjectId(cursor)) {
      query._id = { $lt: new ObjectId(cursor) };
    }

    const messages = (await MessageModel.find(query)
      .populate(MESSAGE_POPULATE)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()) as Array<{ _id: { toString(): string } } & Record<string, unknown>>;

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    const nextCursor =
      hasMore && messages.length > 0
        ? messages[messages.length - 1]._id.toString()
        : undefined;

    messages.reverse();

    return NextResponse.json(
      {
        messages,
        hasMore,
        nextCursor,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/conversations/[id]/messages error:", err);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

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

    const conversation = await getOwnedConversation(id, userId);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let content = "";
    let replyToId: string | null = null;
    let sharedPostId: string | null = null;
    const mediaFiles: File[] = [];

    if (contentType.includes("application/json")) {
      const body = await req.json();
      content = ((body?.content as string) || "").trim();
      replyToId = (body?.replyTo as string) || null;
      sharedPostId = (body?.sharedPostId as string) || null;
    } else {
      const formData = await req.formData();
      content = ((formData.get("content") as string) || "").trim();
      replyToId = (formData.get("replyTo") as string) || null;
      sharedPostId = (formData.get("sharedPostId") as string) || null;
      for (const file of formData.getAll("media") as File[]) {
        mediaFiles.push(file);
      }
    }

    const media: MediaItem[] = [];
    const CHAT_VIDEO_MAX_SIZE = 50 * 1024 * 1024; // 50MB — match story uploads
    const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];

    for (const file of mediaFiles) {
      if (file && file.size > 0) {
        const isImage = file.type.startsWith("image/");
        const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
        if (!isImage && !isVideo) {
          return NextResponse.json(
            { error: "Only image or mp4/webm video attachments are allowed." },
            { status: 400 }
          );
        }
        if (isVideo && file.size > CHAT_VIDEO_MAX_SIZE) {
          return NextResponse.json(
            { error: "Video is too large. Max size is 50MB." },
            { status: 400 }
          );
        }
        const mediaResult = await saveFile(
          file,
          isVideo ? { maxSize: CHAT_VIDEO_MAX_SIZE } : undefined
        );
        if (mediaResult) media.push(mediaResult);
      }
    }

    if (sharedPostId) {
      if (!isValidObjectId(sharedPostId)) {
        return NextResponse.json(
          { error: "Invalid shared post id." },
          { status: 400 }
        );
      }
      const post = await PostModel.findOne({
        _id: sharedPostId,
        isDeleted: { $ne: true },
      }).lean();
      if (!post) {
        return NextResponse.json(
          { error: "Post not found." },
          { status: 404 }
        );
      }
    }

    if (!content && media.length === 0 && !sharedPostId) {
      return NextResponse.json(
        { error: "Message content, media, or shared post is required." },
        { status: 400 }
      );
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: "Content cannot be more than 2000 characters." },
        { status: 400 }
      );
    }

    let replyTo: string | null = null;
    if (replyToId) {
      if (!isValidObjectId(replyToId)) {
        return NextResponse.json(
          { error: "Invalid replyTo id." },
          { status: 400 }
        );
      }
      const replyMsg = await MessageModel.findOne({
        _id: replyToId,
        conversation: id,
        isDeleted: { $ne: true },
      }).lean();
      if (!replyMsg) {
        return NextResponse.json(
          { error: "Reply target message not found in this conversation." },
          { status: 404 }
        );
      }
      replyTo = replyToId;
    }

    const type = sharedPostId
      ? "shared_post"
      : media.length > 0
        ? "image"
        : "text";

    const message = await MessageModel.create({
      conversation: id,
      sender: userId,
      content,
      media,
      type,
      replyTo,
      sharedPost: sharedPostId,
    });

    await ConversationModel.updateOne(
      { _id: id },
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

    // Notify the other participant(s) of the new message. Never notify the
    // sender. `createNotification` dedupes repeated unread DMs from the same
    // actor in this conversation until the recipient reads them.
    const recipientIds = (conversation.participants as { toString(): string }[])
      .map((p) => p.toString())
      .filter((pid) => pid !== userId);

    await Promise.all(
      recipientIds.map((recipientId) =>
        createNotification({
          recipient: recipientId,
          actor: userId,
          type: "message",
          conversation: id,
        })
      )
    );

    return NextResponse.json({ message: populated }, { status: 201 });
  } catch (err) {
    console.error("POST /api/conversations/[id]/messages error:", err);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
