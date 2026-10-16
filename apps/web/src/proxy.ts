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

  // Icons, robots.txt and sitemap.xml are excluded by the matcher below so they are never redirected.
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
  return updateSession(request, response, groupTripMissing(request));
}

// Group trips are only visible to some people (pending trips to their organiser), so the page
// cannot know before streaming whether a trip exists. Check here, as the visitor, and answer
// unknown or hidden trips with a real HTTP 404 instead of a 200 "not found" page.
function groupTripMissing(request: NextRequest) {
  const match = /^\/([a-z]{2})\/group-trips\/([^/]+)\/?$/.exec(request.nextUrl.pathname);
  if (!match || !hasLocale(match[1]) || match[2] === 'new' || match[2] === 'mine') return undefined;
  const [, lang, id] = match;
  const notFound = () => NextResponse.rewrite(new URL(`/${lang}/not-found`, request.url), { status: 404 });
  return async (supabase: Parameters<NonNullable<Parameters<typeof updateSession>[2]>>[0]) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
    const { data, error } = await supabase.from('group_trips').select('id').eq('id', id).maybeSingle();
    // On a database error let the page decide, rather than show a wrong 404.
    return !error && !data ? notFound() : null;
  };
}

export const config = {
  matcher: ['/((?!_next/|api/|icon|apple-icon|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)'],
};
