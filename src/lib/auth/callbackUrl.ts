/**
 * Returns a same-origin relative path safe for post-login redirects.
 * Rejects open redirects (protocol-relative, absolute URLs, etc.).
 */
export function safeCallbackUrl(
  value: string | null | undefined,
  fallback = "/"
): string {
  if (!value) return fallback;

  let url = value;
  try {
    url = decodeURIComponent(value);
  } catch {
    return fallback;
  }

  if (!url.startsWith("/")) return fallback;
  if (url.startsWith("//")) return fallback;
  if (url.includes("\\")) return fallback;
  if (url.includes("://")) return fallback;
  // Avoid bouncing back to the auth page
  if (url === "/auth" || url.startsWith("/auth/")) return fallback;

  return url;
}
