/**
 * Escaped regex clause for content substring search (legacy fallback).
 */
export function contentRegexClause(q: string): Record<string, unknown> {
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { content: { $regex: escaped, $options: "i" } };
}

/**
 * Prefer Mongo `$text` when a text index exists; otherwise regex.
 * Callers should treat the returned `useTextScore` flag for optional sort.
 */
export function contentSearchClause(q: string): {
  filter: Record<string, unknown>;
  useTextScore: boolean;
} {
  const trimmed = q.trim();
  if (!trimmed) {
    return { filter: {}, useTextScore: false };
  }
  // `$text` needs tokenizable input; very short queries work better as regex.
  if (trimmed.length < 2) {
    return { filter: contentRegexClause(trimmed), useTextScore: false };
  }
  return {
    filter: { $text: { $search: trimmed } },
    useTextScore: true,
  };
}
