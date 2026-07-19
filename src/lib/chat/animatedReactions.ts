/**
 * Curated animated reactions (Google Noto Animated Emoji, Apache-2.0).
 * Only frequent reactions are animated — everything else stays Unicode.
 */
const ANIMATED_REACTION_SRC: Record<string, string> = {
  "❤️": "/reactions/heart.json",
  "❤": "/reactions/heart.json",
  "😂": "/reactions/joy.json",
  "😮": "/reactions/open_mouth.json",
  "😢": "/reactions/cry.json",
  "🙏": "/reactions/pray.json",
  "👍": "/reactions/thumbsup.json",
  "🔥": "/reactions/fire.json",
  "👏": "/reactions/clap.json",
};

const UNIQUE_SRCS = Array.from(new Set(Object.values(ANIMATED_REACTION_SRC)));

const animationCache = new Map<string, object>();

export function getAnimatedReactionSrc(emoji: string): string | null {
  if (ANIMATED_REACTION_SRC[emoji]) return ANIMATED_REACTION_SRC[emoji];
  const stripped = emoji.replace(/\uFE0F/g, "");
  return ANIMATED_REACTION_SRC[stripped] ?? null;
}

export function hasAnimatedReaction(emoji: string): boolean {
  return getAnimatedReactionSrc(emoji) !== null;
}

export async function loadAnimatedReactionData(
  src: string
): Promise<object> {
  const cached = animationCache.get(src);
  if (cached) return cached;

  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to load reaction animation: ${src}`);
  const data = (await res.json()) as object;
  animationCache.set(src, data);
  return data;
}

/** Warm cache for frequent reactions (e.g. when picker opens). */
export function prefetchAnimatedReactions() {
  if (typeof window === "undefined") return;
  for (const src of UNIQUE_SRCS) {
    if (animationCache.has(src)) continue;
    void loadAnimatedReactionData(src).catch(() => {
      /* ignore prefetch errors */
    });
  }
}
