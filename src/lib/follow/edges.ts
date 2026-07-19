import { ObjectId } from "mongodb";
import { FollowModel } from "@/models/Follow";
import { UserModel } from "@/models/User";

function toObjectId(id: string | ObjectId): ObjectId {
  return typeof id === "string" ? new ObjectId(id) : id;
}

function toIdString(id: string | ObjectId): string {
  return id.toString();
}

/**
 * Upsert a follow edge. Idempotent under the unique (follower, following) index.
 */
export async function createFollowEdge(
  followerId: string | ObjectId,
  followingId: string | ObjectId,
  createdAt?: Date
): Promise<void> {
  const follower = toObjectId(followerId);
  const following = toObjectId(followingId);
  try {
    await FollowModel.updateOne(
      { follower, following },
      {
        $setOnInsert: {
          follower,
          following,
          createdAt: createdAt ?? new Date(),
        },
      },
      { upsert: true }
    );
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code !== 11000) throw err;
  }
}

export async function deleteFollowEdge(
  followerId: string | ObjectId,
  followingId: string | ObjectId
): Promise<void> {
  await FollowModel.deleteOne({
    follower: toObjectId(followerId),
    following: toObjectId(followingId),
  });
}

/**
 * True if follower follows following.
 * Checks Follow collection and User.following (dual-write merge).
 */
export async function viewerFollowsAuthor(
  followerId: string | null | undefined,
  followingId: string | ObjectId
): Promise<boolean> {
  if (!followerId) return false;
  const follower = toObjectId(followerId);
  const following = toObjectId(followingId);
  if (follower.equals(following)) return false;

  const edge = await FollowModel.exists({ follower, following });
  if (edge) return true;

  const me = (await UserModel.findById(follower)
    .select("following.user")
    .lean()) as { following?: { user?: ObjectId }[] } | null;

  return (me?.following ?? []).some(
    (f) => f.user && f.user.toString() === following.toString()
  );
}

/**
 * Following IDs for a user.
 * Merges Follow edges with User.following during dual-write.
 */
export async function getFollowingIds(
  userId: string | ObjectId
): Promise<ObjectId[]> {
  const follower = toObjectId(userId);
  const byId = new Map<string, ObjectId>();

  const edges = (await FollowModel.find({ follower })
    .select("following")
    .lean()) as unknown as { following: ObjectId }[];

  for (const e of edges) {
    if (e.following) byId.set(e.following.toString(), e.following);
  }

  const me = (await UserModel.findById(follower)
    .select("following.user")
    .lean()) as { following?: { user?: ObjectId }[] } | null;

  for (const f of me?.following ?? []) {
    if (f.user) byId.set(f.user.toString(), f.user);
  }

  return [...byId.values()];
}

/**
 * Follower IDs for a user.
 * Merges Follow edges with User.followers during dual-write.
 */
export async function getFollowerIds(
  userId: string | ObjectId
): Promise<ObjectId[]> {
  const following = toObjectId(userId);
  const byId = new Map<string, ObjectId>();

  const edges = (await FollowModel.find({ following })
    .select("follower")
    .lean()) as unknown as { follower: ObjectId }[];

  for (const e of edges) {
    if (e.follower) byId.set(e.follower.toString(), e.follower);
  }

  const user = (await UserModel.findById(following)
    .select("followers.user")
    .lean()) as { followers?: { user?: ObjectId }[] } | null;

  for (const f of user?.followers ?? []) {
    if (f.user) byId.set(f.user.toString(), f.user);
  }

  return [...byId.values()];
}

export type FollowEdgeRow = {
  userId: string;
  createdAt: Date;
};

/**
 * Paginate followers or following by createdAt desc, then userId.
 * Cursor is the previous page's last userId.
 */
export async function listFollowEdgePage(opts: {
  userId: string | ObjectId;
  relation: "followers" | "following";
  limit: number;
  cursor?: string | null;
}): Promise<{ entries: FollowEdgeRow[]; hasMore: boolean }> {
  const uid = toObjectId(opts.userId);
  const filter =
    opts.relation === "followers"
      ? { following: uid }
      : { follower: uid };

  let edges = (await FollowModel.find(filter)
    .select(
      opts.relation === "followers"
        ? "follower createdAt"
        : "following createdAt"
    )
    .sort({ createdAt: -1, _id: -1 })
    .lean()) as unknown as {
    follower?: ObjectId;
    following?: ObjectId;
    createdAt?: Date;
  }[];

  // Fallback to embedded arrays when Follow is empty but User still has data
  if (edges.length === 0) {
    const user = (await UserModel.findById(uid)
      .select(opts.relation === "followers" ? "followers" : "following")
      .lean()) as {
      followers?: { user?: ObjectId; createdAt?: Date }[];
      following?: { user?: ObjectId; createdAt?: Date }[];
    } | null;

    const arr =
      opts.relation === "followers"
        ? user?.followers ?? []
        : user?.following ?? [];

    const mapped: FollowEdgeRow[] = arr
      .filter((e) => e.user)
      .map((e) => ({
        userId: e.user!.toString(),
        createdAt: e.createdAt ? new Date(e.createdAt) : new Date(0),
      }))
      .sort((a, b) => {
        const dt = b.createdAt.getTime() - a.createdAt.getTime();
        if (dt !== 0) return dt;
        return b.userId.localeCompare(a.userId);
      });

    return paginateEntries(mapped, opts.limit, opts.cursor);
  }

  const mapped: FollowEdgeRow[] = edges.map((e) => ({
    userId: toIdString(
      opts.relation === "followers" ? e.follower! : e.following!
    ),
    createdAt: e.createdAt ? new Date(e.createdAt) : new Date(0),
  }));

  return paginateEntries(mapped, opts.limit, opts.cursor);
}

function paginateEntries(
  entries: FollowEdgeRow[],
  limit: number,
  cursor?: string | null
): { entries: FollowEdgeRow[]; hasMore: boolean } {
  let start = 0;
  if (cursor) {
    const idx = entries.findIndex((e) => e.userId === cursor);
    start = idx >= 0 ? idx + 1 : entries.length;
  }
  const page = entries.slice(start, start + limit + 1);
  const hasMore = page.length > limit;
  if (hasMore) page.pop();
  return { entries: page, hasMore };
}

/**
 * Account privacy using Follow edges (async).
 */
export async function canViewPrivateAuthorAsync(
  author: {
    _id: { toString(): string };
    isPrivate?: boolean;
  },
  viewerId: string | null
): Promise<boolean> {
  if (!author.isPrivate) return true;
  if (viewerId && author._id.toString() === viewerId) return true;
  return viewerFollowsAuthor(viewerId, author._id.toString());
}

/**
 * Friends-of-followers counts: users who follow any of `followingIds`.
 * Dedupes Follow edges + User.followers so dual-write never double-counts.
 */
export async function countFriendsOfFriends(
  followingIds: ObjectId[],
  exclude: Set<string>
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (followingIds.length === 0) return counts;

  const followeeSet = new Set(followingIds.map((id) => id.toString()));
  const pairs = new Set<string>();

  const edges = (await FollowModel.find({
    following: { $in: followingIds },
  })
    .select("follower following")
    .lean()) as unknown as { follower: ObjectId; following: ObjectId }[];

  for (const e of edges) {
    const follower = e.follower?.toString();
    const following = e.following?.toString();
    if (!follower || !following || exclude.has(follower)) continue;
    pairs.add(`${follower}:${following}`);
  }

  const followees = (await UserModel.find({ _id: { $in: followingIds } })
    .select("_id followers")
    .lean()) as {
    _id: ObjectId;
    followers?: { user?: ObjectId }[];
  }[];

  for (const u of followees) {
    const following = u._id.toString();
    if (!followeeSet.has(following)) continue;
    for (const f of u.followers ?? []) {
      const follower = f.user?.toString();
      if (!follower || exclude.has(follower)) continue;
      pairs.add(`${follower}:${following}`);
    }
  }

  for (const key of pairs) {
    const follower = key.split(":")[0];
    counts.set(follower, (counts.get(follower) ?? 0) + 1);
  }

  return counts;
}
