import Image from 'next/image';
import { Clock, Users } from 'lucide-react';
import { PACKAGE_KINDS, packageDuration, packagePrice, type GuidePackage } from '@rafrika/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

/**
 * A guide's approved packages. Each card opens in place (no page change) and its button
 * fills in the contact form on the same page, so travellers decide without leaving the profile.
 */
export function GuidePackages({ packages, guideName, t, locale }: { packages: GuidePackage[]; guideName: string; t: Dictionary; locale: Locale }) {
  if (packages.length === 0) return null;
  const pt = t.packages;
  return (
    <section id="packages" className="mt-8 scroll-mt-28">
      <h2 className="text-lg font-semibold">{pt.byGuide.replace('{name}', guideName)}</h2>
      <ul className="mt-3 space-y-3">
        {packages.map((p) => (
          <li key={p.id}>
            <PackageCard p={p} t={t} locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PackageCard({ p, t, locale }: { p: GuidePackage; t: Dictionary; locale: Locale }) {
  const pt = t.packages;
  const duration = packageDuration(p, pt);
  const kind = PACKAGE_KINDS.find((k) => k.id === p.kind)?.[locale];
  return (
    <details className="group overflow-hidden rounded-[5px] border border-line bg-white open:border-leaf">
      <summary className="flex cursor-pointer list-none gap-4 p-4 [&::-webkit-details-marker]:hidden">
        {p.photo_url && (
          <Image src={p.photo_url} alt="" width={96} height={96} className="size-20 shrink-0 rounded-[5px] object-cover sm:size-24" />
        )}
        <span className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-leaf-dark">{kind}</span>
          <span className="block font-bold">{p.title}</span>
          <span className="mt-1 block text-sm text-muted">{p.summary}</span>
          <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-bold text-forest">{packagePrice(p, pt)}</span>
            {duration && (
              <span className="inline-flex items-center gap-1 text-muted">
                <Clock className="size-4" aria-hidden /> {duration}
              </span>
            )}
            {p.max_group && (
              <span className="inline-flex items-center gap-1 text-muted">
                <Users className="size-4" aria-hidden /> {pt.upTo.replace('{n}', String(p.max_group))}
              </span>
            )}
          </span>
          <span className="mt-2 inline-block text-sm font-semibold text-forest underline group-open:hidden">{pt.details}</span>
        </span>
      </summary>
      <div className="space-y-4 border-t border-line p-4">
        {p.details && <p className="whitespace-pre-line text-sm leading-relaxed">{p.details}</p>}
        {p.includes.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold">{pt.included}</h3>
            <ul className="mt-1 list-inside list-disc text-sm text-muted">
              {p.includes.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
        {p.meeting_point && (
          <p className="text-sm">
            <span className="font-semibold">{pt.meetingPoint}: </span>
            {p.meeting_point}
          </p>
        )}
        <a href={`?package=${p.id}#contact`} className="btn" data-track="package_ask">
          {pt.ask}
        </a>
      </div>
    </details>
  );
}
