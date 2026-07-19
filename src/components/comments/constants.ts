/** Collapse children when a parent has more than this many direct replies. */
export const COLLAPSE_REPLIES_THRESHOLD = 3;

/** Max visible indent steps (L1=0, L2=1, L3=2). Deeper keeps line, no further indent. */
export const MAX_VISIBLE_INDENT_DEPTH = 2;

/** Desktop indent per nest step (px). Mobile uses ~75% via CSS. */
export const THREAD_INDENT_PX = 32;

/** Avatar sizes by depth (0 = top-level comment). */
export const AVATAR_SIZE = {
  root: 40,
  nested: 32,
} as const;
