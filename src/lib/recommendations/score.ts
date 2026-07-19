/** Pure scoring helpers — unit-testable without DB. */

export const SCORE_WEIGHTS = {
  recency: 0.35,
  engagement: 0.25,
  tagAffinity: 0.25,
  authorInFollowing: 0.15,
} as const;

/** Half-life for recency decay (~24h). */
export const RECENCY_HALF_LIFE_MS = 24 * 60 * 60 * 1000;

export type PostScoreInput = {
  tags?: string[];
  likesCount?: number;
  repliesCount?: number;
  repostsCount?: number;
  viewsCount?: number;
  createdAt: Date | string;
  authorId: string;
};

export type ScoreContext = {
  now?: Date;
  affinityTags: Set<string>;
  followingIds: Set<string>;
  /** Max raw engagement in the candidate pool (for 0–1 normalize). */
  maxEngagement: number;
};

/** Soft penalty for posts viewed in the 48h–14d window. */
export const SEEN_SOFT_PENALTY = 0.45;

export function engagementRaw(post: {
  likesCount?: number;
  repliesCount?: number;
  repostsCount?: number;
  viewsCount?: number;
}): number {
  return (
    (post.likesCount ?? 0) +
    (post.repliesCount ?? 0) * 1.5 +
    (post.repostsCount ?? 0) * 2 +
    (post.viewsCount ?? 0) * 0.05
  );
}

export function applySeenSoftPenalty(score: number, softSeen: boolean): number {
  if (!softSeen) return score;
  return score * SEEN_SOFT_PENALTY;
}

export function recencyScore(
  createdAt: Date | string,
  now: Date = new Date(),
  halfLifeMs: number = RECENCY_HALF_LIFE_MS
): number {
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return 0;
  const age = Math.max(0, now.getTime() - t);
  return Math.pow(0.5, age / halfLifeMs);
}

export function tagAffinityScore(
  tags: string[] | undefined,
  affinityTags: Set<string>
): number {
  if (!tags?.length || affinityTags.size === 0) return 0;
  let hits = 0;
  for (const tag of tags) {
    if (affinityTags.has(tag.toLowerCase())) hits += 1;
  }
  // Cap contribution: 3 matching tags → 1.0
  return Math.min(1, hits / 3);
}

export function scorePost(post: PostScoreInput, ctx: ScoreContext): number {
  const now = ctx.now ?? new Date();
  const eng =
    ctx.maxEngagement > 0
      ? Math.min(1, engagementRaw(post) / ctx.maxEngagement)
      : 0;
  const affinity = tagAffinityScore(post.tags, ctx.affinityTags);
  const inFollowing = ctx.followingIds.has(post.authorId) ? 1 : 0;

  return (
    SCORE_WEIGHTS.recency * recencyScore(post.createdAt, now) +
    SCORE_WEIGHTS.engagement * eng +
    SCORE_WEIGHTS.tagAffinity * affinity +
    SCORE_WEIGHTS.authorInFollowing * inFollowing
  );
}

export type ScoredItem = { _id: string; score: number };

/**
 * Stable rank: score desc, then _id desc.
 * Prefer exclude-id cursor (stable across rescoring). Legacy score cursor still supported.
 */
export function applyScoreCursor<T extends ScoredItem>(
  items: T[],
  cursor: { score: number; id: string; exclude?: string[] } | null
): T[] {
  const exclude = new Set(cursor?.exclude ?? []);
  if (cursor?.id) exclude.add(cursor.id);

  let sorted = [...items]
    .filter((item) => !exclude.has(item._id))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b._id.localeCompare(a._id);
    });

  // Legacy score-boundary only when no exclude list was provided.
  if (cursor && (!cursor.exclude || cursor.exclude.length === 0)) {
    sorted = sorted.filter((item) => {
      if (item.score < cursor.score) return true;
      if (item.score > cursor.score) return false;
      return item._id < cursor.id;
    });
  }

  return sorted;
}

export function encodeScoreCursor(
  score: number,
  id: string,
  exclude: string[] = []
): string {
  return Buffer.from(
    JSON.stringify({ s: score, i: id, e: exclude }),
    "utf8"
  ).toString("base64url");
}

export function decodeScoreCursor(
  cursor: string | null | undefined
): { score: number; id: string; exclude: string[] } | null {
  if (!cursor) return null;
  try {
    const raw = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as { s?: unknown; i?: unknown; e?: unknown };
    if (typeof raw.s !== "number" || typeof raw.i !== "string" || !raw.i) {
      return null;
    }
    const exclude = Array.isArray(raw.e)
      ? raw.e.filter((x): x is string => typeof x === "string")
      : [];
    return { score: raw.s, id: raw.i, exclude };
  } catch {
    return null;
  }
}

