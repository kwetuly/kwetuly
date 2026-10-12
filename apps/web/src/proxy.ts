import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, hasLocale, type Locale } from '@/i18n/config';
import { updateSession } from '@/lib/supabase/proxy';

function preferredLocale(request: NextRequest): Locale {
  const saved = request.cookies.get('lang')?.value;
  if (saved && hasLocale(saved)) return saved;
  const accept = request.headers.get('accept-language') ?? '';
  return /\bsw\b/i.test(accept) ? 'sw' : defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split('/')[1] ?? '';

  // Pages live under /en/... and /sw/...; send everything else to the visitor's language.
  if (!hasLocale(firstSegment) && !pathname.startsWith('/auth/')) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale(request)}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next({ request });
  if (hasLocale(firstSegment)) {
    response.cookies.set('lang', firstSegment, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  return updateSession(request, response);
}

export const config = {
  matcher: ['/((?!_next/|api/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)'],
};
