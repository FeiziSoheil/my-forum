/** Resolve parent reply id whether `parentReply` is an id string or populated object. */
export function getParentReplyId(
  parentReply: string | { _id: unknown } | null | undefined
): string | null {
  if (!parentReply) return null;
  if (typeof parentReply === 'string') return parentReply;
  const id = parentReply._id;
  return id == null ? null : String(id);
}

type Threadable = {
  _id: unknown;
  parentReply?: string | { _id: unknown } | null;
};

/**
 * Flatten replies into Reddit-style thread order: each parent, then its children (by _id), recursively.
 * Replies whose parent is missing from the set are treated as roots (keeps orphans visible).
 */
export function orderRepliesThreaded<T extends Threadable>(replies: T[]): T[] {
  if (replies.length <= 1) return replies;

  const idOf = (r: T) => String(r._id);
  const ids = new Set(replies.map(idOf));
  const children = new Map<string | null, T[]>();

  for (const reply of replies) {
    const rawParent = getParentReplyId(reply.parentReply);
    const key = rawParent && ids.has(rawParent) ? rawParent : null;
    const list = children.get(key);
    if (list) list.push(reply);
    else children.set(key, [reply]);
  }

  for (const list of children.values()) {
    list.sort((a, b) => (idOf(a) < idOf(b) ? -1 : idOf(a) > idOf(b) ? 1 : 0));
  }

  const ordered: T[] = [];
  const walk = (parentId: string | null) => {
    const list = children.get(parentId);
    if (!list) return;
    for (const reply of list) {
      ordered.push(reply);
      walk(idOf(reply));
    }
  };
  walk(null);
  return ordered;
}
