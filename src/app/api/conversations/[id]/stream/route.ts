import { verifyAccessToken } from "@/lib/auth/jwt";
import { MESSAGE_POPULATE } from "@/lib/chat/populateMessage";
import { serializePendingThemeProposal } from "@/lib/chat/serializeConversation";
import { dbConnect } from "@/lib/db/mongodb";
import { PRESENCE_ONLINE_MS } from "@/lib/presence/constants";
import { presenceFromLastSeen } from "@/lib/presence/status";
import { ConversationModel } from "@/models/Conversation";
import { MessageModel } from "@/models/Message";
import { ThemeProposalModel } from "@/models/ThemeProposal";
import { UserModel } from "@/models/User";
import { ObjectId } from "mongodb";
import { isValidObjectId } from "mongoose";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params;

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

  if (!isValidObjectId(id)) {
    return new Response(JSON.stringify({ error: "Invalid conversation id." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const conversation = (await ConversationModel.findOne({
    _id: id,
    participants: userId,
  })
    .select("participants type")
    .lean()) as {
    participants?: Array<{ toString(): string }>;
    type?: string;
  } | null;

  if (!conversation) {
    return new Response(JSON.stringify({ error: "Conversation not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isGroup = conversation.type === "group";
  const participantIds = (conversation.participants ?? []).map((p) =>
    p.toString()
  );
  const peerId = participantIds.find((p) => p !== userId);
  const otherIds = participantIds.filter((p) => p !== userId);

  const encoder = new TextEncoder();
  let closed = false;
  let lastId: ObjectId | null = null;
  let lastReactionAt: Date | null = null;
  let lastDeletedAt: Date | null = null;
  let lastPresenceKey: string | null = null;
  let lastTypingKey: string | null = null;
  let lastThemeKey: string | null = null;
  let lastProposalKey: string | null = null;

  const sinceParam = req.nextUrl.searchParams.get("since");
  if (sinceParam && isValidObjectId(sinceParam)) {
    lastId = new ObjectId(sinceParam);
  } else {
    const latest = (await MessageModel.findOne({ conversation: id })
      .sort({ _id: -1 })
      .select("_id")
      .lean()) as { _id: ObjectId } | null;
    if (latest) lastId = latest._id;
  }

  lastReactionAt = new Date();
  lastDeletedAt = new Date();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      send("ready", { ok: true });

      const pollPresenceAndTyping = async () => {
        if (closed) return;

        if (isGroup) {
          const cutoff = new Date(Date.now() - PRESENCE_ONLINE_MS);
          const onlineCount =
            otherIds.length === 0
              ? 0
              : await UserModel.countDocuments({
                  _id: { $in: otherIds },
                  lastSeenAt: { $gte: cutoff },
                });
          const presenceKey = `g:${onlineCount}:${otherIds.length + 1}`;
          if (presenceKey !== lastPresenceKey) {
            lastPresenceKey = presenceKey;
            send("presence", {
              onlineCount,
              memberCount: otherIds.length + 1,
            });
          }
        } else if (peerId) {
          const peer = (await UserModel.findById(peerId)
            .select("lastSeenAt")
            .lean()) as { lastSeenAt?: Date | null } | null;
          const presence = presenceFromLastSeen(peer?.lastSeenAt ?? null);
          const presenceKey = `${presence.online}:${presence.lastSeenAt ?? ""}`;
          if (presenceKey !== lastPresenceKey) {
            lastPresenceKey = presenceKey;
            send("presence", { userId: peerId, ...presence });
          }
        }

        const now = new Date();
        const convTyping = (await ConversationModel.findById(id)
          .select("typing")
          .lean()) as {
          typing?: Array<{ user: { toString(): string }; expiresAt: Date }>;
        } | null;

        const activeTypingIds = (convTyping?.typing ?? [])
          .filter((t) => t.expiresAt > now && t.user?.toString() !== userId)
          .map((t) => t.user.toString());

        const typingKey = activeTypingIds.slice().sort().join(",") || "0";
        if (typingKey !== lastTypingKey) {
          lastTypingKey = typingKey;

          if (activeTypingIds.length === 0) {
            send("typing", {
              userId: peerId,
              typing: false,
              users: [],
            });
          } else {
            const typers = (await UserModel.find({
              _id: { $in: activeTypingIds },
            })
              .select("username fullname")
              .lean()) as unknown as Array<{
              _id: { toString(): string };
              username: string;
              fullname: string;
            }>;

            const users = typers.map((u) => ({
              userId: u._id.toString(),
              username: u.username,
              fullname: u.fullname,
            }));

            send("typing", {
              userId: isGroup ? undefined : peerId,
              typing: true,
              users,
            });
          }
        }

        // Opportunistic cleanup of expired typing entries
        if ((convTyping?.typing ?? []).some((t) => t.expiresAt <= now)) {
          await ConversationModel.updateOne(
            { _id: id },
            { $pull: { typing: { expiresAt: { $lte: now } } } }
          );
        }
      };

      const poll = async () => {
        if (closed) return;
        try {
          const query: Record<string, unknown> = { conversation: id };
          if (lastId) query._id = { $gt: lastId };

          const newMessages = await MessageModel.find(query)
            .populate(MESSAGE_POPULATE)
            .sort({ _id: 1 })
            .limit(50)
            .lean();

          for (const msg of newMessages) {
            lastId = msg._id as ObjectId;
            send("message", msg);
          }

          // Stream reaction updates on already-known messages
          if (lastReactionAt) {
            const reactionQuery: Record<string, unknown> = {
              conversation: id,
              reactionsUpdatedAt: { $gt: lastReactionAt },
            };
            if (lastId) {
              reactionQuery._id = { $lte: lastId };
            }

            const reactionUpdates = await MessageModel.find(reactionQuery)
              .populate(MESSAGE_POPULATE)
              .sort({ reactionsUpdatedAt: 1 })
              .limit(50)
              .lean();

            for (const msg of reactionUpdates) {
              const ts = (msg as { reactionsUpdatedAt?: Date }).reactionsUpdatedAt;
              if (ts && (!lastReactionAt || ts > lastReactionAt)) {
                lastReactionAt = ts;
              }
              send("reaction", msg);
            }
          }

          // Stream soft-deletes on already-known messages
          if (lastDeletedAt) {
            const deletedQuery: Record<string, unknown> = {
              conversation: id,
              isDeleted: true,
              deletedAt: { $gt: lastDeletedAt },
            };
            if (lastId) {
              deletedQuery._id = { $lte: lastId };
            }

            const deletedUpdates = await MessageModel.find(deletedQuery)
              .populate(MESSAGE_POPULATE)
              .sort({ deletedAt: 1 })
              .limit(50)
              .lean();

            for (const msg of deletedUpdates) {
              const ts = (msg as { deletedAt?: Date }).deletedAt;
              if (ts && (!lastDeletedAt || ts > lastDeletedAt)) {
                lastDeletedAt = ts;
              }
              send("deleted", msg);
            }
          }

          await pollPresenceAndTyping();

          // Shared chat theme updates (group admin sync / accepted DM theme)
          const convTheme = (await ConversationModel.findById(id)
            .select("sharedTheme")
            .lean()) as {
            sharedTheme?: {
              themeId?: string | null;
              blur?: number | null;
              dim?: number | null;
              wallpaperUrl?: string | null;
              proposedBy?: { toString(): string } | null;
              acceptedAt?: Date | null;
            } | null;
          } | null;

          const st = convTheme?.sharedTheme;
          const themeKey =
            st?.themeId && st.acceptedAt
              ? `${st.themeId}|${st.blur ?? 0}|${st.dim ?? 0}|${st.wallpaperUrl ?? ""}|${new Date(st.acceptedAt).getTime()}`
              : "0";

          if (themeKey !== lastThemeKey) {
            lastThemeKey = themeKey;
            if (st?.themeId && st.acceptedAt && st.proposedBy) {
              send("theme", {
                themeId: st.themeId,
                blur: typeof st.blur === "number" ? st.blur : 6,
                dim: typeof st.dim === "number" ? st.dim : 40,
                wallpaperUrl: st.wallpaperUrl ?? null,
                proposedBy: st.proposedBy.toString(),
                acceptedAt: new Date(st.acceptedAt).toISOString(),
              });
            } else {
              send("theme", { sharedTheme: null });
            }
          }

          // Pending DM theme proposals (incoming + outgoing for this viewer)
          if (!isGroup) {
            const pending = (await ThemeProposalModel.findOne({
              conversation: id,
              status: "pending",
              $or: [{ to: userId }, { from: userId }],
            })
              .sort({ createdAt: -1 })
              .lean()) as {
              _id: { toString(): string };
              conversation: { toString(): string };
              from: { toString(): string };
              to: { toString(): string };
              themeId?: string | null;
              blur?: number | null;
              dim?: number | null;
              wallpaperUrl?: string | null;
              createdAt?: Date;
            } | null;

            const proposalKey = pending?._id
              ? `${pending._id.toString()}|${pending.themeId ?? ""}|${pending.blur ?? 0}|${pending.dim ?? 0}|${pending.wallpaperUrl ?? ""}`
              : "0";

            if (proposalKey !== lastProposalKey) {
              lastProposalKey = proposalKey;
              const serialized = pending
                ? serializePendingThemeProposal(pending, userId)
                : null;
              send("theme_proposal", {
                pendingThemeProposal: serialized,
              });
            }
          }
        } catch (err) {
          console.error("SSE poll error:", err);
        }
      };

      const interval = setInterval(poll, 2500);
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
