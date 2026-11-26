import { defaultLocale, hasLocale } from '@/i18n/config';
import { getGuideBySlug } from '@/lib/guides';
import { bookingLinkOn } from '@/app/[lang]/dashboard/booking-link/feature';

const SLUG = /^[a-z0-9-]{1,60}$/;

// The short booking link /g/[slug]. The proxy has already added the visitor's language (from the
// lang cookie or the browser), so /g/neema becomes /sw/g/neema and lands here, then on the guide's page.
// ?src=qr marks a scan of the printed QR code; everything else is a shared link.
// Only while feature.booking_link is on and only for an approved guide; otherwise the guide list.
export async function GET(request: Request, ctx: RouteContext<'/[lang]/g/[slug]'>) {
  const { lang, slug } = await ctx.params;
  const locale = hasLocale(lang) ? lang : defaultLocale;
  const src = new URL(request.url).searchParams.get('src') === 'qr' ? 'qr' : 'link';
  const ok = SLUG.test(slug) && (await bookingLinkOn()) && !!(await getGuideBySlug(slug));
  // A relative Location, so the address never depends on the Host header.
  const target = ok ? `/${locale}/guides/${slug}?src=${src}` : `/${locale}/guides`;
  return new Response(null, { status: 307, headers: { Location: target, 'Cache-Control': 'no-store' } });
}
