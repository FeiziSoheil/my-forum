/** Client-side chat wallpaper helpers (phase 2 — personal only). */

export const WALLPAPER_MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8MB before compress
export const WALLPAPER_MAX_DIMENSION = 1600;
export const WALLPAPER_JPEG_QUALITY = 0.78;

export const CHAT_WALLPAPER_BLUR_MIN = 0;
export const CHAT_WALLPAPER_BLUR_MAX = 24;
export const CHAT_WALLPAPER_BLUR_DEFAULT = 6;

export const CHAT_WALLPAPER_DIM_MIN = 0;
export const CHAT_WALLPAPER_DIM_MAX = 80;
export const CHAT_WALLPAPER_DIM_DEFAULT = 40;

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function clampWallpaperBlur(n: number) {
  return Math.min(
    CHAT_WALLPAPER_BLUR_MAX,
    Math.max(CHAT_WALLPAPER_BLUR_MIN, Math.round(n))
  );
}

export function clampWallpaperDim(n: number) {
  return Math.min(
    CHAT_WALLPAPER_DIM_MAX,
    Math.max(CHAT_WALLPAPER_DIM_MIN, Math.round(n))
  );
}

export function validateWallpaperFile(file: File): string | null {
  if (!file.type.startsWith("image/") || !ACCEPTED_TYPES.has(file.type)) {
    return "Please choose a JPG, PNG, or WebP image";
  }
  if (file.size > WALLPAPER_MAX_INPUT_BYTES) {
    return "Image must be under 8MB";
  }
  return null;
}

/**
 * Downscale + JPEG-compress for IndexedDB storage.
 * Keeps chat prefs lean while looking sharp on phone/desktop.
 */
export async function compressWallpaperImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      WALLPAPER_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
    );
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Compress failed"))),
        "image/jpeg",
        WALLPAPER_JPEG_QUALITY
      );
    });
    return blob;
  } finally {
    bitmap.close();
  }
}
