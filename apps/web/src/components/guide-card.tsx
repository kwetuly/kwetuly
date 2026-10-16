import Link from 'next/link';
import { BadgeCheck, Handshake, Languages, MapPin, Venus } from 'lucide-react';
import { GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES } from '@rafrika/shared';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Guide } from '@/lib/guides';
import { Icon } from './icon';
import { RatingSummary } from './stars';

export function specialtyName(id: string, locale: Locale) {
  const s = GUIDE_SPECIALTIES.find((x) => x.id === id);
  return s ? s[locale] : id;
}

export function expertiseOf(guide: Guide) {
  return GUIDE_EXPERTISE.filter((e) => guide.expertise.includes(e.id));
}

export function languageName(code: string) {
  return GUIDE_LANGUAGES.find((x) => x.code === code)?.name ?? code;
}

export function GuideAvatar({ guide, size }: { guide: Guide; size: number }) {
  return guide.photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={guide.photo_url}
      alt={guide.display_name}
      width={size}
      height={size}
      className="shrink-0 rounded-[5px] object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-[5px] bg-sand font-bold text-leaf-dark"
      style={{ width: size, height: size, fontSize: size / 2.5 }}
      aria-hidden
    >
      {guide.display_name.charAt(0)}
    </div>
  );
}

// Badges for who the guide is: verified, Pro, female guide, works with agencies.
const pill = 'inline-flex items-center gap-1 rounded-[5px] px-3 py-1 text-xs font-bold';

export function GuideBadges({ guide, t }: { guide: Guide; t: Dictionary }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {guide.is_sample ? (
        <span className={`${pill} border border-gold bg-sand text-charcoal`}>{t.extras.sampleGuide}</span>
      ) : (
        guide.verification_status === 'approved' && (
          <span className={`${pill} bg-mint text-forest`}><BadgeCheck className="size-3.5" aria-hidden /> {t.guides.verified}</span>
        )
      )}
      {guide.plan === 'pro' && <span className={`${pill} bg-gold/30 text-charcoal`}>{t.guides.pro}</span>}
      {guide.female_guide && (
        <span className={`${pill} bg-sand text-leaf-dark`}><Venus className="size-3.5" aria-hidden /> {t.guides.female}</span>
      )}
      {guide.open_to_partners && (
        <span className={`${pill} bg-night text-white`}><Handshake className="size-3.5" aria-hidden /> {t.guides.partners}</span>
      )}
    </div>
  );
}

// A guide at a glance: who they are, what they do, which languages they speak and their special trips.
export function GuideCard({ guide, locale, t }: { guide: Guide; locale: Locale; t: Dictionary }) {
  const expertise = expertiseOf(guide);
  return (
    <Link
      href={`/${locale}/guides/${guide.slug}`}
      className="group flex flex-col rounded-[5px] border border-line bg-white p-5 transition hover:-translate-y-1 hover:border-leaf"
    >
      <div className="flex gap-4">
        <GuideAvatar guide={guide} size={72} />
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight group-hover:text-leaf-dark">{guide.display_name}</h3>
          {guide.headline && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{guide.headline}</p>}
          <div className="mt-1">
            <RatingSummary avg={guide.rating_avg} count={guide.rating_count} labels={t.reviews} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden /> {guide.base_region}</span>
            {guide.years_experience ? <span>{guide.years_experience} {t.guides.years}</span> : null}
            {guide.summits ? <span>{guide.summits} {t.guides.summits}</span> : null}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <GuideBadges guide={guide} t={t} />
      </div>

      {/* What they do */}
      {guide.specialties.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={t.profile.specialties}>
          {guide.specialties.map((s) => (
            <li key={s} className="rounded-[5px] bg-surface px-2.5 py-1 text-xs font-semibold">
              {specialtyName(s, locale)}
            </li>
          ))}
        </ul>
      )}

      {/* Languages */}
      <p className="mt-3 flex items-start gap-1.5 text-sm">
        <Languages className="mt-0.5 size-4 shrink-0 text-forest" aria-label={t.guides.languages} />
        <span className="font-medium">{guide.languages.map(languageName).join(', ')}</span>
      </p>

      {/* Special trips */}
      {expertise.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3" aria-label={t.profile.expertise}>
          {expertise.map((e) => (
            <li key={e.id} className="inline-flex items-center gap-1 rounded-[5px] bg-surface px-2.5 py-1 text-xs font-semibold text-charcoal">
              <Icon name={e.icon} className="size-3.5" /> {e.label[locale]}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
