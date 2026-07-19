/**
 * Backfill Follow edges from User.following arrays.
 * Idempotent under unique (follower, following).
 *
 * Run: npx --yes tsx scripts/backfillFollows.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";

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

  // Import models after connect (HMR-safe schemas)
  const { UserModel } = await import("../src/models/User");
  const { FollowModel } = await import("../src/models/Follow");

  await FollowModel.syncIndexes();

  const cursor = UserModel.find({
    "following.0": { $exists: true },
  })
    .select("_id following")
    .cursor();

  let users = 0;
  let upserted = 0;
  let skipped = 0;
  let errors = 0;

  for await (const user of cursor) {
    users += 1;
    const followerId = user._id as ObjectId;
    const following =
      (
        user as {
          following?: { user?: ObjectId; createdAt?: Date }[];
        }
      ).following ?? [];

    for (const entry of following) {
      if (!entry.user) {
        skipped += 1;
        continue;
      }
      try {
        const res = await FollowModel.updateOne(
          { follower: followerId, following: entry.user },
          {
            $setOnInsert: {
              follower: followerId,
              following: entry.user,
              createdAt: entry.createdAt ?? new Date(),
            },
          },
          { upsert: true }
        );
        if (res.upsertedCount > 0) upserted += 1;
        else skipped += 1;
      } catch (err: unknown) {
        const code = (err as { code?: number })?.code;
        if (code === 11000) {
          skipped += 1;
        } else {
          errors += 1;
          console.error("edge error", followerId.toString(), entry.user, err);
        }
      }
    }
  }

  console.log(
    JSON.stringify(
      { users, upserted, skipped, errors, followDocs: await FollowModel.countDocuments() },
      null,
      2
    )
  );

  await mongoose.disconnect();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
