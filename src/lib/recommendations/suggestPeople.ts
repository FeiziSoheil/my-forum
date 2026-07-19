import { ObjectId } from "mongodb";
import {
  countFriendsOfFriends,
  getFollowingIds,
} from "@/lib/follow/edges";
import { getAffinityTags } from "@/lib/recommendations/affinity";
import { getPrecomputedPopularUserIds } from "@/lib/recommendations/precompute";
import { FollowRequestModel } from "@/models/FollowRequest";
import { PostFeedbackModel } from "@/models/PostFeedback";
import { PostModel } from "@/models/Post";
import { UserModel } from "@/models/User";

export type SuggestionReason = "mutuals" | "shared_interests" | "popular";

export type SuggestedUser = {
  _id: string;
  username: string;
  fullname: string;
  avatar?: string;
  mutualCount?: number;
  reason: SuggestionReason;
  isFollowing: boolean;
  isRequested: boolean;
};

type RankedCandidate = {
  userId: string;
  mutualCount: number;
  reason: SuggestionReason;
  /** Higher = better; used for merge priority within same reason. */
  priority: number;
};

/**
 * Pure merge/rank of suggestion candidates.
 * Prefer mutuals > shared_interests > popular; within reason, higher priority.
 */
export function rankSuggestedUsers(
  candidates: RankedCandidate[],
  limit: number
): RankedCandidate[] {
  const reasonOrder: Record<SuggestionReason, number> = {
    mutuals: 0,
    shared_interests: 1,
    popular: 2,
  };

  const best = new Map<string, RankedCandidate>();
  for (const c of candidates) {
    const prev = best.get(c.userId);
    if (!prev) {
      best.set(c.userId, c);
      continue;
    }
    const betterReason =
      reasonOrder[c.reason] < reasonOrder[prev.reason];
    const sameReasonBetter =
      c.reason === prev.reason &&
      (c.priority > prev.priority ||
        (c.priority === prev.priority && c.mutualCount > prev.mutualCount));
    if (betterReason || sameReasonBetter) {
      best.set(c.userId, c);
    }
  }

  return [...best.values()]
    .sort((a, b) => {
      const r = reasonOrder[a.reason] - reasonOrder[b.reason];
      if (r !== 0) return r;
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (b.mutualCount !== a.mutualCount) return b.mutualCount - a.mutualCount;
      return a.userId.localeCompare(b.userId);
    })
    .slice(0, limit);
}

async function getExcludeIds(userId: string): Promise<Set<string>> {
  const exclude = new Set<string>([userId]);

  const followingIds = await getFollowingIds(userId);
  for (const id of followingIds) {
    exclude.add(id.toString());
  }

  const pending = (await FollowRequestModel.find({
    from: userId,
    status: "pending",
  })
    .select("to")
    .lean()) as unknown as { to: ObjectId }[];

  for (const r of pending) {
    exclude.add(r.to.toString());
  }

  // Authors the viewer marked not_interested on (recent feedback)
  const feedback = (await PostFeedbackModel.find({
    user: userId,
    type: "not_interested",
    author: { $exists: true, $ne: null },
  })
    .select("author")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()) as unknown as { author?: ObjectId }[];

  for (const row of feedback) {
    if (row.author) exclude.add(row.author.toString());
  }

  return exclude;
}

/**
 * Friends-of-friends via Follow aggregate (people who follow accounts you follow).
 * Falls back to User.followers arrays when Follow is empty.
 */
export async function collectFoFCandidates(
  _userId: string,
  followingIds: ObjectId[],
  exclude: Set<string>
): Promise<RankedCandidate[]> {
  if (followingIds.length === 0) return [];

  const counts = await countFriendsOfFriends(followingIds, exclude);

  return [...counts.entries()].map(([id, mutualCount]) => ({
    userId: id,
    mutualCount,
    reason: "mutuals" as const,
    priority: mutualCount,
  }));
}

/**
 * Authors of recent posts matching affinity tags.
 */
export async function collectTagAuthorCandidates(
  affinityTags: string[],
  exclude: Set<string>
): Promise<RankedCandidate[]> {
  if (affinityTags.length === 0) return [];

  const posts = (await PostModel.find({
    isDeleted: { $ne: true },
    tags: { $in: affinityTags },
    visibility: "public",
  })
    .select("author tags")
    .sort({ _id: -1 })
    .limit(100)
    .lean()) as unknown as { author: ObjectId; tags?: string[] }[];

  const scores = new Map<string, number>();
  for (const p of posts) {
    const id = p.author.toString();
    if (exclude.has(id)) continue;
    let hit = 0;
    for (const t of p.tags ?? []) {
      if (affinityTags.includes(t.toLowerCase())) hit += 1;
    }
    scores.set(id, (scores.get(id) ?? 0) + hit);
  }

  return [...scores.entries()].map(([id, priority]) => ({
    userId: id,
    mutualCount: 0,
    reason: "shared_interests" as const,
    priority,
  }));
}

export async function collectPopularCandidates(
  exclude: Set<string>,
  limit: number
): Promise<RankedCandidate[]> {
  const cached = await getPrecomputedPopularUserIds(
    Math.max(limit * 3, limit),
    new Date()
  );
  if (cached && cached.length > 0) {
    return cached
      .filter((c) => !exclude.has(c.userId))
      .slice(0, limit)
      .map((c) => ({
        userId: c.userId,
        mutualCount: 0,
        reason: "popular" as const,
        priority: c.score,
      }));
  }

  const users = (await UserModel.find({
    isDeleted: { $ne: true },
    _id: { $nin: [...exclude].map((id) => new ObjectId(id)) },
  })
    .select("_id followersCount")
    .sort({ followersCount: -1, _id: 1 })
    .limit(limit)
    .lean()) as unknown as { _id: ObjectId; followersCount?: number }[];

  return users.map((u) => ({
    userId: u._id.toString(),
    mutualCount: 0,
    reason: "popular" as const,
    priority: u.followersCount ?? 0,
  }));
}

export async function getSuggestedPeople(opts: {
  userId: string | null;
  limit: number;
}): Promise<SuggestedUser[]> {
  const limit = Math.min(Math.max(opts.limit, 1), 20);

  if (!opts.userId) {
    const popular = await collectPopularCandidates(new Set(), limit);
    return hydrateSuggestedUsers(popular, new Set());
  }

  const userId = opts.userId;
  const exclude = await getExcludeIds(userId);

  const followingIds = await getFollowingIds(userId);

  const affinityTags = await getAffinityTags(userId);

  const [fof, tagAuthors, popular] = await Promise.all([
    collectFoFCandidates(userId, followingIds, exclude),
    collectTagAuthorCandidates(affinityTags, exclude),
    collectPopularCandidates(exclude, limit * 3),
  ]);

  const ranked = rankSuggestedUsers([...fof, ...tagAuthors, ...popular], limit);

  // Pending requests for display flags
  const pendingTo = new Set(
    (
      (await FollowRequestModel.find({
        from: userId,
        status: "pending",
        to: { $in: ranked.map((r) => r.userId) },
      })
        .select("to")
        .lean()) as unknown as { to: ObjectId }[]
    ).map((r) => r.to.toString())
  );

  return hydrateSuggestedUsers(ranked, pendingTo);
}

async function hydrateSuggestedUsers(
  ranked: RankedCandidate[],
  pendingTo: Set<string>
): Promise<SuggestedUser[]> {
  if (ranked.length === 0) return [];

  const users = (await UserModel.find({
    _id: { $in: ranked.map((r) => new ObjectId(r.userId)) },
    isDeleted: { $ne: true },
  })
    .select("username fullname avatar")
    .lean()) as unknown as {
    _id: ObjectId;
    username: string;
    fullname: string;
    avatar?: string;
  }[];

  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  const out: SuggestedUser[] = [];
  for (const r of ranked) {
    const u = byId.get(r.userId);
    if (!u) continue;
    out.push({
      _id: r.userId,
      username: u.username,
      fullname: u.fullname,
      avatar: u.avatar,
      mutualCount: r.reason === "mutuals" ? r.mutualCount : undefined,
      reason: r.reason,
      isFollowing: false,
      isRequested: pendingTo.has(r.userId),
    });
  }
  return out;
}
