/**
 * One-off migration: re-extract hashtags from post/reply content into `tags`.
 *
 * Rules match src/lib/tags/extractHashtags.ts:
 *   - `#tag` after start-of-string or whitespace
 *   - Unicode letters/numbers + `_`
 *   - Stored lowercase without `#`
 *
 * Also preserves existing chip-only tags (old form field) by merging:
 *   extract(content) ∪ normalize(existing tags)
 *
 * Usage:
 *   node --env-file=.env scripts/backfillTags.mjs
 */
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/backfillTags.mjs");
    process.exit(1);
}

/** Same as src/lib/tags/extractHashtags.ts */
const HASHTAG_RE = /(?<=^|\s)#([\p{L}\p{N}_]+)/gu;

function extractHashtags(content) {
    const seen = new Set();
    const tags = [];
    if (!content || typeof content !== "string") return tags;
    for (const match of content.matchAll(HASHTAG_RE)) {
        const tag = match[1]?.toLowerCase();
        if (!tag || seen.has(tag)) continue;
        seen.add(tag);
        tags.push(tag);
    }
    return tags;
}

/** Normalize a tag: strip leading #, lowercase, trim. */
function normalizeTag(raw) {
    if (raw == null) return null;
    let t = String(raw).trim();
    if (!t) return null;
    if (t.startsWith("#")) t = t.slice(1);
    t = t.trim().toLowerCase();
    return t || null;
}

/**
 * Merge content hashtags with existing tags.
 * Extracted tags first (order preserved), then existing that aren't already present.
 */
function mergeTags(content, existing) {
    const fromContent = extractHashtags(content);
    const seen = new Set(fromContent);
    const merged = [...fromContent];

    for (const raw of existing || []) {
        const tag = normalizeTag(raw);
        if (!tag || seen.has(tag)) continue;
        seen.add(tag);
        merged.push(tag);
    }
    return merged;
}

function tagsEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

const PostModel = mongoose.models.Post || mongoose.model("Post", new mongoose.Schema({}, { strict: false }));
const ReplyModel = mongoose.models.Reply || mongoose.model("Reply", new mongoose.Schema({}, { strict: false }));

async function backfillCollection(Model, label) {
    const docs = await Model.find({}).select("_id content tags").lean();
    let updated = 0;
    let unchanged = 0;
    let withTags = 0;
    const samples = [];

    for (const doc of docs) {
        const next = mergeTags(doc.content, doc.tags);
        const prev = Array.isArray(doc.tags) ? doc.tags : [];

        if (tagsEqual(prev, next)) {
            unchanged++;
            if (next.length) withTags++;
            continue;
        }

        await Model.updateOne({ _id: doc._id }, { $set: { tags: next } });
        updated++;
        if (next.length) withTags++;

        if (samples.length < 5 && extractHashtags(doc.content).length > 0) {
            samples.push({
                id: String(doc._id),
                contentSnippet: String(doc.content || "").slice(0, 80),
                before: prev,
                after: next,
            });
        }
    }

    return { label, total: docs.length, updated, unchanged, withTags, samples };
}

async function main() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected. Backfilling tags...\n");

    const posts = await backfillCollection(PostModel, "posts");
    const replies = await backfillCollection(ReplyModel, "replies");

    for (const r of [posts, replies]) {
        console.log(`--- ${r.label} ---`);
        console.log(`  total:      ${r.total}`);
        console.log(`  updated:    ${r.updated}`);
        console.log(`  unchanged:  ${r.unchanged}`);
        console.log(`  with tags:  ${r.withTags}`);
        if (r.samples.length) {
            console.log("  spot-check samples (content had #hashtag):");
            for (const s of r.samples) {
                console.log(`    ${s.id}`);
                console.log(`      content: ${JSON.stringify(s.contentSnippet)}`);
                console.log(`      before:  ${JSON.stringify(s.before)}`);
                console.log(`      after:   ${JSON.stringify(s.after)}`);
            }
        }
        console.log();
    }

    // Extra verification: find one post with # in content and confirm tags
    const withHash = await PostModel.findOne({ content: /(?<=^|\s)#[\p{L}\p{N}_]+/u })
        .select("_id content tags")
        .lean();
    if (withHash) {
        const expected = mergeTags(withHash.content, withHash.tags);
        const ok = expected.every((t) => (withHash.tags || []).includes(t));
        console.log("Verification post with # in content:");
        console.log(`  id: ${withHash._id}`);
        console.log(`  tags: ${JSON.stringify(withHash.tags)}`);
        console.log(`  extract ∪ existing all present: ${ok}`);
        const fromContent = extractHashtags(withHash.content);
        console.log(`  from content: ${JSON.stringify(fromContent)}`);
        console.log(`  content tags present: ${fromContent.every((t) => (withHash.tags || []).includes(t))}`);
    } else {
        console.log("No post with #hashtag in content found for spot-check.");
    }

    await mongoose.disconnect();
    console.log("\nDone.");
}

main().catch(async (err) => {
    console.error(err);
    try {
        await mongoose.disconnect();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
