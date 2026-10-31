import Image from 'next/image';
import { Clock, Users } from 'lucide-react';
import { PACKAGE_KINDS, packageDuration, packagePrice, type GuidePackage } from '@kwetuly/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { SampleBadge } from './guide-card';

/**
 * A guide's approved packages. Each card opens in place (no page change) and its button
 * fills in the contact form on the same page, so travellers decide without leaving the profile.
 */
export function GuidePackages({ packages, guideName, sample, t, locale }: { packages: GuidePackage[]; guideName: string; sample?: boolean; t: Dictionary; locale: Locale }) {
  if (packages.length === 0) return null;
  const pt = t.packages;
  return (
    <section id="packages" className="mt-8 scroll-mt-28">
      <h2 className="text-lg font-semibold">{pt.byGuide.replace('{name}', guideName)}</h2>
      <ul className="mt-3 space-y-3">
        {packages.map((p) => (
          <li key={p.id}>
            <PackageCard p={p} t={t} locale={locale} sample={sample} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One package that opens in place. `askHref` and `guide` are set when it is shown away from the guide's profile.
 * `sample` marks a package from a sample guide (test data).
 */
export function PackageCard({ p, t, locale, askHref, guide, sample }: { p: GuidePackage; t: Dictionary; locale: Locale; askHref?: string; guide?: { name: string; href: string }; sample?: boolean }) {
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
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-leaf-dark">{kind}</span>
            {sample && <SampleBadge label={t.extras.samplePackage} />}
          </span>
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
                <Users className="size-4" aria-hidden /> {p.max_group === 1 ? t.extras.justYou : pt.upTo.replace('{n}', String(p.max_group))}
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
        {guide && (
          <a href={guide.href} className="block text-sm font-semibold text-forest underline">
            {guide.name}
          </a>
        )}
        {sample && <p className="text-sm text-muted">{t.extras.sampleGuideNote}</p>}
        <a href={askHref ?? `?package=${p.id}#contact`} className="btn" data-track="package_ask">
          {pt.ask}
        </a>
      </div>
    </details>
  );
}
