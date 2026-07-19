import { canViewPrivateAuthorAsync, getOptionalUserId } from "@/lib/auth/session";
import {
  getFollowingIds,
  listFollowEdgePage,
} from "@/lib/follow/edges";
import { UserModel } from "@/models/User";
import { NextRequest } from "next/server";

export type FollowListUser = {
  _id: string;
  username: string;
  fullname: string;
  avatar?: string;
  isFollowing: boolean;
};

export async function listFollowUsers(
  req: NextRequest,
  username: string,
  relation: "followers" | "following"
): Promise<
  | { status: 404; body: { error: string } }
  | {
      status: 200;
      body: {
        users: FollowListUser[];
        hasMore: boolean;
        nextCursor?: string;
        locked?: boolean;
      };
    }
> {
  const MAX_LIMIT = 50;
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") || "20", 10) || 20,
    MAX_LIMIT
  );
  const cursor = req.nextUrl.searchParams.get("cursor");

  const target = await UserModel.findOne({ username })
    .select("isPrivate")
    .lean();

  if (!target) {
    return { status: 404, body: { error: "User not found." } };
  }

  const t = target as unknown as {
    _id: { toString(): string };
    isPrivate?: boolean;
  };

  const viewerId = await getOptionalUserId(req);

  if (!(await canViewPrivateAuthorAsync(t, viewerId))) {
    return {
      status: 200,
      body: { users: [], hasMore: false, locked: true },
    };
  }

  const { entries, hasMore } = await listFollowEdgePage({
    userId: t._id.toString(),
    relation,
    limit,
    cursor,
  });

  const ids = entries.map((e) => e.userId);
  if (ids.length === 0) {
    return {
      status: 200,
      body: { users: [], hasMore: false },
    };
  }

  let viewerFollowingIds = new Set<string>();
  if (viewerId) {
    const following = await getFollowingIds(viewerId);
    viewerFollowingIds = new Set(following.map((id) => id.toString()));
  }

  const populated = await UserModel.find({ _id: { $in: ids } })
    .select("username fullname avatar")
    .lean();

  const byId = new Map(
    populated.map((u) => {
      const row = u as unknown as {
        _id: { toString(): string };
        username: string;
        fullname: string;
        avatar?: string;
      };
      return [row._id.toString(), row];
    })
  );

  const users: FollowListUser[] = [];
  for (const id of ids) {
    const u = byId.get(id);
    if (!u) continue;
    users.push({
      _id: id,
      username: u.username,
      fullname: u.fullname,
      avatar: u.avatar,
      isFollowing: !!viewerId && viewerId !== id && viewerFollowingIds.has(id),
    });
  }

  const nextCursor =
    hasMore && users.length > 0 ? users[users.length - 1]._id : undefined;

  return {
    status: 200,
    body: {
      users,
      hasMore,
      nextCursor,
    },
  };
}
