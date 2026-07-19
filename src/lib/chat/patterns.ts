/**
 * Telegram-style doodle tiles for ready-made chat packs.
 * Colored SVG data-URIs used as repeating background-image (mask-free).
 */

function svgToDataUrl(svg: string): string {
  // Prefer base64 — more reliable than encodeURIComponent in CSS url()/React styles
  const cleaned = svg.trim().replace(/\s+/g, " ");
  if (typeof btoa === "function") {
    const base64 = btoa(unescape(encodeURIComponent(cleaned)));
    return `url("data:image/svg+xml;base64,${base64}")`;
  }
  return `url("data:image/svg+xml,${encodeURIComponent(cleaned)}")`;
}

function tile(
  color: string,
  body: string,
  size = 200
): string {
  return svgToDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="${color}" stroke="${color}">${body}</svg>`
  );
}

type PatternBuilder = (color: string) => string;

const builders: Record<string, PatternBuilder> = {
  default: (c) =>
    tile(
      c,
      `<circle cx="28" cy="36" r="2.4" stroke="none"/>
      <circle cx="168" cy="52" r="2" stroke="none"/>
      <circle cx="92" cy="168" r="2.2" stroke="none"/>
      <circle cx="142" cy="128" r="1.7" stroke="none"/>
      <path d="M36 58c0-10 8-18 18-18h22c10 0 18 8 18 18v10c0 10-8 18-18 18H48l-12 10V58z" fill="none" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M118 96c0-8 6.5-14.5 14.5-14.5h16c8 0 14.5 6.5 14.5 14.5v7c0 8-6.5 14.5-14.5 14.5h-10l-9 8V96z" fill="none" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M64 132l2.4 7 7.2.2-5.7 4.4 2 7-5.9-4-5.9 4 2-7-5.7-4.4 7.2-.2z" stroke="none"/>
      <path d="M156 34l1.6 4.6 4.8.1-3.8 2.9 1.3 4.6-3.9-2.7-3.9 2.7 1.3-4.6-3.8-2.9 4.8-.1z" stroke="none"/>
      <circle cx="52" cy="96" r="1.6" stroke="none"/>
      <circle cx="178" cy="148" r="2.2" stroke="none"/>
      <path d="M24 148c7-2 12 3 10 9" fill="none" stroke-width="2" stroke-linecap="round"/>
      <path d="M108 42c5.5-3 11 1 10 6.5" fill="none" stroke-width="1.8" stroke-linecap="round"/>`
    ),

  ocean: (c) =>
    tile(
      c,
      `<path d="M16 48c18 10 36-10 54 0s36-10 54 0 36-10 54 0" fill="none" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M8 88c18 10 36-10 54 0s36-10 54 0 36-10 54 0 18-5 30 2" fill="none" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M20 148c18 10 36-10 54 0s36-10 54 0 36-10 54 0" fill="none" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="46" cy="118" r="2.3" stroke="none"/>
      <circle cx="132" cy="64" r="1.8" stroke="none"/>
      <circle cx="168" cy="124" r="2.4" stroke="none"/>
      <path d="M78 116c9-7 20-2 18 9-7 2-13 2-18-9z" stroke="none"/>
      <path d="M150 168c7-4.5 14-1 13 7-4.5 1.7-10 1.7-13-7z" stroke="none"/>
      <path d="M58 28c0 6.5 9 6.5 9 0s-4-11-4.5-15c-.5 4-4.5 8.5-4.5 15z" stroke="none"/>
      <path d="M112 176c0 5.5 7 5.5 7 0s-3.2-9-3.4-12.5c-.4 3.5-3.6 7-3.6 12.5z" stroke="none"/>`
    ),

  forest: (c) =>
    tile(
      c,
      `<path d="M42 86l18-34 18 34h-10v22H52V86z" stroke="none"/>
      <path d="M118 58l14-26 14 26h-8v18h-12V58z" stroke="none"/>
      <path d="M156 128l16-30 16 30h-9v20h-14v-20z" stroke="none"/>
      <path d="M28 148c8-14 24-14 32 0-10 2-22 2-32 0z" stroke="none"/>
      <path d="M86 152c6-10 18-10 24 0-8 1.5-16 1.5-24 0z" stroke="none"/>
      <circle cx="72" cy="40" r="2.2" stroke="none"/>
      <circle cx="168" cy="48" r="1.8" stroke="none"/>
      <circle cx="24" cy="64" r="1.6" stroke="none"/>
      <path d="M64 116c11-4 15 7 6.5 13" fill="none" stroke-width="2" stroke-linecap="round"/>
      <path d="M140 96c9-3 13 5.5 5.5 11" fill="none" stroke-width="2" stroke-linecap="round"/>
      <circle cx="188" cy="168" r="2.2" stroke="none"/>
      <circle cx="98" cy="28" r="1.7" stroke="none"/>`
    ),

  sunset: (c) =>
    tile(
      c,
      `<circle cx="100" cy="78" r="17" fill="none" stroke-width="2.4"/>
      <path d="M100 40v-12M100 128v-12M62 78H50M150 78h-12M72 50l-9-9M136 106l-9-9M72 106l-9 9M136 50l-9 9" fill="none" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M20 148c22-16 44 8 66-4s40 12 64-6 30 4 50 10" fill="none" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M12 168c26-12 48 6 72-2s42 10 66-4" fill="none" stroke-width="2" stroke-linecap="round"/>
      <circle cx="36" cy="44" r="2" stroke="none"/>
      <circle cx="168" cy="36" r="2.2" stroke="none"/>
      <circle cx="156" cy="128" r="1.7" stroke="none"/>
      <circle cx="48" cy="116" r="1.6" stroke="none"/>`
    ),

  midnight: (c) =>
    tile(
      c,
      `<path d="M48 40l2.6 7.8 8.2.2-6.5 5 2.3 7.9-6.6-4.6-6.6 4.6 2.3-7.9-6.5-5 8.2-.2z" stroke="none"/>
      <path d="M148 56l1.8 5.2 5.4.1-4.3 3.4 1.5 5.2-4.4-3-4.4 3 1.5-5.2-4.3-3.4 5.4-.1z" stroke="none"/>
      <path d="M96 128l2.2 6.5 6.8.2-5.4 4.2 1.9 6.5-5.5-3.8-5.5 3.8 1.9-6.5-5.4-4.2 6.8-.2z" stroke="none"/>
      <path d="M168 148c-11 2-17.5-9-13-17.5 11 2 19.5 9 13 17.5z" stroke="none"/>
      <path d="M40 156c-8.5 1.6-13-6.5-9.5-13 8.5 1.6 15 6.5 9.5 13z" stroke="none"/>
      <circle cx="72" cy="88" r="1.7" stroke="none"/>
      <circle cx="124" cy="40" r="1.5" stroke="none"/>
      <circle cx="28" cy="100" r="2.2" stroke="none"/>
      <circle cx="180" cy="88" r="1.8" stroke="none"/>
      <circle cx="112" cy="172" r="1.6" stroke="none"/>
      <path d="M84 64l1.4 4 4.2.1-3.3 2.5 1.1 4-3.4-2.3-3.4 2.3 1.1-4-3.3-2.5 4.2-.1z" stroke="none"/>
      <circle cx="156" cy="108" r="1.4" stroke="none"/>`
    ),

  rose: (c) =>
    tile(
      c,
      `<path d="M52 52c8.5-11 26-11 26 4.5 0 15-13 26-26 36.5-13-10.5-26-21.5-26-36.5 0-15.5 17.5-15.5 26-4.5z" stroke="none"/>
      <path d="M138 44c6.5-8.5 19.5-8.5 19.5 3.5 0 12-10 19.5-19.5 28-9.5-8.5-19.5-16-19.5-28 0-12 13-12 19.5-3.5z" stroke="none"/>
      <path d="M108 128c7.5-10 21.5-10 21.5 4 0 13.5-11 22.5-21.5 31-10.5-8.5-21.5-17.5-21.5-31 0-14 14-14 21.5-4z" stroke="none"/>
      <circle cx="32" cy="112" r="2" stroke="none"/>
      <circle cx="176" cy="96" r="2.2" stroke="none"/>
      <circle cx="72" cy="168" r="1.7" stroke="none"/>
      <circle cx="160" cy="160" r="1.8" stroke="none"/>
      <path d="M76 96c9-2 13 6.5 6.5 12" fill="none" stroke-width="2" stroke-linecap="round"/>
      <path d="M156 120c7.5-2 12 5.5 5.5 11" fill="none" stroke-width="2" stroke-linecap="round"/>
      <circle cx="120" cy="72" r="1.5" stroke="none"/>
      <path d="M40 148c0 5.5 7.5 5.5 7.5 0s-3.5-10-3.8-13c-.3 3-3.7 7.5-3.7 13z" stroke="none"/>`
    ),

  graphite: (c) =>
    tile(
      c,
      `<circle cx="32" cy="40" r="2.8" stroke="none"/>
      <circle cx="72" cy="36" r="1.7" stroke="none"/>
      <circle cx="112" cy="44" r="2.2" stroke="none"/>
      <circle cx="156" cy="32" r="1.6" stroke="none"/>
      <rect x="40" y="72" width="24" height="24" rx="5.5" fill="none" stroke-width="2.2"/>
      <rect x="128" y="88" width="18" height="18" rx="4.5" fill="none" stroke-width="2"/>
      <path d="M24 128h42M88 120h50M152 140h30" fill="none" stroke-width="2" stroke-linecap="round"/>
      <circle cx="64" cy="156" r="2.2" stroke="none"/>
      <circle cx="108" cy="164" r="1.7" stroke="none"/>
      <circle cx="168" cy="168" r="2.4" stroke="none"/>
      <circle cx="180" cy="72" r="1.8" stroke="none"/>
      <path d="M96 76l13 13M109 76l-13 13" fill="none" stroke-width="2" stroke-linecap="round"/>
      <circle cx="28" cy="88" r="1.5" stroke="none"/>`
    ),

  amber: (c) =>
    tile(
      c,
      `<path d="M48 40l11 6.5v13L48 66l-11-6.5v-13z" fill="none" stroke-width="2.2"/>
      <path d="M120 56l13 7.5v15l-13 7.5-13-7.5v-15z" fill="none" stroke-width="2"/>
      <path d="M156 120l11 6.5v13l-11 6.5-11-6.5v-13z" fill="none" stroke-width="2"/>
      <path d="M36 124l15 8.5v17L36 158l-15-8.5v-17z" fill="none" stroke-width="2.2"/>
      <circle cx="88" cy="108" r="2.2" stroke="none"/>
      <circle cx="176" cy="48" r="2" stroke="none"/>
      <circle cx="72" cy="168" r="2.4" stroke="none"/>
      <circle cx="140" cy="168" r="1.7" stroke="none"/>
      <path d="M96 36c9-1 13 7.5 6.5 13" fill="none" stroke-width="2" stroke-linecap="round"/>
      <path d="M168 88c7.5-1 12 6.5 5.5 12" fill="none" stroke-width="2" stroke-linecap="round"/>
      <circle cx="108" cy="148" r="1.6" stroke="none"/>
      <circle cx="24" cy="72" r="1.8" stroke="none"/>`
    ),
};

const DEFAULT_PATTERN_COLOR = "#78716c";

export function getChatPatternImage(
  themeId: string,
  color?: string | null
): string {
  const build = builders[themeId] ?? builders.default;
  return build(color || DEFAULT_PATTERN_COLOR);
}

/** @deprecated alias — packs map used by older callers */
export const chatPatternImages: Record<string, string> = Object.fromEntries(
  Object.keys(builders).map((id) => [id, getChatPatternImage(id)])
);
