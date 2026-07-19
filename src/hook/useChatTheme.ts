"use client";

import {
  defaultChatThemePrefs,
  getChatThemePack,
  getChatThemeStyle,
  prefsFromSharedTheme,
  readChatThemePrefs,
  writeChatThemePrefs,
  type ChatThemePack,
  type ChatThemePrefs,
} from "@/lib/chat/themes";
import {
  CHAT_WALLPAPER_BLUR_DEFAULT,
  CHAT_WALLPAPER_DIM_DEFAULT,
  clampWallpaperBlur,
  clampWallpaperDim,
  compressWallpaperImage,
  validateWallpaperFile,
} from "@/lib/chat/wallpaper";
import {
  clearWallpaperBlob,
  getWallpaperBlob,
  setWallpaperBlob,
} from "@/lib/chat/wallpaperStore";
import type { SharedChatTheme } from "@/types/chatTheme";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

export function useChatTheme(
  conversationId: string | undefined,
  sharedTheme?: SharedChatTheme | null,
  options?: { forceShared?: boolean }
) {
  const forceShared = !!options?.forceShared;
  const [prefs, setPrefs] = useState<ChatThemePrefs>(defaultChatThemePrefs);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const sharedKey = sharedTheme
    ? `${sharedTheme.themeId}|${sharedTheme.wallpaperUrl ?? ""}|${sharedTheme.acceptedAt}|${sharedTheme.blur}|${sharedTheme.dim}`
    : "";

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const applyWallpaperBlob = useCallback(
    (blob: Blob | null) => {
      revokeObjectUrl();
      if (!blob) {
        setWallpaperUrl(null);
        return;
      }
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setWallpaperUrl(url);
    },
    [revokeObjectUrl]
  );

  const applySharedWallpaper = useCallback(
    (url: string | null) => {
      revokeObjectUrl();
      setWallpaperUrl(url);
    },
    [revokeObjectUrl]
  );

  const persistPatch = useCallback(
    (patch: Partial<ChatThemePrefs>, opts?: { detach?: boolean }) => {
      setPrefs((prev) => {
        const next: ChatThemePrefs = {
          ...prev,
          ...patch,
          blur:
            patch.blur !== undefined
              ? clampWallpaperBlur(patch.blur)
              : prev.blur,
          dim:
            patch.dim !== undefined ? clampWallpaperDim(patch.dim) : prev.dim,
          detached:
            opts?.detach === false
              ? false
              : patch.detached !== undefined
                ? patch.detached
                : forceShared
                  ? false
                  : sharedTheme
                    ? true
                    : prev.detached,
        };
        if (conversationId) writeChatThemePrefs(conversationId, next);
        return next;
      });
    },
    [conversationId, sharedTheme, forceShared]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!conversationId) {
        setPrefs(defaultChatThemePrefs());
        applyWallpaperBlob(null);
        setReady(false);
        return;
      }

      let next = readChatThemePrefs(conversationId);

      // Group members (forceShared) always follow the admin theme.
      // Others follow shared until they customize (detached).
      if (sharedTheme && (forceShared || !next.detached)) {
        next = prefsFromSharedTheme(sharedTheme);
        writeChatThemePrefs(conversationId, next);
        if (cancelled) return;
        setPrefs(next);
        applySharedWallpaper(sharedTheme.wallpaperUrl);
        if (!cancelled) setReady(true);
        return;
      }

      if (cancelled) return;
      setPrefs(next);

      if (next.hasWallpaper) {
        const blob = await getWallpaperBlob(conversationId);
        if (cancelled) return;
        if (blob) {
          applyWallpaperBlob(blob);
        } else if (
          sharedTheme?.wallpaperUrl &&
          !next.detached
        ) {
          applySharedWallpaper(sharedTheme.wallpaperUrl);
        } else {
          const healed = { ...next, hasWallpaper: false };
          setPrefs(healed);
          writeChatThemePrefs(conversationId, healed);
          applyWallpaperBlob(null);
        }
      } else {
        applyWallpaperBlob(null);
      }

      if (!cancelled) setReady(true);
    }

    void load();
    return () => {
      cancelled = true;
      revokeObjectUrl();
    };
    // sharedKey tracks meaningful sharedTheme changes without unstable object identity
  }, [
    conversationId,
    sharedKey,
    sharedTheme,
    forceShared,
    applyWallpaperBlob,
    applySharedWallpaper,
    revokeObjectUrl,
  ]);

  const setThemeId = useCallback(
    (themeId: string) => {
      persistPatch({ themeId });
    },
    [persistPatch]
  );

  const setBlur = useCallback(
    (blur: number) => {
      persistPatch({ blur });
    },
    [persistPatch]
  );

  const setDim = useCallback(
    (dim: number) => {
      persistPatch({ dim });
    },
    [persistPatch]
  );

  const setWallpaperFromFile = useCallback(
    async (file: File): Promise<string | null> => {
      if (!conversationId) return "Conversation not ready";
      const validationError = validateWallpaperFile(file);
      if (validationError) return validationError;

      setUploading(true);
      try {
        const blob = await compressWallpaperImage(file);
        await setWallpaperBlob(conversationId, blob);
        applyWallpaperBlob(blob);
        setPrefs((prev) => {
          const next: ChatThemePrefs = {
            ...prev,
            hasWallpaper: true,
            detached: true,
            blur: prev.hasWallpaper ? prev.blur : CHAT_WALLPAPER_BLUR_DEFAULT,
            dim: prev.hasWallpaper ? prev.dim : CHAT_WALLPAPER_DIM_DEFAULT,
          };
          // fix typos below via sed
          writeChatThemePrefs(conversationId, next);
          return next;
        });
        return null;
      } catch {
        return "Failed to process image";
      } finally {
        setUploading(false);
      }
    },
    [applyWallpaperBlob, conversationId]
  );

  const clearWallpaper = useCallback(async () => {
    if (!conversationId) return;
    await clearWallpaperBlob(conversationId);
    applyWallpaperBlob(null);
    persistPatch({ hasWallpaper: false });
  }, [applyWallpaperBlob, conversationId, persistPatch]);

  const resetAll = useCallback(async () => {
    if (conversationId) {
      await clearWallpaperBlob(conversationId);
    }
    applyWallpaperBlob(null);
    const defaults = defaultChatThemePrefs();
    setPrefs(defaults);
    if (conversationId) writeChatThemePrefs(conversationId, defaults);
  }, [applyWallpaperBlob, conversationId]);

  const useSharedTheme = useCallback(async () => {
    if (!conversationId || !sharedTheme) return;
    const next = prefsFromSharedTheme(sharedTheme);
    await clearWallpaperBlob(conversationId);
    setPrefs(next);
    writeChatThemePrefs(conversationId, next);
    applySharedWallpaper(sharedTheme.wallpaperUrl);
  }, [applySharedWallpaper, conversationId, sharedTheme]);

  /** Build FormData of the current personal look for propose/apply APIs. */
  const buildShareFormData = useCallback(async () => {
    const form = new FormData();
    form.append("themeId", prefs.themeId);
    form.append("blur", String(prefs.blur));
    form.append("dim", String(prefs.dim));

    if (prefs.hasWallpaper && conversationId) {
      const blob = await getWallpaperBlob(conversationId);
      if (blob) {
        form.append("wallpaper", blob, "wallpaper.jpg");
      } else if (wallpaperUrl && wallpaperUrl.startsWith("/")) {
        // Shared server URL already — tell server to keep / re-fetch not needed;
        // send clearWallpaper=0 and no file; propose route may keep existing.
        // For a fresh propose of a shared URL look, pass URL via field.
        form.append("wallpaperUrl", wallpaperUrl);
      } else {
        form.append("clearWallpaper", "1");
      }
    } else {
      form.append("clearWallpaper", "1");
    }

    return form;
  }, [
    conversationId,
    prefs.blur,
    prefs.dim,
    prefs.hasWallpaper,
    prefs.themeId,
    wallpaperUrl,
  ]);

  const pack: ChatThemePack = getChatThemePack(prefs.themeId);
  const style: CSSProperties = getChatThemeStyle(prefs.themeId);
  const isCustom =
    prefs.themeId !== "default" || prefs.hasWallpaper;
  const followingShared = !!sharedTheme && !prefs.detached;

  return {
    themeId: prefs.themeId,
    setThemeId,
    blur: prefs.blur,
    setBlur,
    dim: prefs.dim,
    setDim,
    hasWallpaper: prefs.hasWallpaper,
    wallpaperUrl,
    setWallpaperFromFile,
    clearWallpaper,
    resetAll,
    useSharedTheme,
    buildShareFormData,
    uploading,
    pack,
    style,
    ready,
    isCustom,
    followingShared,
    detached: prefs.detached,
    sharedTheme: sharedTheme ?? null,
  };
}

/** Persist accepted shared theme into local prefs (e.g. from Activity). */
export function applySharedThemeLocally(
  conversationId: string,
  shared: SharedChatTheme
) {
  const next = prefsFromSharedTheme(shared);
  writeChatThemePrefs(conversationId, next);
  void clearWallpaperBlob(conversationId);
}
