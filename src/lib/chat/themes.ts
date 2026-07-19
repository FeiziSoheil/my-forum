import type { CSSProperties } from "react";
import { getChatPatternImage } from "@/lib/chat/patterns";
import {
  CHAT_WALLPAPER_BLUR_DEFAULT,
  CHAT_WALLPAPER_DIM_DEFAULT,
  clampWallpaperBlur,
  clampWallpaperDim,
} from "@/lib/chat/wallpaper";

export const CHAT_THEME_STORAGE_PREFIX = "parakgram-chat-theme:";
export const DEFAULT_CHAT_THEME_ID = "default";

export type ChatThemePrefs = {
  themeId: string;
  blur: number;
  dim: number;
  hasWallpaper: boolean;
  /** User customized after a shared theme was applied — ignore shared until cleared. */
  detached: boolean;
};

export type ChatThemePack = {
  id: string;
  name: string;
  description: string;
  /** Preview swatches for the picker grid */
  preview: {
    surface: string;
    mine: string;
    theirs: string;
  };
  /**
   * CSS custom properties applied to the chat shell.
   * Null = inherit app tokens. When surfaceBase is set, chrome tokens
   * remap --foreground / --primary so header + composer stay readable
   * even if the app theme is the opposite polarity.
   */
  vars: {
    mineBg: string | null;
    mineFg: string | null;
    theirsBg: string | null;
    theirsFg: string | null;
    accent: string | null;
    surfaceBase: string | null;
    surfaceGlow: string | null;
    /** Doodle pattern tint (Telegram-style tile) */
    patternColor: string | null;
    patternOpacity: number | null;
    patternSize: string | null;
    /** Header / composer text */
    chromeFg: string | null;
    chromeMuted: string | null;
    chromeMutedBg: string | null;
    chromeBorder: string | null;
    chromePrimaryFg: string | null;
  };
};

const lightChrome = {
  chromeFg: "#1c1917",
  chromeMuted: "#78716c",
  chromeMutedBg: "color-mix(in oklab, #1c1917 8%, transparent)",
  chromeBorder: "color-mix(in oklab, #1c1917 12%, transparent)",
  chromePrimaryFg: "#ffffff",
} as const;

const darkChrome = {
  chromeFg: "#f1f5f9",
  chromeMuted: "#94a3b8",
  chromeMutedBg: "color-mix(in oklab, #f1f5f9 10%, transparent)",
  chromeBorder: "color-mix(in oklab, #f1f5f9 14%, transparent)",
  chromePrimaryFg: "#0b1220",
} as const;

export const chatThemePacks: ChatThemePack[] = [
  {
    id: "default",
    name: "Default",
    description: "Matches your app theme",
    preview: {
      surface: "var(--background)",
      mine: "var(--primary)",
      theirs: "var(--muted)",
    },
    vars: {
      mineBg: null,
      mineFg: null,
      theirsBg: null,
      theirsFg: null,
      accent: null,
      surfaceBase: null,
      surfaceGlow: null,
      patternColor: null,
      patternOpacity: 0.14,
      patternSize: "168px",
      chromeFg: null,
      chromeMuted: null,
      chromeMutedBg: null,
      chromeBorder: null,
      chromePrimaryFg: null,
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Calm teal bubbles on a soft sky surface",
    preview: {
      surface: "#e8f4f8",
      mine: "#0d9488",
      theirs: "#d0e8f0",
    },
    vars: {
      mineBg: "#0d9488",
      mineFg: "#f0fdfa",
      theirsBg: "#d0e8f0",
      theirsFg: "#134e4a",
      accent: "#0f766e",
      surfaceBase: "#eef7fa",
      surfaceGlow: "color-mix(in oklab, #5eead4 28%, transparent)",
      patternColor: "#0f766e",
      patternOpacity: 0.18,
      patternSize: "168px",
      ...lightChrome,
    },
  },
  {
    id: "forest",
    name: "Forest",
    description: "Leafy greens with a misty backdrop",
    preview: {
      surface: "#eef6f0",
      mine: "#15803d",
      theirs: "#d8ebe0",
    },
    vars: {
      mineBg: "#15803d",
      mineFg: "#f0fdf4",
      theirsBg: "#d8ebe0",
      theirsFg: "#14532d",
      accent: "#166534",
      surfaceBase: "#f1f7f3",
      surfaceGlow: "color-mix(in oklab, #86efac 30%, transparent)",
      patternColor: "#166534",
      patternOpacity: 0.18,
      patternSize: "168px",
      ...lightChrome,
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm coral bubbles and a peach glow",
    preview: {
      surface: "#fff4ec",
      mine: "#ea580c",
      theirs: "#fde4d4",
    },
    vars: {
      mineBg: "#ea580c",
      mineFg: "#fff7ed",
      theirsBg: "#fde4d4",
      theirsFg: "#7c2d12",
      accent: "#c2410c",
      surfaceBase: "#fff6f0",
      surfaceGlow: "color-mix(in oklab, #fdba74 32%, transparent)",
      patternColor: "#c2410c",
      patternOpacity: 0.18,
      patternSize: "168px",
      ...lightChrome,
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep indigo chat for low light",
    preview: {
      surface: "#0f172a",
      mine: "#3b82f6",
      theirs: "#1e293b",
    },
    vars: {
      mineBg: "#2563eb",
      mineFg: "#eff6ff",
      theirsBg: "#1e293b",
      theirsFg: "#e2e8f0",
      accent: "#60a5fa",
      surfaceBase: "#0b1220",
      surfaceGlow: "color-mix(in oklab, #1d4ed8 35%, transparent)",
      patternColor: "#93c5fd",
      patternOpacity: 0.2,
      patternSize: "168px",
      ...darkChrome,
    },
  },
  {
    id: "rose",
    name: "Rose",
    description: "Soft blush tones for a gentle feel",
    preview: {
      surface: "#fff1f4",
      mine: "#e11d48",
      theirs: "#fce7ec",
    },
    vars: {
      mineBg: "#e11d48",
      mineFg: "#fff1f2",
      theirsBg: "#fce7ec",
      theirsFg: "#881337",
      accent: "#be123c",
      surfaceBase: "#fff5f7",
      surfaceGlow: "color-mix(in oklab, #fb7185 26%, transparent)",
      patternColor: "#be123c",
      patternOpacity: 0.18,
      patternSize: "168px",
      ...lightChrome,
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Neutral slate bubbles, clean and quiet",
    preview: {
      surface: "#f4f4f5",
      mine: "#3f3f46",
      theirs: "#e4e4e7",
    },
    vars: {
      mineBg: "#3f3f46",
      mineFg: "#fafafa",
      theirsBg: "#e4e4e7",
      theirsFg: "#18181b",
      accent: "#52525b",
      surfaceBase: "#fafafa",
      surfaceGlow: "color-mix(in oklab, #a1a1aa 22%, transparent)",
      patternColor: "#52525b",
      patternOpacity: 0.16,
      patternSize: "168px",
      ...lightChrome,
    },
  },
  {
    id: "amber",
    name: "Amber",
    description: "Honey accents on a warm paper surface",
    preview: {
      surface: "#fffbeb",
      mine: "#d97706",
      theirs: "#fef3c7",
    },
    vars: {
      mineBg: "#d97706",
      mineFg: "#fffbeb",
      theirsBg: "#fef3c7",
      theirsFg: "#78350f",
      accent: "#b45309",
      surfaceBase: "#fffdf5",
      surfaceGlow: "color-mix(in oklab, #fbbf24 28%, transparent)",
      patternColor: "#b45309",
      patternOpacity: 0.18,
      patternSize: "168px",
      ...lightChrome,
    },
  },
];

const packById = new Map(chatThemePacks.map((p) => [p.id, p]));

export function getChatThemePack(id: string | null | undefined): ChatThemePack {
  if (!id) return chatThemePacks[0];
  return packById.get(id) ?? chatThemePacks[0];
}

export function isChatThemeId(id: string): boolean {
  return packById.has(id);
}

export function chatThemeStorageKey(conversationId: string) {
  return `${CHAT_THEME_STORAGE_PREFIX}${conversationId}`;
}

export function defaultChatThemePrefs(): ChatThemePrefs {
  return {
    themeId: DEFAULT_CHAT_THEME_ID,
    blur: CHAT_WALLPAPER_BLUR_DEFAULT,
    dim: CHAT_WALLPAPER_DIM_DEFAULT,
    hasWallpaper: false,
    detached: false,
  };
}

export function readChatThemePrefs(conversationId: string): ChatThemePrefs {
  const defaults = defaultChatThemePrefs();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(chatThemeStorageKey(conversationId));
    if (!raw) return defaults;

    // Phase 1 migration: plain theme id string
    if (!raw.startsWith("{")) {
      return {
        ...defaults,
        themeId: isChatThemeId(raw) ? raw : DEFAULT_CHAT_THEME_ID,
        detached: false,
      };
    }

    const parsed = JSON.parse(raw) as Partial<ChatThemePrefs>;
    return {
      themeId: isChatThemeId(parsed.themeId ?? "")
        ? (parsed.themeId as string)
        : DEFAULT_CHAT_THEME_ID,
      blur: clampWallpaperBlur(
        typeof parsed.blur === "number"
          ? parsed.blur
          : CHAT_WALLPAPER_BLUR_DEFAULT
      ),
      dim: clampWallpaperDim(
        typeof parsed.dim === "number" ? parsed.dim : CHAT_WALLPAPER_DIM_DEFAULT
      ),
      hasWallpaper: !!parsed.hasWallpaper,
      detached: !!parsed.detached,
    };
  } catch {
    return defaults;
  }
}

export function writeChatThemePrefs(
  conversationId: string,
  prefs: ChatThemePrefs
): void {
  try {
    const normalized: ChatThemePrefs = {
      themeId: isChatThemeId(prefs.themeId)
        ? prefs.themeId
        : DEFAULT_CHAT_THEME_ID,
      blur: clampWallpaperBlur(prefs.blur),
      dim: clampWallpaperDim(prefs.dim),
      hasWallpaper: !!prefs.hasWallpaper,
      detached: !!prefs.detached,
    };

    const isDefault =
      normalized.themeId === DEFAULT_CHAT_THEME_ID &&
      !normalized.hasWallpaper &&
      !normalized.detached &&
      normalized.blur === CHAT_WALLPAPER_BLUR_DEFAULT &&
      normalized.dim === CHAT_WALLPAPER_DIM_DEFAULT;

    if (isDefault) {
      localStorage.removeItem(chatThemeStorageKey(conversationId));
    } else {
      localStorage.setItem(
        chatThemeStorageKey(conversationId),
        JSON.stringify(normalized)
      );
    }
  } catch {
    /* ignore quota / private mode */
  }
}


export function prefsFromSharedTheme(
  shared: {
    themeId: string;
    blur: number;
    dim: number;
    wallpaperUrl: string | null;
  }
): ChatThemePrefs {
  return {
    themeId: isChatThemeId(shared.themeId)
      ? shared.themeId
      : DEFAULT_CHAT_THEME_ID,
    blur: clampWallpaperBlur(shared.blur),
    dim: clampWallpaperDim(shared.dim),
    hasWallpaper: !!shared.wallpaperUrl,
    detached: false,
  };
}

/** Inline style bag for the conversation shell */
export function getChatThemeStyle(themeId: string): CSSProperties {
  const pack = getChatThemePack(themeId);
  const { vars } = pack;

  const style: Record<string, string> = {};

  if (vars.mineBg) style["--chat-mine-bg"] = vars.mineBg;
  if (vars.mineFg) style["--chat-mine-fg"] = vars.mineFg;
  if (vars.theirsBg) style["--chat-theirs-bg"] = vars.theirsBg;
  if (vars.theirsFg) style["--chat-theirs-fg"] = vars.theirsFg;
  if (vars.accent) style["--chat-accent"] = vars.accent;
  if (vars.surfaceBase) style["--chat-surface-base"] = vars.surfaceBase;
  if (vars.surfaceGlow) style["--chat-surface-glow"] = vars.surfaceGlow;

  // Remap app chrome tokens so header/composer contrast matches the chat surface
  // (fixes light chat packs under dark app theme, and vice versa).
  if (vars.chromeFg) style["--foreground"] = vars.chromeFg;
  if (vars.chromeMuted) style["--muted-foreground"] = vars.chromeMuted;
  if (vars.chromeMutedBg) style["--muted"] = vars.chromeMutedBg;
  if (vars.chromeBorder) style["--border"] = vars.chromeBorder;
  if (vars.surfaceBase) style["--background"] = vars.surfaceBase;
  if (vars.accent) style["--primary"] = vars.accent;
  if (vars.chromePrimaryFg) style["--primary-foreground"] = vars.chromePrimaryFg;

  // Telegram-style doodle tile (colored SVG background)
  style["--chat-pattern-image"] = getChatPatternImage(
    pack.id,
    vars.patternColor
  );
  if (vars.patternColor) style["--chat-pattern-color"] = vars.patternColor;
  if (vars.patternOpacity != null) {
    style["--chat-pattern-opacity"] = String(vars.patternOpacity);
  }
  if (vars.patternSize) style["--chat-pattern-size"] = vars.patternSize;

  return style as CSSProperties;
}

/** Shared Tailwind class snippets for themed bubbles / nested chrome */
export const chatThemeClasses = {
  bubbleMine: "bg-[var(--chat-mine-bg)] text-[var(--chat-mine-fg)]",
  bubbleTheirs: "bg-[var(--chat-theirs-bg)] text-[var(--chat-theirs-fg)]",
  accentText: "text-[var(--chat-accent)]",
  mineSoftBg: "bg-[color-mix(in_oklab,var(--chat-mine-fg)_12%,transparent)]",
  mineSoftBorder:
    "border-[color-mix(in_oklab,var(--chat-mine-fg)_20%,transparent)]",
  mineFg75:
    "text-[color-mix(in_oklab,var(--chat-mine-fg)_75%,transparent)]",
  mineFg70:
    "text-[color-mix(in_oklab,var(--chat-mine-fg)_70%,transparent)]",
  mineFg65:
    "text-[color-mix(in_oklab,var(--chat-mine-fg)_65%,transparent)]",
  mineFg90:
    "text-[color-mix(in_oklab,var(--chat-mine-fg)_90%,transparent)]",
  mineBar: "bg-[color-mix(in_oklab,var(--chat-mine-fg)_55%,transparent)]",
  mineChipMine:
    "bg-[color-mix(in_oklab,var(--chat-mine-fg)_25%,transparent)]",
  mineChipOther:
    "bg-[color-mix(in_oklab,var(--chat-mine-fg)_15%,transparent)]",
  mineRing:
    "ring-[color-mix(in_oklab,var(--chat-mine-fg)_30%,transparent)]",
  mineAvatarFallback:
    "bg-[color-mix(in_oklab,var(--chat-mine-fg)_20%,transparent)] text-[var(--chat-mine-fg)]",
  theirsSoftBg:
    "bg-[color-mix(in_oklab,var(--chat-surface-base,var(--background))_55%,transparent)]",
  theirsChipMine:
    "bg-[color-mix(in_oklab,var(--chat-accent)_15%,transparent)]",
} as const;
