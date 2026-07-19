import { canViewPrivateAuthorAsync } from "@/lib/auth/session";
import { UserModel } from "@/models/User";

/**
 * Account-level privacy gate for a single story. A private account's stories
 * are only visible to the owner and existing followers. Returns true when the
 * viewer is allowed to see (and interact with) the story's author content.
 */
export async function canViewStoryAuthor(
  authorId: string,
  viewerId: string | null
): Promise<boolean> {
  const author = (await UserModel.findById(authorId)
    .select("isPrivate")
    .lean()) as
    | { _id: { toString(): string }; isPrivate?: boolean }
    | null;
  if (!author) return false;
  return canViewPrivateAuthorAsync(author, viewerId);
}
