/** `@username` after start-of-string or whitespace; ASCII usernames only. */
export const MENTION_RE = /(?<=^|\s)@([a-zA-Z0-9_]+)/g;

export type MentionMatch = {
  username: string;
  position: number;
};

/** Extract unique @usernames with positions (order preserved). */
export function extractMentionMatches(content: string): MentionMatch[] {
  const seen = new Set<string>();
  const matches: MentionMatch[] = [];
  for (const match of content.matchAll(MENTION_RE)) {
    const name = match[1];
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({ username: name, position: match.index ?? 0 });
  }
  return matches;
}

/** Extract unique @usernames from free text (order preserved). */
export function extractMentionUsernames(content: string): string[] {
  return extractMentionMatches(content).map((m) => m.username);
}
