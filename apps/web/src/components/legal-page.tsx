import Link from 'next/link';
import { LEGAL_PUBLISHED } from '@kwetuly/shared';
import { LOCALE_TAGS, type Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

type LegalKey = 'privacy' | 'terms' | 'data-deletion';

/** "30 October 2026" in the visitor's language. */
export function legalDate(locale: Locale) {
  const tag = locale === 'en' ? 'en-GB' : LOCALE_TAGS[locale];
  return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${LEGAL_PUBLISHED}T00:00:00Z`));
}

// Shared frame for the temporary privacy, terms and data deletion pages. The body is English only
// for every locale (marked lang="en"), while the title and the "temporary version" line are translated.
export function LegalPage({ t, locale, current, title, children }: { t: Dictionary; locale: Locale; current: LegalKey; title: string; children: React.ReactNode }) {
  const links: { key: LegalKey; label: string }[] = [
    { key: 'privacy', label: t.legal.privacy },
    { key: 'terms', label: t.legal.terms },
    { key: 'data-deletion', label: t.legal.dataDeletion },
  ];
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-12">
      <nav aria-label={t.legal.privacy + ', ' + t.legal.terms} className="flex flex-wrap gap-2 text-sm">
        {links.map((l) => (
          <Link
            key={l.key}
            href={`/${locale}/${l.key}`}
            aria-current={l.key === current ? 'page' : undefined}
            className={
              l.key === current
                ? 'rounded-[5px] bg-mint px-3 py-1.5 font-semibold text-forest'
                : 'rounded-[5px] px-3 py-1.5 font-semibold text-forest underline-offset-2 hover:bg-mint hover:underline'
            }
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl">{title}</h1>
      <p className="mt-4 rounded-[5px] border border-gold bg-gold/10 p-4 text-sm font-semibold" role="note">
        {t.legal.temporary.replace('{date}', legalDate(locale))}
      </p>
      {locale !== 'en' && <p className="mt-3 text-sm text-muted">{t.legal.englishOnly}</p>}
      <div
        lang="en"
        dir="ltr"
        className="mt-8 leading-relaxed [overflow-wrap:anywhere] [&_a]:font-semibold [&_a]:text-forest [&_a]:underline [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:font-bold [&_li]:mt-1.5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6"
      >
        {children}
      </div>
    </div>
  );
}
