import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';

// 1) مسیرهای دقیق
const protectedPaths = ['/thread/new'];

// 2) هر چیزی که با این پیشوندها شروع شود
const protectedPrefixes = ['/profile'];


const ignoredPrefixes = ['/api', '/_next', '/static', '/favicon.ico'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /* ---------- ۱) رد کردن استاتیک و API ---------- */
  if (ignoredPrefixes.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  /* ---------- ۲) آیا این مسیر محافظت‌شده است؟ ---------- */
  const isProtected =
    protectedPaths.includes(pathname) ||                      // مسیر دقیق
    protectedPaths.some(p => pathname.startsWith(p + '/')) || // زیرمسیرهای سطح۱
    protectedPrefixes.some(p => pathname.startsWith(p));      // پیشوندی (/profile/*)

  if (!isProtected) return NextResponse.next();

  /* ---------- ۳) چک وجود atk ---------- */
  const atk = req.cookies.get('atk')?.value;
  if (!atk) return redirectToLogin(req);

  /* ---------- ۴) ولیدیت توکن ---------- */
  try {
    await verifyAccessToken(atk);
    return NextResponse.next(); // همه چیز اوکی‌ست
  } catch {
    return redirectToLogin(req);
  }
}

/* ---------- ۵) ریدایرکت به صفحه لاگین ---------- */
function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/auth';                 // صفحه لاگین/رجیستر شما
  url.searchParams.set('callbackUrl', req.nextUrl.pathname); // برگشت پس از لاگین
  return NextResponse.redirect(url);
}

/* ---------- ۶) matcher: همه چیز به جز استاتیک/API ---------- */
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};