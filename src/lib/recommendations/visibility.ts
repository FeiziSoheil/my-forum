import { ObjectId } from "mongodb";
import { UserModel } from "@/models/User";

/**
 * Mongo clause restricting which posts a viewer is allowed to read.
 * - public: everyone
 * - followers: the author, or viewers who follow the author
 * - private: only the author
 */
export function visibilityClause(
  userId: string | null,
  followingIds: (string | ObjectId)[]
): Record<string, unknown> {
  if (!userId) return { visibility: "public" };
  return {
    $or: [
      { visibility: "public" },
      { visibility: "followers", author: { $in: [...followingIds, userId] } },
      { visibility: "private", author: userId },
    ],
  };
}

/**
 * Account-level privacy: IDs of private authors the viewer may not see.
 */
export async function getBlockedPrivateAuthorIds(
  userId: string | null,
  followingIds: ObjectId[]
): Promise<ObjectId[]> {
  const allowedAuthorIds = new Set<string>(
    followingIds.map((id) => id.toString())
  );
  if (userId) allowedAuthorIds.add(userId);

  const privateAuthors = (await UserModel.find({ isPrivate: true })
    .select("_id")
    .lean()) as unknown as { _id: ObjectId }[];

  return privateAuthors
    .map((u) => u._id)
    .filter((id) => !allowedAuthorIds.has(id.toString()));
}
