/**
 * Precompute trending snapshot + popular people suggestions.
 *
 * Run: npm run precompute:recommendations
 *   or: npx --yes tsx scripts/computeTrending.ts
 *
 * Ops: schedule every 15–60m (cron / systemd).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";

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

async function main() {
  loadEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }

  await mongoose.connect(uri);

  const { PostModel } = await import("../src/models/Post");
  const { FollowModel } = await import("../src/models/Follow");
  const { PopularSuggestionModel } = await import(
    "../src/models/PopularSuggestion"
  );
  const { TrendingSnapshotModel } = await import(
    "../src/models/TrendingSnapshot"
  );

  // Ensure Phase 3 indexes exist (idempotent)
  await Promise.all([
    PostModel.syncIndexes(),
    FollowModel.syncIndexes(),
    PopularSuggestionModel.syncIndexes(),
    TrendingSnapshotModel.syncIndexes(),
  ]);

  const { precomputeRecommendations } = await import(
    "../src/lib/recommendations/precompute"
  );

  const t0 = Date.now();
  const result = await precomputeRecommendations();
  const ms = Date.now() - t0;

  console.log(
    JSON.stringify(
      {
        trendingCount: result.trendingCount,
        popularCount: result.popularCount,
        computedAt: result.computedAt.toISOString(),
        latencyMs: ms,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
