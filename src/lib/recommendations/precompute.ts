import { ObjectId } from "mongodb";
import { materializeTrendingSnapshot } from "@/lib/recommendations/trending";
import { PopularSuggestionModel } from "@/models/PopularSuggestion";
import { UserModel } from "@/models/User";

/** Prefer precomputed popular rows fresher than this; else live fallback. */
export const POPULAR_MAX_AGE_MS = 90 * 60 * 1000;
export const POPULAR_PRECOMPUTE_LIMIT = 50;

export type PrecomputeResult = {
  trendingCount: number;
  popularCount: number;
  computedAt: Date;
};

/**
 * Rebuild trending snapshot + PopularSuggestion rows.
 * Cron: `npm run precompute:recommendations`
 */
export async function precomputeRecommendations(
  now: Date = new Date()
): Promise<PrecomputeResult> {
  const trend = await materializeTrendingSnapshot({ now });
  const popularCount = await materializePopularSuggestions({
    now,
    limit: POPULAR_PRECOMPUTE_LIMIT,
  });

  return {
    trendingCount: trend.count,
    popularCount,
    computedAt: now,
  };
}

export async function materializePopularSuggestions(opts?: {
  now?: Date;
  limit?: number;
}): Promise<number> {
  const now = opts?.now ?? new Date();
  const limit = opts?.limit ?? POPULAR_PRECOMPUTE_LIMIT;

  const users = (await UserModel.find({ isDeleted: { $ne: true } })
    .select("_id followersCount")
    .sort({ followersCount: -1, _id: 1 })
    .limit(limit)
    .lean()) as unknown as { _id: ObjectId; followersCount?: number }[];

  await PopularSuggestionModel.deleteMany({});
  if (users.length === 0) return 0;

  await PopularSuggestionModel.insertMany(
    users.map((u, i) => ({
      user: u._id,
      rank: i + 1,
      score: u.followersCount ?? 0,
      computedAt: now,
    }))
  );

  return users.length;
}

/**
 * Load precomputed popular user IDs in rank order, or null if empty/stale.
 */
export async function getPrecomputedPopularUserIds(
  limit: number,
  now: Date = new Date()
): Promise<{ userId: string; score: number }[] | null> {
  const newest = (await PopularSuggestionModel.findOne()
    .sort({ computedAt: -1 })
    .select("computedAt")
    .lean()) as { computedAt?: Date } | null;

  if (!newest?.computedAt) return null;
  if (now.getTime() - new Date(newest.computedAt).getTime() > POPULAR_MAX_AGE_MS) {
    return null;
  }

  const rows = (await PopularSuggestionModel.find()
    .sort({ rank: 1 })
    .limit(limit)
    .select("user score")
    .lean()) as unknown as { user: ObjectId; score?: number }[];

  if (rows.length === 0) return null;
  return rows.map((r) => ({
    userId: r.user.toString(),
    score: r.score ?? 0,
  }));
}
