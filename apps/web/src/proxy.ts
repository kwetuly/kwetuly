import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, hasLocale, type Locale } from '@/i18n/config';
import { updateSession } from '@/lib/supabase/proxy';

function preferredLocale(request: NextRequest): Locale {
  const saved = request.cookies.get('lang')?.value;
  if (saved && hasLocale(saved)) return saved;
  // Accept-Language looks like "pl-PL,pl;q=0.9,en;q=0.8": take the best-ranked language we support.
  const ranked = (request.headers.get('accept-language') ?? '')
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { base: tag.split('-')[0].toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  const best = ranked.find((r) => hasLocale(r.base))?.base;
  return best && hasLocale(best) ? best : defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split('/')[1] ?? '';

  // Pages live under /en/..., /sw/..., /fr/... and so on; send everything else to the visitor's language.
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
