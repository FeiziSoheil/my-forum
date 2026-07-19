/** Active @ or # token at the caret, matching extractor boundary rules. */

export type TriggerKind = "mention" | "tag";

export type ActiveTrigger = {
  kind: TriggerKind;
  /** Index of `@` or `#` */
  start: number;
  /** Text after the trigger up to the caret */
  query: string;
  /** Caret index (exclusive end of partial token) */
  end: number;
};

const MENTION_QUERY_RE = /^[a-zA-Z0-9_]*$/;
const TAG_QUERY_RE = /^[\p{L}\p{N}_]*$/u;

/**
 * Detect an in-progress `@mention` or `#tag` at `caret`.
 * Same boundaries as extractors: trigger only after start-of-string or whitespace.
 * Does not open mid-word (e.g. `email@x` or `foo#bar`).
 */
export function detectActiveTrigger(
  text: string,
  caret: number
): ActiveTrigger | null {
  if (caret < 0 || caret > text.length) return null;

  const before = text.slice(0, caret);

  for (let i = before.length - 1; i >= 0; i--) {
    const ch = before[i];

    if (/\s/.test(ch)) return null;

    if (ch === "@" || ch === "#") {
      const atBoundary = i === 0 || /\s/.test(before[i - 1]!);
      if (!atBoundary) return null;

      const query = before.slice(i + 1);

      if (ch === "@") {
        if (!MENTION_QUERY_RE.test(query)) return null;
        return { kind: "mention", start: i, query, end: caret };
      }

      if (!TAG_QUERY_RE.test(query)) return null;
      return { kind: "tag", start: i, query, end: caret };
    }
  }

  return null;
}

/** Replace the partial `@…` / `#…` token with `token` (+ trailing space if needed). */
export function applyTriggerInsertion(
  text: string,
  trigger: ActiveTrigger,
  token: string
): { text: string; caret: number } {
  const before = text.slice(0, trigger.start);
  const after = text.slice(trigger.end);
  const needsSpace = after.length === 0 || !/^\s/.test(after);
  const inserted = token + (needsSpace ? " " : "");
  const next = before + inserted + after;
  return { text: next, caret: before.length + inserted.length };
}
