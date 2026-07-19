import { verifyAccessToken } from "@/lib/auth/jwt";
import { dbConnect } from "@/lib/db/mongodb";
import { NotificationModel } from "@/models/Notification";
import { ObjectId } from "mongodb";
import { isValidObjectId } from "mongoose";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight SSE stream for notification unread count updates.
 * Polls for new notifications for the authenticated user and pushes
 * `unread` events with `{ unreadCount }`.
 */
export async function GET(req: NextRequest) {
  await dbConnect();

  const atk = req.cookies.get("atk")?.value;
  if (!atk) {
    return new Response(JSON.stringify({ error: "Authentication token missing." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let userId: string;
  try {
    const payload = await verifyAccessToken(atk);
    userId = payload.uid as string;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid token." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let lastId: ObjectId | null = null;

  const sinceParam = req.nextUrl.searchParams.get("since");
  if (sinceParam && isValidObjectId(sinceParam)) {
    lastId = new ObjectId(sinceParam);
  } else {
    const latest = (await NotificationModel.findOne({ recipient: userId })
      .sort({ _id: -1 })
      .select("_id")
      .lean()) as { _id: ObjectId } | null;
    if (latest) lastId = latest._id;
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const pushUnread = async () => {
        const unreadCount = await NotificationModel.countDocuments({
          recipient: userId,
          read: false,
        });
        send("unread", { unreadCount });
      };

      send("ready", { ok: true });
      pushUnread().catch((err) =>
        console.error("notifications SSE initial unread error:", err)
      );

      const poll = async () => {
        if (closed) return;
        try {
          const query: Record<string, unknown> = { recipient: userId };
          if (lastId) query._id = { $gt: lastId };

          const newItems = await NotificationModel.find(query)
            .sort({ _id: 1 })
            .limit(50)
            .select("_id")
            .lean();

          if (newItems.length === 0) return;

          for (const item of newItems) {
            lastId = item._id as ObjectId;
          }

          await pushUnread();
        } catch (err) {
          console.error("notifications SSE poll error:", err);
        }
      };

      const interval = setInterval(poll, 3000);
      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 15000);

      poll();

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
