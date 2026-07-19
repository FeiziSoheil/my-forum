import { ObjectId } from "mongodb";
import { getFollowingIds } from "@/lib/follow/edges";
import { getAffinityTags } from "@/lib/recommendations/affinity";
import {
  applyScoreCursor,
  applySeenSoftPenalty,
  decodeScoreCursor,
  encodeScoreCursor,
  engagementRaw,
  scorePost,
} from "@/lib/recommendations/score";
import { getTrendingCandidatePosts } from "@/lib/recommendations/trending";
import {
  getBlockedPrivateAuthorIds,
  visibilityClause,
} from "@/lib/recommendations/visibility";
import { PostFeedbackModel } from "@/models/PostFeedback";
import { PostModel } from "@/models/Post";
import { PostViewModel } from "@/models/PostView";

const FOLLOWING_CAP = 100;
const AFFINITY_CAP = 80;
const TRENDING_CAP = 40;
const RECENT_CAP = 40;
const FOLLOWING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const AFFINITY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const TRENDING_WINDOW_MS = 48 * 60 * 60 * 1000;
const FOLLOWING_SOURCE_BOOST = 0.18;

/** Hard-exclude posts viewed within this window. */
export const SEEN_HARD_MS = 48 * 60 * 60 * 1000;
/** Soft-penalize posts viewed within this (but older than hard). */
export const SEEN_SOFT_MS = 14 * 24 * 60 * 60 * 1000;

type LeanPost = {
  _id: ObjectId;
  author: ObjectId | { _id: ObjectId };
  tags?: string[];
  likesCount?: number;
  repliesCount?: number;
  repostsCount?: number;
  viewsCount?: number;
  createdAt: Date;
  likes?: { user?: ObjectId }[];
  reposts?: { user?: ObjectId }[];
  [key: string]: unknown;
};

function authorIdOf(post: LeanPost): string {
  const a = post.author;
  if (a && typeof a === "object" && "_id" in a) {
    return (a as { _id: ObjectId })._id.toString();
  }
  return (a as ObjectId).toString();
}

export type SeenBuckets = {
  hardExclude: Set<string>;
  softPenalty: Set<string>;
};

/**
 * Split recent PostViews into hard-exclude (48h) and soft-penalty (48h–14d).
 */
export function partitionSeenViews(
  views: { post: ObjectId | string; viewedAt?: Date | string | null }[],
  now: Date = new Date()
): SeenBuckets {
  const hardExclude = new Set<string>();
  const softPenalty = new Set<string>();
  const hardSince = now.getTime() - SEEN_HARD_MS;
  const softSince = now.getTime() - SEEN_SOFT_MS;

  for (const v of views) {
    const id = v.post.toString();
    const t = v.viewedAt ? new Date(v.viewedAt).getTime() : 0;
    if (Number.isNaN(t) || t < softSince) continue;
    if (t >= hardSince) hardExclude.add(id);
    else softPenalty.add(id);
  }

  return { hardExclude, softPenalty };
}

async function loadSeenBuckets(
  userId: string,
  now: Date
): Promise<SeenBuckets> {
  const softSince = new Date(now.getTime() - SEEN_SOFT_MS);
  const views = (await PostViewModel.find({
    user: userId,
    viewedAt: { $gte: softSince },
  })
    .select("post viewedAt")
    .lean()) as unknown as { post: ObjectId; viewedAt?: Date }[];

  return partitionSeenViews(views, now);
}

async function loadFeedbackPostIds(userId: string): Promise<Set<string>> {
  const rows = (await PostFeedbackModel.find({
    user: userId,
    type: "not_interested",
  })
    .select("post")
    .limit(500)
    .lean()) as unknown as { post: ObjectId }[];

  return new Set(rows.map((r) => r.post.toString()));
}

type CandidateMap = Map<
  string,
  LeanPost & { _sources: Set<string>; _score: number }
>;

function addCandidates(
  map: CandidateMap,
  posts: LeanPost[],
  source: string
) {
  for (const post of posts) {
    const id = post._id.toString();
    const existing = map.get(id);
    if (existing) {
      existing._sources.add(source);
    } else {
      map.set(id, {
        ...post,
        _sources: new Set([source]),
        _score: 0,
      });
    }
  }
}

/**
 * Ranked For you feed for an authenticated viewer.
 */
export async function getRankedForYouPosts(opts: {
  userId: string;
  limit: number;
  cursor?: string | null;
}): Promise<{
  posts: LeanPost[];
  hasMore: boolean;
  nextCursor: string | null;
  meta: {
    affinityTags: string[];
    followingCount: number;
    candidateCount: number;
    followingCandidateCount: number;
    followingShareTop10: number;
    hardExcludedSeen: number;
    softPenalizedSeen: number;
    feedbackExcluded: number;
    trendingSource: "snapshot" | "live";
  };
}> {
  const { userId, limit } = opts;
  const cursor = decodeScoreCursor(opts.cursor);
  const now = new Date();
  const followingSince = new Date(now.getTime() - FOLLOWING_WINDOW_MS);
  const affinitySince = new Date(now.getTime() - AFFINITY_WINDOW_MS);
  const trendingSince = new Date(now.getTime() - TRENDING_WINDOW_MS);

  const followingIds = await getFollowingIds(userId);
  const followingSet = new Set(followingIds.map((id) => id.toString()));

  const [affinityTags, blockedAuthorIds, seen, feedbackIds] = await Promise.all([
    getAffinityTags(userId),
    getBlockedPrivateAuthorIds(userId, followingIds),
    loadSeenBuckets(userId, now),
    loadFeedbackPostIds(userId),
  ]);
  const affinitySet = new Set(affinityTags);

  const authorClause: Record<string, unknown> = {
    $ne: new ObjectId(userId),
  };
  if (blockedAuthorIds.length > 0) {
    authorClause.$nin = blockedAuthorIds;
  }

  const baseFilter: Record<string, unknown> = {
    isDeleted: false,
    author: authorClause,
    ...visibilityClause(userId, followingIds),
  };

  const coldStart = followingIds.length === 0 && affinityTags.length === 0;

  const fetchFollowing = async (): Promise<LeanPost[]> => {
    if (coldStart || followingIds.length === 0) return [];
    return (await PostModel.find({
      ...baseFilter,
      author: { ...authorClause, $in: followingIds },
      createdAt: { $gte: followingSince },
    })
      .sort({ _id: -1 })
      .limit(FOLLOWING_CAP)
      .lean()) as unknown as LeanPost[];
  };

  const fetchAffinity = async (): Promise<LeanPost[]> => {
    if (coldStart || affinityTags.length === 0) return [];
    return (await PostModel.find({
      ...baseFilter,
      tags: { $in: affinityTags },
      createdAt: { $gte: affinitySince },
    })
      .sort({ _id: -1 })
      .limit(AFFINITY_CAP)
      .lean()) as unknown as LeanPost[];
  };

  const fetchTrending = async (): Promise<{
    posts: LeanPost[];
    source: "snapshot" | "live";
  }> => {
    const result = await getTrendingCandidatePosts({
      baseFilter,
      limit: TRENDING_CAP,
      windowMs: TRENDING_WINDOW_MS,
      since: trendingSince,
    });
    return {
      posts: result.posts as LeanPost[],
      source: result.source,
    };
  };

  const fetchRecent = async (): Promise<LeanPost[]> =>
    (await PostModel.find(baseFilter)
      .sort({ _id: -1 })
      .limit(RECENT_CAP)
      .lean()) as unknown as LeanPost[];

  const [followingPosts, affinityPosts, trendingResult, recentPosts] =
    await Promise.all([
      fetchFollowing(),
      fetchAffinity(),
      fetchTrending(),
      fetchRecent(),
    ]);

  const trendingPosts = trendingResult.posts;

  const map: CandidateMap = new Map();
  addCandidates(map, followingPosts, "following");
  addCandidates(map, affinityPosts, "affinity");
  addCandidates(map, trendingPosts, "trending");
  addCandidates(map, recentPosts, "recent");

  // Hard-exclude recently viewed (48h) + not_interested — Phase 2 plan, no exhaustion fallback.
  for (const id of seen.hardExclude) map.delete(id);
  for (const id of feedbackIds) map.delete(id);

  const candidates = [...map.values()];
  let maxEngagement = 0;
  for (const p of candidates) {
    maxEngagement = Math.max(maxEngagement, engagementRaw(p));
  }

  for (const p of candidates) {
    const id = p._id.toString();
    let s = scorePost(
      {
        tags: p.tags,
        likesCount: p.likesCount,
        repliesCount: p.repliesCount,
        repostsCount: p.repostsCount,
        viewsCount: p.viewsCount,
        createdAt: p.createdAt,
        authorId: authorIdOf(p),
      },
      {
        now,
        affinityTags: affinitySet,
        followingIds: followingSet,
        maxEngagement,
      }
    );
    if (p._sources.has("following")) {
      s = Math.min(1, s + FOLLOWING_SOURCE_BOOST);
    }
    s = applySeenSoftPenalty(s, seen.softPenalty.has(id));
    p._score = s;
  }

  const scored = candidates.map((p) => ({
    ...p,
    score: p._score,
    _id: p._id.toString(),
  }));

  const afterCursor = applyScoreCursor(scored, cursor);
  const page = afterCursor.slice(0, limit + 1);
  const hasMore = page.length > limit;
  if (hasMore) page.pop();

  const prevExclude = cursor?.exclude ?? [];
  const pageIds = page.map((p) => p._id);
  const nextExclude = [...prevExclude, ...pageIds];

  const nextCursor =
    page.length > 0
      ? encodeScoreCursor(
          page[page.length - 1].score,
          page[page.length - 1]._id,
          nextExclude
        )
      : null;

  const top10 = afterCursor.slice(0, 10);
  const followingInTop = top10.filter((p) =>
    followingSet.has(authorIdOf(p as unknown as LeanPost))
  ).length;

  const posts: LeanPost[] = page.map((p) => {
    const {
      score: _score,
      _sources: _sources,
      _score: _internalScore,
      ...rest
    } = p as typeof p & {
      _sources?: Set<string>;
      _score?: number;
    };
    return {
      ...rest,
      _id: new ObjectId(p._id),
    } as LeanPost;
  });

  return {
    posts,
    hasMore,
    nextCursor,
    meta: {
      affinityTags,
      followingCount: followingIds.length,
      candidateCount: candidates.length,
      followingCandidateCount: followingPosts.length,
      followingShareTop10:
        top10.length > 0 ? followingInTop / top10.length : 0,
      hardExcludedSeen: seen.hardExclude.size,
      softPenalizedSeen: seen.softPenalty.size,
      feedbackExcluded: feedbackIds.size,
      trendingSource: trendingResult.source,
    },
  };
}

/** Re-export for callers that imported from rankPosts. */
export { getAffinityTags } from "@/lib/recommendations/affinity";
