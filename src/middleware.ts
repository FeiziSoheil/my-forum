import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { safeCallbackUrl } from '@/lib/auth/callbackUrl';

// Protected routes
const protectedPaths = ['/post/new', '/stories/new'];
const protectedPrefixes = ['/messages', '/likes', '/settings', '/bookmarks', '/history'];

function isReplyComposePath(pathname: string): boolean {
  return /^\/post\/[^/]+\/reply\/?$/.test(pathname);
}

// Own-profile routes (route group `(me)`): require login.
// Public `/profile/[username]/*` stays open for logged-out viewers.
const OWN_PROFILE_TABS = new Set([
  'posts',
  'reposts',
  'replies',
  'followers',
  'following',
]);

function isOwnProfilePath(pathname: string): boolean {
  if (pathname === '/profile' || pathname === '/profile/') return true;
  const parts = pathname.split('/').filter(Boolean);
  // /profile/posts | /profile/followers | …
  return parts.length === 2 && parts[0] === 'profile' && OWN_PROFILE_TABS.has(parts[1]);
}

// Auth routes that logged-in users shouldn't access
function isAuthRoute(pathname: string): boolean {
  return pathname === '/auth' || pathname.startsWith('/auth/');
}

const ignoredPrefixes = ['/api', '/_next', '/static', '/favicon.ico'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Ignore static and API routes
  if (ignoredPrefixes.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2) Check for auth token
  const atk = req.cookies.get('atk')?.value;
  const isLoggedIn = atk && await verifyToken(atk);

  // 3) If user is logged in and trying to access auth routes, redirect away
  if (isLoggedIn && isAuthRoute(pathname)) {
    const dest = safeCallbackUrl(req.nextUrl.searchParams.get('callbackUrl'));
    return NextResponse.redirect(new URL(dest, req.url));
  }

  // 4) Check if route is protected
  const isProtected =
    protectedPaths.includes(pathname) ||
    protectedPrefixes.some(p => pathname.startsWith(p)) ||
    isOwnProfilePath(pathname) ||
    isReplyComposePath(pathname);

  if (!isProtected) return NextResponse.next();

  // 5) If protected route and no valid token, redirect to login
  if (!isLoggedIn) {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

async function verifyToken(token: string): Promise<boolean> {
  try {
    await verifyAccessToken(token);
    return true;
  } catch {
    return false;
  }
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/auth';
  url.search = '';
  const callback = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  url.searchParams.set('callbackUrl', callback);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
