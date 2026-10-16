import { BadgeCheck, HeartPulse, IdCard, type LucideIcon } from 'lucide-react';
import { guideChecks, type GuideCheckFields, type GuideCheckId } from '@rafrika/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { today } from '@/lib/today';

const ICONS: Record<GuideCheckId, LucideIcon> = { identity: IdCard, licence: BadgeCheck, firstAid: HeartPulse };

function checkText(id: GuideCheckId, c: Dictionary['checks']) {
  return id === 'identity'
    ? { label: c.identity, body: c.identityBody }
    : id === 'licence'
      ? { label: c.licence, body: c.licenceBody }
      : { label: c.firstAid, body: c.firstAidBody };
}

// Small labels under the guide's name: exactly which checks Rafrika has done.
export async function GuideCheckPills({ guide, t }: { guide: GuideCheckFields; t: Dictionary }) {
  const checks = guideChecks(guide, await today());
  if (checks.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {checks.map((check) => {
        const Icon = ICONS[check.id];
        return (
          <li key={check.id}>
            <a href="#checks" className="inline-flex items-center gap-1 rounded-[5px] bg-mint px-2.5 py-1 text-xs font-semibold text-forest hover:underline">
              <Icon className="size-3.5" aria-hidden /> {checkText(check.id, t.checks).label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

// "What Rafrika checked": each check in plain words, with the date. The documents themselves stay private.
// `approved`: Rafrika approved the profile, which is said plainly when no document has been checked yet.
export async function GuideChecksSection({ guide, t, locale, approved }: { guide: GuideCheckFields; t: Dictionary; locale: Locale; approved?: boolean }) {
  const c = t.checks;
  const checks = guideChecks(guide, await today());
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <section id="checks" className="mt-8 scroll-mt-28">
      <h2 className="text-lg font-semibold">{c.title}</h2>
      {checks.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{approved ? t.extras.approvedGuideBody : c.none}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">{c.intro}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {checks.map((check) => {
              const Icon = ICONS[check.id];
              const text = checkText(check.id, c);
              return (
                <li key={check.id} className="flex gap-3 rounded-[5px] border border-line bg-white p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[5px] bg-leaf text-white">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm">
                    <strong className="block">{text.label}</strong>
                    <span className="text-muted">{text.body}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {c.checkedOn} {date.format(new Date(check.checkedAt))}
                      {check.validUntil && ` · ${c.validUntil} ${date.format(new Date(check.validUntil))}`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
