import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Crown } from 'lucide-react';
import { HOST_FEATURES, HOSTS_ENTRY_LINKS, hostsEntryText, hostsText, isFeatureOn, limitTexts } from '@kwetuly/shared';
import { LOCALE_TAGS, type Locale } from '@/i18n/config';
import { getCurrentUser } from '@/lib/auth';
import { HostContact } from './host-contact';
import { hostContactAlreadySent } from './host-contact-status';
import { pageMeta } from '@/lib/seo';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { getFeatures } from '@/lib/features';

// "Become a host": a static page for people who want to be personal trip or investment visit hosts.
// Host texts are guide/owner texts (English and Kiswahili; other languages show English).
// Each kind of host shows only while its admin switch is on (feature.vip_hosts for the concierge /
// personal trip host, feature.investment_hosts for the investment visit host); with both off the
// page is not found. The menu, footer and sign-up link to #concierge and #investment.
export async function generateMetadata(): Promise<Metadata> {
  const x = hostsText(await getLocale());
  return pageMeta({ path: '/hosts', title: x.metaTitle, description: x.metaDescription });
}

export default async function HostsPage() {
  const [locale, features] = await Promise.all([getLocale(), getFeatures()]);
  const concierge = isFeatureOn(features, HOST_FEATURES.concierge);
  const investment = isFeatureOn(features, HOST_FEATURES.investment);
  if (!concierge && !investment) notFound();
  const x = hostsText(locale);
  const e = hostsEntryText(locale);
  const kinds = x.kinds.filter((k) => (k.id === 'concierge' ? concierge : investment));
  const textLang = locale === 'sw' ? 'sw' : 'en';
  const apply = `/${locale}/join?role=guide&intent=host`;
  return (
    <div lang={textLang} className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold sm:text-4xl">
        <Crown className="size-8 shrink-0 text-leaf-dark" aria-hidden /> {x.title}
      </h1>
      <p className="mt-3 text-lg text-muted">{x.intro}</p>

      <section className="card mt-8" aria-labelledby="host-kinds">
        <h2 id="host-kinds" className="text-2xl font-bold">{kinds.length > 1 ? x.kindsTitle : e.oneKindTitle}</h2>
        <ul className="mt-4 space-y-4">
          {kinds.map((k) => (
            <li key={k.id} id={k.id} className="scroll-mt-32">
              <p className="font-semibold">{k.name}</p>
              <p className="mt-1">{k.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {concierge && (
        <section className="card mt-6" aria-labelledby="host-concierge">
          <h2 id="host-concierge" className="text-2xl font-bold">{e.conciergeTitle}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            {e.conciergeDoes.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <p className="mt-4 font-semibold">{e.conciergeNot}</p>
        </section>
      )}

      <section className="mt-6 rounded-[5px] border border-gold bg-sand p-5 text-charcoal" aria-labelledby="host-not-offered">
        <h2 id="host-not-offered" className="text-xl font-bold">{x.notOfferedTitle}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {x.notOffered.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>

      <section className="card mt-6" aria-labelledby="host-how">
        <h2 id="host-how" className="text-2xl font-bold">{x.howTitle}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {x.how.map((line) => <li key={line}>{line}</li>)}
        </ol>
        <p className="mt-3">{e.serviceNote}</p>
      </section>

      <section className="card mt-6" aria-labelledby="host-good">
        <h2 id="host-good" className="text-2xl font-bold">{x.goodTitle}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {x.good.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>

      <section className="card mt-6" aria-labelledby="host-conduct">
        <h2 id="host-conduct" className="text-2xl font-bold">{x.conductTitle}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {x.conduct.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p className="mt-4 text-sm text-muted">{x.draftNote}</p>
      </section>

      {/* The rest of the page is the same for everyone; only this part depends on who is signed in. */}
      <Suspense fallback={<ApplyLink href={apply} label={x.apply} note={x.applyNote} />}>
        <HostAction locale={locale} apply={apply} label={x.apply} note={x.applyNote} />
      </Suspense>
    </div>
  );
}

function ApplyLink({ href, label, note }: { href: string; label: string; note: string }) {
  return (
    <div className="mt-8">
      <Link href={href} className="btn w-full sm:w-auto" data-track="hosts_apply">
        {label}
      </Link>
      <p className="mt-2 text-sm text-muted">{note}</p>
    </div>
  );
}

// One main action: signed out or a guide, "Apply"; a signed-in traveller or business account cannot
// apply with that account, so their next step is "Please contact me".
async function HostAction({ locale, apply, label, note }: { locale: Locale; apply: string; label: string; note: string }) {
  const user = await getCurrentUser();
  if (!user || user.role === 'guide' || user.role === 'admin') return <ApplyLink href={apply} label={label} note={note} />;
  const [t, alreadySent] = await Promise.all([getDictionary(), hostContactAlreadySent()]);
  return (
    <div lang={LOCALE_TAGS[locale]}>
      <HostContact
        locale={locale}
        accountHref={`/${locale}/dashboard`}
        alreadySent={alreadySent}
        t={{
          notGuide: HOSTS_ENTRY_LINKS.notGuide[locale],
          askContact: HOSTS_ENTRY_LINKS.askContact[locale],
          sent: HOSTS_ENTRY_LINKS.askContactSent[locale],
          missing: HOSTS_ENTRY_LINKS.missingDetails[locale],
          openAccount: HOSTS_ENTRY_LINKS.openAccount[locale],
          busy: limitTexts(locale).tooMany,
          error: t.auth.error,
        }}
      />
    </div>
  );
}
