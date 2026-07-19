import { ObjectId } from "mongodb";
import {
  TRENDING_SNAPSHOT_ID,
  TrendingSnapshotModel,
} from "@/models/TrendingSnapshot";
import { PostModel } from "@/models/Post";

/** Prefer snapshot when computed within this window. */
export const TRENDING_SNAPSHOT_FRESH_MS = 90 * 60 * 1000;
export const TRENDING_DEFAULT_WINDOW_MS = 48 * 60 * 60 * 1000;
export const TRENDING_DEFAULT_CAP = 40;

type LeanPost = {
  _id: ObjectId;
  [key: string]: unknown;
};

/**
 * Load fresh precomputed trending IDs, or null if stale/missing.
 */
export async function getFreshTrendingPostIds(
  now: Date = new Date()
): Promise<ObjectId[] | null> {
  const snap = (await TrendingSnapshotModel.findById(TRENDING_SNAPSHOT_ID)
    .select("computedAt postIds")
    .lean()) as {
    computedAt?: Date;
    postIds?: ObjectId[];
  } | null;

  if (!snap?.computedAt || !snap.postIds?.length) return null;
  const age = now.getTime() - new Date(snap.computedAt).getTime();
  if (age > TRENDING_SNAPSHOT_FRESH_MS) return null;
  return snap.postIds;
}

async function fetchTrendingLive(opts: {
  baseFilter: Record<string, unknown>;
  limit: number;
  since: Date;
}): Promise<LeanPost[]> {
  return (await PostModel.find({
    ...opts.baseFilter,
    createdAt: { $gte: opts.since },
  })
    .sort({ likesCount: -1, repliesCount: -1, viewsCount: -1, _id: -1 })
    .limit(opts.limit)
    .lean()) as unknown as LeanPost[];
}

/**
 * Trending candidates for For-you: prefer fresh snapshot IDs (re-filtered
 * with viewer baseFilter), else live sort.
 */
export async function getTrendingCandidatePosts(opts: {
  baseFilter: Record<string, unknown>;
  limit?: number;
  windowMs?: number;
  since?: Date;
  now?: Date;
}): Promise<{ posts: LeanPost[]; source: "snapshot" | "live" }> {
  const limit = opts.limit ?? TRENDING_DEFAULT_CAP;
  const windowMs = opts.windowMs ?? TRENDING_DEFAULT_WINDOW_MS;
  const now = opts.now ?? new Date();
  const since =
    opts.since ?? new Date(now.getTime() - windowMs);

  const snapIds = await getFreshTrendingPostIds(now);
  if (snapIds && snapIds.length > 0) {
    const posts = (await PostModel.find({
      ...opts.baseFilter,
      _id: { $in: snapIds },
    }).lean()) as unknown as LeanPost[];

    const byId = new Map(posts.map((p) => [p._id.toString(), p]));
    const ordered: LeanPost[] = [];
    for (const id of snapIds) {
      const p = byId.get(id.toString());
      if (p) ordered.push(p);
      if (ordered.length >= limit) break;
    }
    return { posts: ordered, source: "snapshot" };
  }

  const live = await fetchTrendingLive({
    baseFilter: opts.baseFilter,
    limit,
    since,
  });
  return { posts: live, source: "live" };
}

/**
 * Compute and upsert the global 48h trending snapshot (public posts).
 * Used by scripts/computeTrending.ts.
 */
export async function materializeTrendingSnapshot(opts?: {
  windowMs?: number;
  limit?: number;
  now?: Date;
}): Promise<{
  count: number;
  postIds: string[];
  computedAt: Date;
}> {
  const windowMs = opts?.windowMs ?? TRENDING_DEFAULT_WINDOW_MS;
  const limit = opts?.limit ?? TRENDING_DEFAULT_CAP;
  const now = opts?.now ?? new Date();
  const since = new Date(now.getTime() - windowMs);

  const posts = (await PostModel.find({
    isDeleted: false,
    visibility: "public",
    createdAt: { $gte: since },
  })
    .select("_id likesCount")
    .sort({ likesCount: -1, repliesCount: -1, viewsCount: -1, _id: -1 })
    .limit(limit)
    .lean()) as unknown as { _id: ObjectId; likesCount?: number }[];

  const postIds = posts.map((p) => p._id);
  const topLikesCount = posts[0]?.likesCount ?? 0;

  await TrendingSnapshotModel.findByIdAndUpdate(
    TRENDING_SNAPSHOT_ID,
    {
      $set: {
        _id: TRENDING_SNAPSHOT_ID,
        computedAt: now,
        windowMs,
        postIds,
        meta: { count: postIds.length, topLikesCount },
      },
    },
    { upsert: true, new: true }
  );

  return {
    count: postIds.length,
    postIds: postIds.map((id) => id.toString()),
    computedAt: now,
  };
}
