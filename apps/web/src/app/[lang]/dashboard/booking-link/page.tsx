import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Download } from 'lucide-react';
import { guideProgressText } from '@kwetuly/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { bookingLinkUrl } from '@/lib/qr';
import { ShareButtons } from '@/components/share-buttons';
import { bookingLinkOn } from './feature';
import { PrintButton } from './print-button';

export async function generateMetadata(): Promise<Metadata> {
  return { title: guideProgressText(await getLocale()).linkTitle, robots: { index: false } };
}

// The guide's own booking link: the /g/[slug] short link to their page, with copy, share, QR and print.
export default async function BookingLinkPage() {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[5px] bg-surface" aria-busy="true" />}>
        <BookingLink locale={locale} />
      </Suspense>
    </div>
  );
}

type MyGuide = { slug: string; display_name: string; verification_status: 'pending' | 'approved' | 'rejected' };

async function BookingLink({ locale }: { locale: Locale }) {
  const user = await requireUser(locale);
  const g = guideProgressText(locale);
  const supabase = await createClient();
  const [on, { data: guide, error }] = await Promise.all([
    bookingLinkOn(),
    supabase.from('guides').select('slug, display_name, verification_status').eq('owner_id', user.id).maybeSingle<MyGuide>(),
  ]);

  const note = (text: string, action?: React.ReactNode) => (
    <section className="card mt-6">
      <p className="text-muted">{text}</p>
      {action}
    </section>
  );

  let body: React.ReactNode;
  if (!on) body = note(g.linkOff);
  else if (error) body = note(g.linkError, <Link href={`/${locale}/dashboard/booking-link`} className="btn mt-4">{g.retry}</Link>);
  else if (!guide) body = note(g.linkNoProfile, <Link href={`/${locale}/dashboard?step=basics`} className="btn mt-4">{g.steps[0]}</Link>);
  else {
    const url = bookingLinkUrl(guide.slug);
    const approved = guide.verification_status === 'approved';
    body = (
      <section className="card mt-6 space-y-5">
        <div>
          <p className="label">{g.linkTitle}</p>
          {/* The link itself, easy to read aloud and to select. */}
          <p className="break-all rounded-[5px] bg-mint px-4 py-3 font-mono text-base font-semibold text-forest select-all">{url}</p>
        </div>
        {!approved && <p className="rounded-[5px] bg-sand p-4 text-charcoal">{g.linkPending}</p>}
        {approved && (
          <>
            <div className="print:hidden">
              <ShareButtons
                path={`/g/${guide.slug}`}
                title={guide.display_name}
                text={g.shareMessage}
                labels={{ share: g.share, copyLink: g.copy, copied: g.copied, email: g.email, more: g.shareMore }}
              />
            </div>
            <div className="flex flex-col items-center gap-3 border-t border-line pt-5 sm:flex-row sm:items-start sm:gap-6">
              {/* eslint-disable-next-line @next/next/no-img-element -- a small SVG made by our own route */}
              <img src={`/g/${guide.slug}/qr.svg`} alt={g.qrAlt} width={200} height={200} className="size-48 rounded-[5px] border border-line bg-white p-1 sm:size-52" />
              <div className="space-y-3 text-center sm:text-left">
                <h2 className="text-lg font-bold">{g.qrTitle}</h2>
                <p className="text-sm text-muted">{g.qrHint}</p>
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start print:hidden">
                  <a href={`/g/${guide.slug}/qr.svg?download=1`} download={`kwetuly-${guide.slug}-qr.svg`} className="btn-outline px-4 py-2 text-sm">
                    <Download className="size-4" aria-hidden /> {g.qrSave}
                  </a>
                  <PrintButton label={g.print} />
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <>
      <Link href={`/${locale}/dashboard`} className="text-sm font-semibold text-forest underline print:hidden">{g.back}</Link>
      <h1 className="mt-2 text-3xl font-bold">{g.linkTitle}</h1>
      <p className="mt-2 text-muted">{g.linkIntro}</p>
      {body}
    </>
  );
}
