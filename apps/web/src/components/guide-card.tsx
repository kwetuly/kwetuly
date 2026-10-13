import Link from 'next/link';
import { GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES } from '@rafrika/shared';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Guide } from '@/lib/guides';
import { Icon } from './icon';

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
      className="shrink-0 rounded-brand object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-brand bg-mint font-bold text-forest"
      style={{ width: size, height: size, fontSize: size / 2.5 }}
      aria-hidden
    >
      {guide.display_name.charAt(0)}
    </div>
  );
}

export function GuideCard({ guide, locale, t }: { guide: Guide; locale: Locale; t: Dictionary }) {
  return (
    <Link href={`/${locale}/guides/${guide.slug}`} className="card flex gap-4 transition hover:border-forest">
      <GuideAvatar guide={guide} size={72} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{guide.display_name}</h3>
          {guide.plan === 'pro' && <span className="badge">{t.guides.pro}</span>}
          {guide.female_guide && <span className="badge bg-sand text-sunset-dark">{t.guides.female}</span>}
        </div>
        {guide.headline && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{guide.headline}</p>}
        <p className="mt-2 text-xs text-muted">
          {guide.base_region} · {guide.languages.map(languageName).join(', ')}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {guide.specialties.slice(0, 3).map((s) => (
            <span key={s} className="rounded-full bg-surface px-2 py-0.5 text-xs">
              {specialtyName(s, locale)}
            </span>
          ))}
          {expertiseOf(guide).map((e) => (
            <span key={e.id} className="inline-flex items-center gap-1 rounded-full bg-mint px-2 py-0.5 text-xs text-forest" title={e.label[locale]}>
              <Icon name={e.icon} className="size-3" /> {e.label[locale]}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
