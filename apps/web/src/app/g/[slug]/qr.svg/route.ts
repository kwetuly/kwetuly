import { cookies } from 'next/headers';
import { getGuideBySlug } from '@/lib/guides';
import { bookingLinkUrl, qrSvg } from '@/lib/qr';
import { hasPreviewAccess, PREVIEW_COOKIE, siteClosed } from '@/lib/coming-soon';
import { bookingLinkOn } from '@/app/[lang]/dashboard/booking-link/feature';

const SLUG = /^[a-z0-9-]{1,60}$/;

// The QR code for a guide's booking link, as an SVG. Public data only (the page address), and only for
// approved guides while feature.booking_link is on. Paths ending in .svg skip the proxy, so the
// "coming soon" gate is checked here too: while the site is closed only the team gets the code.
// Scanning it opens /g/[slug]?src=qr. Cached for 5 minutes, so switching the feature off takes effect soon.
export async function GET(request: Request, ctx: RouteContext<'/g/[slug]/qr.svg'>) {
  const { slug } = await ctx.params;
  const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (siteClosed() && !(await hasPreviewAccess((await cookies()).get(PREVIEW_COOKIE)?.value))) return notFound();
  if (!SLUG.test(slug) || !(await bookingLinkOn())) return notFound();
  const guide = await getGuideBySlug(slug);
  if (!guide) return notFound();
  const download = new URL(request.url).searchParams.get('download') === '1';
  return new Response(qrSvg(bookingLinkUrl(slug, 'qr'), `Kwetuly: ${guide.display_name}`), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // private while the site is closed, so a shared cache never hands the team's copy to others.
      'Cache-Control': `${siteClosed() ? 'private' : 'public'}, max-age=300`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
      ...(download ? { 'Content-Disposition': `attachment; filename="kwetuly-${slug}-qr.svg"` } : {}),
    },
  });
}
