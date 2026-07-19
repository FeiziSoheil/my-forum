import { UserModel } from "@/models/User";
import {
  extractMentionMatches,
  extractMentionUsernames,
} from "@/lib/mentions/extractMentions";

export type ResolvedMention = {
  user: string;
  position: number;
};

export { extractMentionUsernames, extractMentionMatches };

/**
 * Resolve usernames to user ids + content positions.
 * Skips unknown usernames. Dedupes by user id.
 */
export async function resolveMentions(
  usernames: string[],
  content: string
): Promise<ResolvedMention[]> {
  const matches = extractMentionMatches(content);
  const positionByLower = new Map(
    matches.map((m) => [m.username.toLowerCase(), m.position])
  );

  const unique = [
    ...new Map(
      usernames
        .map((u) => u.trim())
        .filter(Boolean)
        .map((u) => [u.toLowerCase(), u] as const)
    ).values(),
  ];

  if (unique.length === 0) return [];

  const users = await UserModel.find({
    username: { $in: unique },
  })
    .select("_id username")
    .lean();

  const byLower = new Map(
    users.map((u) => [String(u.username).toLowerCase(), u])
  );

  const resolved: ResolvedMention[] = [];
  const seenIds = new Set<string>();

  for (const name of unique) {
    const user = byLower.get(name.toLowerCase());
    if (!user) continue;
    const id = String(user._id);
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    resolved.push({
      user: id,
      position:
        positionByLower.get(String(user.username).toLowerCase()) ??
        positionByLower.get(name.toLowerCase()) ??
        content.indexOf(`@${user.username}`),
    });
  }

  return resolved;
}

/** Resolve @handles found in content only (form fields ignored). */
export async function resolveMentionsFromContent(
  content: string
): Promise<ResolvedMention[]> {
  return resolveMentions(extractMentionUsernames(content), content);
}

/**
 * @deprecated Prefer resolveMentionsFromContent — form mention fields are ignored.
 * Kept for call-site compatibility.
 */
export async function resolveMentionsFromInput(
  content: string,
  _formMentions?: string | null
): Promise<ResolvedMention[]> {
  return resolveMentionsFromContent(content);
}
