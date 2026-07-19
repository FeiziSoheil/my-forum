# Phase 3 — Recommendations scale infra

Shipped 2026-07-19. Builds on Phase 1 (For you + Who to follow) and Phase 2 (seen / not_interested).

## Locked decisions

| Item | Choice |
|------|--------|
| Follow graph | `Follow` `{ follower, following, createdAt }` + dual-write User arrays/counts |
| FoF / following reads | Prefer `Follow`; fall back to User arrays when unmigrated |
| Trending | Singleton `TrendingSnapshot` (`global_48h`) via `scripts/computeTrending.ts` |
| Popular people | `PopularSuggestion` rows from the same precompute job |
| Search | Mongo text index on `Post.content` + `$text` (regex fallback) |
| Redis / embeddings / Atlas / Meilisearch | Deferred |

## What shipped

1. **Compound + text indexes** on `Post` (feed/author/tags/trending/`$text`).
2. **Follow dual-write** on follow/unfollow/accept + **`npm run migrate:follows`** (`scripts/backfillFollows.ts`).
3. **Follow-first reads** in for-you, following feed, Who to follow; **FoF via Follow aggregate**.
4. **Trending + popular precompute** → `npm run precompute:recommendations`.
5. **`$text` search** for `GET /api/post?q=` with regex fallback.
6. **Smoke gate** Phase 1–3 (`npm run smoke:recommendations`, target ≥7/10).

## Ops

```bash
# One-time (or after large User-array history)
npm run migrate:follows

# Cron every 15–60m (also syncs indexes)
npm run precompute:recommendations

# Quality gate
npm run smoke:recommendations
```

## Deferred

- Dropping User.followers / following arrays
- Meilisearch / Atlas Search
- Redis caches, embeddings / ML ranking
- Per-user suggestion snapshots (FoF stays live; only global popular is precomputed)
