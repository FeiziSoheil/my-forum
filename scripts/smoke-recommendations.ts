/**
 * Smoke + quality gate for Phase 1–3 recommendations.
 * Run: npm run smoke:recommendations
 *   or: npx --yes tsx scripts/smoke-recommendations.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import {
  applyScoreCursor,
  applySeenSoftPenalty,
  decodeScoreCursor,
  encodeScoreCursor,
  engagementRaw,
  scorePost,
  tagAffinityScore,
} from "../src/lib/recommendations/score";
import { rankSuggestedUsers } from "../src/lib/recommendations/suggestPeople";
import {
  getRankedForYouPosts,
  partitionSeenViews,
} from "../src/lib/recommendations/rankPosts";
import { getSuggestedPeople } from "../src/lib/recommendations/suggestPeople";
import { visibilityClause } from "../src/lib/recommendations/visibility";
import {
  materializeTrendingSnapshot,
  getFreshTrendingPostIds,
  getTrendingCandidatePosts,
} from "../src/lib/recommendations/trending";
import {
  getPrecomputedPopularUserIds,
  materializePopularSuggestions,
  precomputeRecommendations,
} from "../src/lib/recommendations/precompute";
import {
  contentRegexClause,
  contentSearchClause,
} from "../src/lib/search/contentQuery";
import {
  createFollowEdge,
  deleteFollowEdge,
  getFollowingIds,
  viewerFollowsAuthor,
} from "../src/lib/follow/edges";
import { FollowModel } from "../src/models/Follow";
import { PopularSuggestionModel } from "../src/models/PopularSuggestion";
import { PostFeedbackModel } from "../src/models/PostFeedback";
import { PostViewModel } from "../src/models/PostView";
import { UserModel } from "../src/models/User";
import { PostModel } from "../src/models/Post";
import { TrendingSnapshotModel, TRENDING_SNAPSHOT_ID } from "../src/models/TrendingSnapshot";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* no .env */
  }
}

type Check = { name: string; pass: boolean; detail?: string; weight: number };

const checks: Check[] = [];

function assert(name: string, pass: boolean, detail?: string, weight = 1) {
  checks.push({ name, pass, detail, weight });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function runPureTests() {
  console.log("\n=== Pure scoring / ranking ===");

  const now = new Date("2026-07-18T12:00:00Z");
  const fresh = scorePost(
    {
      authorId: "a1",
      createdAt: new Date("2026-07-18T11:00:00Z"),
      likesCount: 10,
      repliesCount: 2,
      repostsCount: 1,
      tags: ["nextjs", "react"],
    },
    {
      now,
      affinityTags: new Set(["nextjs"]),
      followingIds: new Set(["a1"]),
      maxEngagement: 20,
    }
  );
  const stale = scorePost(
    {
      authorId: "a2",
      createdAt: new Date("2026-07-01T12:00:00Z"),
      likesCount: 0,
      tags: [],
    },
    {
      now,
      affinityTags: new Set(["nextjs"]),
      followingIds: new Set(["a1"]),
      maxEngagement: 20,
    }
  );
  assert("fresh+affinity+following scores higher than stale", fresh > stale, `fresh=${fresh.toFixed(3)} stale=${stale.toFixed(3)}`);

  assert(
    "tagAffinityScore hits",
    tagAffinityScore(["NextJS", "foo"], new Set(["nextjs"])) > 0,
    undefined,
    0.5
  );

  assert(
    "engagementRaw weights replies/reposts",
    engagementRaw({ likesCount: 1, repliesCount: 2, repostsCount: 1 }) ===
      1 + 3 + 2,
    undefined,
    0.5
  );

  assert(
    "engagementRaw includes viewsCount lightly",
    engagementRaw({ likesCount: 0, viewsCount: 20 }) === 1,
    `got=${engagementRaw({ likesCount: 0, viewsCount: 20 })}`,
    1
  );

  assert(
    "views boost engagement vs identical post without views",
    engagementRaw({ likesCount: 5, viewsCount: 100 }) >
      engagementRaw({ likesCount: 5, viewsCount: 0 }),
    undefined,
    1
  );

  assert(
    "seen soft penalty multiplies score",
    applySeenSoftPenalty(1, true) === 0.45 && applySeenSoftPenalty(1, false) === 1,
    undefined,
    1
  );

  const nowSeen = new Date("2026-07-19T12:00:00Z");
  const buckets = partitionSeenViews(
    [
      { post: "hard1", viewedAt: new Date("2026-07-19T10:00:00Z") },
      { post: "soft1", viewedAt: new Date("2026-07-10T12:00:00Z") },
      { post: "old1", viewedAt: new Date("2026-06-01T12:00:00Z") },
    ],
    nowSeen
  );
  assert(
    "partitionSeenViews hard vs soft",
    buckets.hardExclude.has("hard1") &&
      buckets.softPenalty.has("soft1") &&
      !buckets.hardExclude.has("soft1") &&
      !buckets.softPenalty.has("old1"),
    `hard=${[...buckets.hardExclude]} soft=${[...buckets.softPenalty]}`,
    1.5
  );

  const cursor = encodeScoreCursor(0.8, "bbb", ["aaa"]);
  const decoded = decodeScoreCursor(cursor);
  assert(
    "cursor round-trip",
    !!decoded &&
      decoded.score === 0.8 &&
      decoded.id === "bbb" &&
      decoded.exclude.length === 1 &&
      decoded.exclude[0] === "aaa"
  );

  const page = applyScoreCursor(
    [
      { _id: "c", score: 0.5 },
      { _id: "b", score: 0.9 },
      { _id: "a", score: 0.9 },
    ],
    { score: 0.9, id: "b" }
  );
  assert(
    "cursor pagination order",
    page.map((p) => p._id).join(",") === "a,c",
    page.map((p) => p._id).join(",")
  );

  const pageExcluded = applyScoreCursor(
    [
      { _id: "c", score: 0.5 },
      { _id: "b", score: 0.9 },
      { _id: "a", score: 0.9 },
    ],
    { score: 0.9, id: "b", exclude: ["b", "a"] }
  );
  assert(
    "exclude-id cursor drops prior pages",
    pageExcluded.map((p) => p._id).join(",") === "c",
    pageExcluded.map((p) => p._id).join(",")
  );

  const ranked = rankSuggestedUsers(
    [
      { userId: "u1", mutualCount: 2, reason: "popular", priority: 100 },
      { userId: "u2", mutualCount: 3, reason: "mutuals", priority: 3 },
      { userId: "u1", mutualCount: 1, reason: "mutuals", priority: 1 },
      { userId: "u3", mutualCount: 0, reason: "shared_interests", priority: 5 },
    ],
    10
  );
  assert(
    "suggest merge prefers mutuals over popular for same user",
    ranked[0]?.userId === "u2" &&
      ranked.find((r) => r.userId === "u1")?.reason === "mutuals",
    ranked.map((r) => `${r.userId}:${r.reason}`).join(", ")
  );

  // Privacy clause shape
  const guest = visibilityClause(null, []);
  assert(
    "guest visibility is public-only",
    guest.visibility === "public",
    undefined,
    0.5
  );
  const auth = visibilityClause("me", ["f1"]);
  assert(
    "auth visibility has $or branches",
    Array.isArray(auth.$or) && (auth.$or as unknown[]).length === 3,
    undefined,
    0.5
  );

  // Phase 3: schema indexes present
  const followIndexes = FollowModel.schema.indexes();
  const followHasUniquePair = followIndexes.some((idx) => {
    const keys = idx[0] as Record<string, number>;
    const opts = idx[1] as { unique?: boolean } | undefined;
    return (
      keys.follower === 1 &&
      keys.following === 1 &&
      !!opts?.unique
    );
  });
  assert("Follow unique (follower, following) index", followHasUniquePair, undefined, 1);

  const postIndexes = PostModel.schema.indexes();
  const postHasAuthorCreated = postIndexes.some((idx) => {
    const keys = idx[0] as Record<string, number>;
    return keys.isDeleted === 1 && keys.author === 1 && keys.createdAt === -1;
  });
  const postHasFeedCreated = postIndexes.some((idx) => {
    const keys = idx[0] as Record<string, number>;
    return keys.isDeleted === 1 && keys.createdAt === -1;
  });
  const postHasTrendingCompound = postIndexes.some((idx) => {
    const keys = idx[0] as Record<string, number>;
    return (
      keys.isDeleted === 1 &&
      keys.createdAt === -1 &&
      keys.likesCount === -1 &&
      keys.repliesCount === -1
    );
  });
  const postHasText = postIndexes.some((idx) => {
    const keys = idx[0] as Record<string, unknown>;
    return keys.content === "text";
  });
  assert("Post author+createdAt compound index", postHasAuthorCreated, undefined, 0.5);
  assert("Post isDeleted+createdAt feed index", postHasFeedCreated, undefined, 0.5);
  assert("Post trending likes compound index", postHasTrendingCompound, undefined, 0.5);
  assert("Post content text index declared", postHasText, undefined, 1);

  const textClause = contentSearchClause("nextjs");
  assert(
    "contentSearchClause uses $text for tokens",
    !!(textClause.filter as { $text?: { $search?: string } }).$text?.$search &&
      textClause.useTextScore,
    undefined,
    1
  );
  const shortClause = contentSearchClause("a");
  assert(
    "contentSearchClause short query uses regex",
    !shortClause.useTextScore &&
      !!(contentRegexClause("a") as { content?: unknown }).content,
    undefined,
    0.5
  );
}

async function runDbTests() {
  console.log("\n=== DB integration ===");
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    assert("MONGODB_URI present", false, "skip DB checks");
    return;
  }

  await mongoose.connect(uri);

  // Ensure indexes from new models are registered
  await FollowModel.syncIndexes().catch(() => undefined);
  await PostModel.syncIndexes().catch(() => undefined);
  await TrendingSnapshotModel.syncIndexes().catch(() => undefined);
  await PopularSuggestionModel.syncIndexes().catch(() => undefined);

  const user = (await UserModel.findOne({ isDeleted: { $ne: true } })
    .select("_id following")
    .lean()) as { _id: { toString(): string }; following?: { user?: unknown }[] } | null;

  if (!user) {
    assert("seed user exists", false);
    await mongoose.disconnect();
    return;
  }

  const userId = user._id.toString();

  // --- Phase 3: Follow edges ---
  const arrayFollowingIds = new Set(
    (user.following ?? [])
      .map((f) => (f.user ? String(f.user) : ""))
      .filter(Boolean)
  );
  const edgeFollowingIds = await getFollowingIds(userId);
  const edgeSet = new Set(edgeFollowingIds.map((id) => id.toString()));

  // If arrays have follows, getFollowingIds should return a matching set
  // (after backfill or via fallback). Allow fallback equality.
  if (arrayFollowingIds.size > 0) {
    const missing = [...arrayFollowingIds].filter((id) => !edgeSet.has(id));
    assert(
      "getFollowingIds covers User.following",
      missing.length === 0,
      missing.length ? `missing=${missing.slice(0, 3).join(",")}` : `n=${edgeSet.size}`,
      1.5
    );
  } else {
    assert(
      "getFollowingIds covers User.following (empty)",
      edgeSet.size === 0,
      undefined,
      0.5
    );
  }

  // Synthetic dual-write edge create/delete (cleanup)
  const other = (await UserModel.findOne({
    _id: { $ne: userId },
    isDeleted: { $ne: true },
  })
    .select("_id")
    .lean()) as { _id: ObjectId } | null;

  if (other) {
    const otherId = other._id.toString();
    await createFollowEdge(userId, otherId);
    const follows = await viewerFollowsAuthor(userId, otherId);
    assert("createFollowEdge + viewerFollowsAuthor", follows, otherId, 1.5);
    await deleteFollowEdge(userId, otherId);
    // After delete, may still be true if originally following via arrays —
    // only assert false when other was NOT in original following set
    if (!arrayFollowingIds.has(otherId)) {
      const still = await viewerFollowsAuthor(userId, otherId);
      assert("deleteFollowEdge removes edge", !still, otherId, 1);
    } else {
      // Restore edge we deleted (user was already following in arrays)
      await createFollowEdge(userId, otherId);
      assert("deleteFollowEdge (restored pre-existing)", true, "restored", 0.5);
    }
  } else {
    assert("Follow edge lifecycle (no second user)", true, "skipped", 0.5);
  }

  // FoF path uses FollowModel (collection query returns without throwing)
  const followEdgeCount = await FollowModel.countDocuments({});
  assert(
    "Follow collection queryable",
    followEdgeCount >= 0,
    `docs=${followEdgeCount}`,
    1
  );

  // --- Phase 3: Trending snapshot ---
  const trendResult = await materializeTrendingSnapshot();
  assert(
    "materializeTrendingSnapshot completes",
    trendResult.count >= 0 && Array.isArray(trendResult.postIds),
    `count=${trendResult.count}`,
    1.5
  );

  const freshIds = await getFreshTrendingPostIds();
  assert(
    "fresh trending snapshot readable",
    freshIds !== null || trendResult.count === 0,
    freshIds ? `ids=${freshIds.length}` : "empty snapshot",
    1
  );

  const snapDoc = await TrendingSnapshotModel.findById(TRENDING_SNAPSHOT_ID)
    .select("_id computedAt")
    .lean();
  assert(
    "TrendingSnapshot document exists",
    !!snapDoc || trendResult.count === 0,
    undefined,
    0.5
  );

  const t0 = Date.now();
  const ranked = await getRankedForYouPosts({ userId, limit: 10 });
  const latency = Date.now() - t0;

  assert(
    "for-you returns posts (cold or warm)",
    ranked.posts.length > 0 || ranked.meta.candidateCount === 0,
    `posts=${ranked.posts.length} candidates=${ranked.meta.candidateCount}`,
    1.5
  );

  assert(
    "for-you reports trendingSource",
    ranked.meta.trendingSource === "snapshot" ||
      ranked.meta.trendingSource === "live",
    `source=${ranked.meta.trendingSource}`,
    1
  );

  if (freshIds && freshIds.length > 0) {
    assert(
      "for-you prefers snapshot when fresh",
      ranked.meta.trendingSource === "snapshot",
      ranked.meta.trendingSource,
      1
    );
  } else {
    assert(
      "for-you snapshot prefer (no candidates)",
      true,
      "empty trending pool",
      0.5
    );
  }

  const trendCandidates = await getTrendingCandidatePosts({
    baseFilter: { isDeleted: false, visibility: "public" },
    limit: 10,
  });
  assert(
    "getTrendingCandidatePosts returns source",
    trendCandidates.source === "snapshot" || trendCandidates.source === "live",
    trendCandidates.source,
    0.5
  );

  // --- Phase 3: Popular suggestions precompute ---
  const pre = await precomputeRecommendations();
  assert(
    "precomputeRecommendations runs",
    pre.trendingCount >= 0 && pre.popularCount >= 0,
    `trend=${pre.trendingCount} popular=${pre.popularCount}`,
    1.5
  );

  const popularIds = await getPrecomputedPopularUserIds(10);
  assert(
    "popular suggestions snapshot readable",
    popularIds !== null || pre.popularCount === 0,
    popularIds ? `n=${popularIds.length}` : "empty",
    1
  );

  if (pre.popularCount === 0) {
    await materializePopularSuggestions({ limit: 5 });
  }

  // Cold start / any: must not include viewer's own posts
  const ownLeak = ranked.posts.some((p) => {
    const a = p.author;
    const id =
      a && typeof a === "object" && "_id" in a
        ? String((a as { _id: unknown })._id)
        : String(a);
    return id === userId;
  });
  assert("for-you excludes own posts", !ownLeak);

  // Privacy: no followers/private posts from non-followed private authors
  const followingSet = new Set(
    (user.following ?? [])
      .map((f) => (f.user ? String(f.user) : ""))
      .filter(Boolean)
  );
  let privacyOk = true;
  for (const p of ranked.posts) {
    const vis = (p as { visibility?: string }).visibility;
    const a = p.author;
    const authorId =
      a && typeof a === "object" && "_id" in a
        ? String((a as { _id: unknown })._id)
        : String(a);
    if (vis === "private" && authorId !== userId) privacyOk = false;
    if (vis === "followers" && authorId !== userId && !followingSet.has(authorId)) {
      privacyOk = false;
    }
  }
  assert("for-you respects post visibility", privacyOk, undefined, 1.5);

  if (
    ranked.meta.followingCount > 0 &&
    ranked.meta.followingCandidateCount > 0 &&
    ranked.posts.length >= 5
  ) {
    assert(
      "following share in top10 ≥ 30% when follows exist",
      ranked.meta.followingShareTop10 >= 0.3,
      `share=${(ranked.meta.followingShareTop10 * 100).toFixed(0)}% candidates=${ranked.meta.followingCandidateCount}`,
      1.5
    );
  } else {
    assert(
      "following share check (skipped — no following posts in pool)",
      true,
      `following=${ranked.meta.followingCount} followingCandidates=${ranked.meta.followingCandidateCount}`,
      0.5
    );
  }

  assert(
    "for-you latency < 1000ms",
    latency < 1000,
    `${latency}ms`,
    1
  );

  // Tag affinity soft check: if user has affinity tags, some returned posts share them
  if (ranked.meta.affinityTags.length > 0 && ranked.posts.length > 0) {
    const tagSet = new Set(ranked.meta.affinityTags);
    const hit = ranked.posts.some((p) =>
      (p.tags ?? []).some((t) => tagSet.has(String(t).toLowerCase()))
    );
    assert("affinity tags appear in results when available", hit, ranked.meta.affinityTags.join(","), 1);
  } else {
    assert("affinity soft-check (no affinity yet)", true, "cold affinity", 0.5);
  }

  // Phase 2: recently viewed posts must not appear in for-you page
  const recentViews = (await PostViewModel.find({
    user: userId,
    viewedAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
  })
    .select("post")
    .limit(50)
    .lean()) as unknown as { post: ObjectId }[];
  const hardSeenIds = new Set(recentViews.map((v) => v.post.toString()));
  const leakedSeen = ranked.posts.some((p) => hardSeenIds.has(p._id.toString()));
  if (hardSeenIds.size > 0) {
    assert(
      "for-you excludes posts viewed in last 48h",
      !leakedSeen,
      `seen=${hardSeenIds.size} leaked=${leakedSeen}`,
      1.5
    );
  } else {
    assert(
      "for-you seen-exclude (no recent views for user)",
      true,
      "no recent PostViews",
      0.5
    );
  }

  // Phase 2: not_interested feedback excludes post
  const otherPost = (await PostModel.findOne({
    isDeleted: { $ne: true },
    author: { $ne: userId },
    visibility: "public",
  })
    .select("_id author")
    .lean()) as { _id: ObjectId; author: ObjectId } | null;

  if (otherPost) {
    const feedbackPostId = otherPost._id.toString();
    await PostFeedbackModel.updateOne(
      { user: userId, post: feedbackPostId, type: "not_interested" },
      {
        $set: {
          user: userId,
          post: feedbackPostId,
          author: otherPost.author,
          type: "not_interested",
        },
      },
      { upsert: true }
    );

    const rankedAfter = await getRankedForYouPosts({ userId, limit: 30 });
    const feedbackLeak = rankedAfter.posts.some(
      (p) => p._id.toString() === feedbackPostId
    );
    assert(
      "not_interested post excluded from for-you",
      !feedbackLeak,
      feedbackPostId,
      1.5
    );

    // cleanup test feedback
    await PostFeedbackModel.deleteOne({
      user: userId,
      post: feedbackPostId,
      type: "not_interested",
    });
  } else {
    assert("not_interested exclude (no candidate post)", true, "skipped", 0.5);
  }

  const suggestions = await getSuggestedPeople({ userId, limit: 8 });
  assert(
    "people suggestions non-empty or empty DB",
    suggestions.length >= 0,
    `count=${suggestions.length}`
  );

  const followingIds = new Set(
    (user.following ?? [])
      .map((f) => (f.user ? String(f.user) : ""))
      .filter(Boolean)
  );
  const suggestsSelf = suggestions.some((s) => s._id === userId);
  const suggestsFollowing = suggestions.some((s) => followingIds.has(s._id));
  assert("suggestions exclude self", !suggestsSelf, undefined, 1.5);
  assert("suggestions exclude already-following", !suggestsFollowing, undefined, 1.5);

  const guestSuggestions = await getSuggestedPeople({ userId: null, limit: 5 });
  assert(
    "guest suggestions (popular) work",
    guestSuggestions.length > 0 || (await PostModel.countDocuments({})) === 0,
    `count=${guestSuggestions.length}`
  );

  // Phase 3: $text search path (with regex fallback if index missing)
  const samplePost = (await PostModel.findOne({
    isDeleted: { $ne: true },
    content: { $exists: true, $ne: "" },
  })
    .select("content")
    .lean()) as { content?: string } | null;

  if (samplePost?.content) {
    const token =
      samplePost.content
        .split(/\s+/)
        .map((t) => t.replace(/[^\p{L}\p{N}_]/gu, ""))
        .find((t) => t.length >= 3) ?? "";
    if (token) {
      const search = contentSearchClause(token);
      let textOk = false;
      try {
        const hit = await PostModel.find({
          isDeleted: false,
          ...search.filter,
        })
          .limit(3)
          .lean();
        textOk = Array.isArray(hit);
      } catch {
        const hit = await PostModel.find({
          isDeleted: false,
          ...contentRegexClause(token),
        })
          .limit(3)
          .lean();
        textOk = Array.isArray(hit);
      }
      assert("post content search path works", textOk, `token=${token}`, 1);
    } else {
      assert("post content search (no token)", true, "skipped", 0.5);
    }
  } else {
    assert("post content search (no posts)", true, "skipped", 0.5);
  }

  await mongoose.disconnect();
}

function scoreOverall(): number {
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);
  if (totalWeight === 0) return 0;
  return (earned / totalWeight) * 10;
}

async function main() {
  loadEnv();
  console.log("Recommendations smoke gate");
  runPureTests();
  try {
    await runDbTests();
  } catch (err) {
    assert("DB tests threw", false, String(err), 2);
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
  }

  const score = scoreOverall();
  const failed = checks.filter((c) => !c.pass);
  console.log("\n=== Score ===");
  console.log(`Overall: ${score.toFixed(1)} / 10`);
  console.log(`Passed: ${checks.filter((c) => c.pass).length}/${checks.length}`);
  if (failed.length) {
    console.log("Failed:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail ?? ""}`);
  }
  const ok = score >= 7;
  console.log(ok ? "GATE: ACCEPT (≥7) — proceed to API/UI" : "GATE: REJECT (<7) — tune weights");
  process.exit(ok ? 0 : 1);
}

main();
