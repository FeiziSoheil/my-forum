import { getParentReplyId } from '@/lib/replies/threadOrder';
import type { Reply } from '@/types/post';

export type ReplyNode = {
  reply: Reply;
  children: ReplyNode[];
};

/**
 * Build a forest from a flat (optionally multi-page) reply list.
 * Preserves encounter order for siblings. Orphans whose parent is missing
 * become roots so paginated pages stay self-contained.
 */
export function buildReplyForest(replies: Reply[]): ReplyNode[] {
  if (replies.length === 0) return [];

  const byId = new Map<string, ReplyNode>();
  for (const reply of replies) {
    if (byId.has(reply._id)) continue;
    byId.set(reply._id, { reply, children: [] });
  }

  const roots: ReplyNode[] = [];
  const attached = new Set<string>();

  for (const reply of replies) {
    if (attached.has(reply._id)) continue;
    attached.add(reply._id);

    const node = byId.get(reply._id);
    if (!node) continue;

    const parentId = getParentReplyId(reply.parentReply);
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Flatten paginated infinite-query pages into a deduped reply list. */
export function flattenReplyPages(
  pages: Array<{ replies: Reply[] }> | undefined
): Reply[] {
  if (!pages?.length) return [];
  const seen = new Set<string>();
  const list: Reply[] = [];
  for (const page of pages) {
    for (const reply of page.replies) {
      if (seen.has(reply._id)) continue;
      seen.add(reply._id);
      list.push(reply);
    }
  }
  return list;
}
