/** `#tag` after start-of-string or whitespace; Unicode letters/numbers + `_`. */
export const HASHTAG_RE = /(?<=^|\s)#([\p{L}\p{N}_]+)/gu;

/** Extract unique lowercase tags without `#` (order preserved). */
export function extractHashtags(content: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const match of content.matchAll(HASHTAG_RE)) {
    const tag = match[1]?.toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}
