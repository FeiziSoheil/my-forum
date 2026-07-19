import { presenceFromLastSeen } from "@/lib/presence/status";
import { MessageModel } from "@/models/Message";
import { ThemeProposalModel } from "@/models/ThemeProposal";
import { UserModel } from "@/models/User";
import { PRESENCE_ONLINE_MS } from "@/lib/presence/constants";
import type {
  PendingThemeProposal,
  SharedChatTheme,
} from "@/types/chatTheme";

export type LeanParticipant = {
  _id: { toString(): string };
  username: string;
  fullname: string;
  avatar?: string;
};

export type LeanSharedTheme = {
  themeId?: string | null;
  blur?: number | null;
  dim?: number | null;
  wallpaperUrl?: string | null;
  proposedBy?: { toString(): string } | string | null;
  acceptedAt?: Date | string | null;
};

export type LeanConversation = {
  _id: unknown;
  type?: "direct" | "group";
  title?: string | null;
  createdBy?: { toString(): string } | null;
  admins?: Array<{ toString(): string }>;
  participants?: LeanParticipant[];
  readState?: Array<{ user: { toString(): string }; lastReadAt: Date }>;
  lastMessage?: unknown;
  lastMessageAt?: Date | null;
  sharedTheme?: LeanSharedTheme | null;
  createdAt?: Date;
  updatedAt?: Date;
};

function idStr(v: { toString(): string } | string | null | undefined): string {
  if (!v) return "";
  return typeof v === "string" ? v : v.toString();
}

function serializeSharedTheme(
  raw: LeanSharedTheme | null | undefined
): SharedChatTheme | null {
  if (!raw?.themeId || !raw.acceptedAt) return null;
  const proposedBy = idStr(raw.proposedBy);
  if (!proposedBy) return null;
  const acceptedAt =
    raw.acceptedAt instanceof Date
      ? raw.acceptedAt.toISOString()
      : String(raw.acceptedAt);
  return {
    themeId: raw.themeId,
    blur: typeof raw.blur === "number" ? raw.blur : 6,
    dim: typeof raw.dim === "number" ? raw.dim : 40,
    wallpaperUrl: raw.wallpaperUrl ?? null,
    proposedBy,
    acceptedAt,
  };
}

type LeanThemeProposal = {
  _id: { toString(): string };
  conversation: { toString(): string };
  from: { toString(): string };
  to: { toString(): string };
  themeId?: string | null;
  blur?: number | null;
  dim?: number | null;
  wallpaperUrl?: string | null;
  createdAt?: Date;
};

export function serializePendingThemeProposal(
  raw: LeanThemeProposal,
  viewerId: string
): PendingThemeProposal | null {
  if (!raw?.themeId) return null;
  const from = idStr(raw.from);
  const to = idStr(raw.to);
  if (!from || !to) return null;
  return {
    _id: raw._id.toString(),
    status: "pending",
    themeId: raw.themeId,
    blur: typeof raw.blur === "number" ? raw.blur : 6,
    dim: typeof raw.dim === "number" ? raw.dim : 40,
    wallpaperUrl: raw.wallpaperUrl ?? null,
    conversation: idStr(raw.conversation),
    from,
    to,
    isIncoming: to === viewerId,
    createdAt: raw.createdAt ? raw.createdAt.toISOString() : undefined,
  };
}

async function findPendingThemeProposal(
  conversationId: unknown,
  userId: string
): Promise<PendingThemeProposal | null> {
  const doc = (await ThemeProposalModel.findOne({
    conversation: conversationId,
    status: "pending",
    $or: [{ to: userId }, { from: userId }],
  })
    .sort({ createdAt: -1 })
    .lean()) as LeanThemeProposal | null;
  if (!doc) return null;
  return serializePendingThemeProposal(doc, userId);
}

export async function unreadCountFor(
  conversationId: unknown,
  userId: string,
  readState?: LeanConversation["readState"]
): Promise<number> {
  const readEntry = readState?.find((r) => idStr(r.user) === userId);
  const lastReadAt = readEntry?.lastReadAt ?? new Date(0);
  return MessageModel.countDocuments({
    conversation: conversationId,
    sender: { $ne: userId },
    createdAt: { $gt: lastReadAt },
    isDeleted: { $ne: true },
  });
}

export async function serializeConversation(
  conv: LeanConversation,
  userId: string,
  options?: { includePresence?: boolean; includePendingTheme?: boolean }
) {
  const participants = conv.participants ?? [];
  const type = conv.type === "group" ? "group" : "direct";
  const admins = (conv.admins ?? []).map(idStr).filter(Boolean);
  const createdBy = idStr(conv.createdBy) || null;
  const memberCount = participants.length;
  const otherUser =
    participants.find((p) => idStr(p._id) !== userId) ?? participants[0];

  const unreadCount = await unreadCountFor(conv._id, userId, conv.readState);

  const pendingThemeProposal =
    options?.includePendingTheme && type === "direct"
      ? await findPendingThemeProposal(conv._id, userId)
      : undefined;

  let otherUserPresence = undefined as
    | { online: boolean; lastSeenAt: string | null }
    | undefined;
  let onlineCount: number | undefined;

  if (options?.includePresence) {
    if (type === "direct" && otherUser?._id) {
      const peer = (await UserModel.findById(otherUser._id)
        .select("lastSeenAt")
        .lean()) as { lastSeenAt?: Date | null } | null;
      otherUserPresence = presenceFromLastSeen(peer?.lastSeenAt ?? null);
    } else if (type === "group") {
      const otherIds = participants
        .map((p) => idStr(p._id))
        .filter((id) => id && id !== userId);
      if (otherIds.length > 0) {
        const cutoff = new Date(Date.now() - PRESENCE_ONLINE_MS);
        onlineCount = await UserModel.countDocuments({
          _id: { $in: otherIds },
          lastSeenAt: { $gte: cutoff },
        });
      } else {
        onlineCount = 0;
      }
    }
  }

  return {
    _id: conv._id,
    type,
    title: type === "group" ? conv.title ?? null : null,
    createdBy,
    admins,
    isAdmin: admins.includes(userId),
    participants,
    memberCount,
    onlineCount,
    otherUser: type === "direct" ? otherUser : undefined,
    otherUserPresence,
    lastMessage: conv.lastMessage ?? null,
    lastMessageAt: conv.lastMessageAt ?? null,
    unreadCount,
    sharedTheme: serializeSharedTheme(conv.sharedTheme),
    ...(pendingThemeProposal !== undefined
      ? { pendingThemeProposal }
      : {}),
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  };
}
