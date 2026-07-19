import { ObjectId } from "mongodb";
import { BookmarkModel } from "@/models/Bookmark";
import { PostModel } from "@/models/Post";
import { PostViewModel } from "@/models/PostView";

const AFFINITY_SAMPLE = 50;
const AFFINITY_TAG_LIMIT = 8;
/** Like/bookmark tag weight vs view tag weight. */
const STRONG_TAG_WEIGHT = 1;
const VIEW_TAG_WEIGHT = 0.5;

export type AffinityProfile = {
  tags: string[];
};

function addTags(
  counts: Map<string, number>,
  tags: string[] | undefined,
  weight: number
) {
  for (const tag of tags ?? []) {
    const key = tag.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + weight);
  }
}

/**
 * Top tags from likes + bookmarks (strong) and recent views (weaker).
 */
export async function getUserAffinityProfile(
  userId: string
): Promise<AffinityProfile> {
  const uid = new ObjectId(userId);

  const likedPosts = (await PostModel.find({
    "likes.user": uid,
    isDeleted: { $ne: true },
  })
    .select("tags")
    .sort({ updatedAt: -1 })
    .limit(AFFINITY_SAMPLE)
    .lean()) as unknown as { tags?: string[] }[];

  const bookmarks = (await BookmarkModel.find({ user: uid })
    .select("post")
    .sort({ _id: -1 })
    .limit(AFFINITY_SAMPLE)
    .lean()) as unknown as { post: ObjectId }[];

  const views = (await PostViewModel.find({ user: uid })
    .select("post")
    .sort({ viewedAt: -1 })
    .limit(AFFINITY_SAMPLE)
    .lean()) as unknown as { post: ObjectId }[];

  const bookmarkIds = bookmarks.map((b) => b.post);
  const viewIds = views.map((v) => v.post);
  const idSet = new Set<string>();
  for (const id of [...bookmarkIds, ...viewIds]) {
    idSet.add(id.toString());
  }
  const relatedIds = [...idSet].map((id) => new ObjectId(id));

  const relatedPosts =
    relatedIds.length > 0
      ? ((await PostModel.find({
          _id: { $in: relatedIds },
          isDeleted: { $ne: true },
        })
          .select("_id tags")
          .lean()) as unknown as { _id: ObjectId; tags?: string[] }[])
      : [];

  const byId = new Map(relatedPosts.map((p) => [p._id.toString(), p]));
  const counts = new Map<string, number>();

  for (const post of likedPosts) {
    addTags(counts, post.tags, STRONG_TAG_WEIGHT);
  }

  for (const id of bookmarkIds) {
    addTags(counts, byId.get(id.toString())?.tags, STRONG_TAG_WEIGHT);
  }

  for (const id of viewIds) {
    addTags(counts, byId.get(id.toString())?.tags, VIEW_TAG_WEIGHT);
  }

  const tags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, AFFINITY_TAG_LIMIT)
    .map(([tag]) => tag);

  return { tags };
}

/** Back-compat alias. */
export async function getAffinityTags(userId: string): Promise<string[]> {
  const profile = await getUserAffinityProfile(userId);
  return profile.tags;
}
