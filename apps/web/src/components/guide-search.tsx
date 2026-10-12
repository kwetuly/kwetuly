import { GUIDE_LANGUAGES, GUIDE_SPECIALTIES, REGIONS } from '@rafrika/shared';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

type Props = {
  locale: Locale;
  t: Dictionary;
  defaults?: { specialty?: string; language?: string; region?: string };
  showRegion?: boolean;
};

// Plain GET form, so search works without JavaScript and results have shareable URLs.
export function GuideSearch({ locale, t, defaults = {}, showRegion = false }: Props) {
  return (
    <form
      action={`/${locale}/guides`}
      className="grid gap-3 rounded-brand bg-white p-3 shadow-[0_4px_20px_rgba(0,0,0,0.05)] sm:grid-flow-col sm:auto-cols-fr"
    >
      <label className="sr-only" htmlFor="specialty">{t.home.specialtyLabel}</label>
      <select id="specialty" name="specialty" defaultValue={defaults.specialty ?? ''} className="field">
        <option value="">{t.home.anySpecialty}</option>
        {GUIDE_SPECIALTIES.map((s) => (
          <option key={s.id} value={s.id}>{s[locale]}</option>
        ))}
      </select>

      <label className="sr-only" htmlFor="language">{t.home.languageLabel}</label>
      <select id="language" name="language" defaultValue={defaults.language ?? ''} className="field">
        <option value="">{t.home.anyLanguage}</option>
        {GUIDE_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.name}</option>
        ))}
      </select>

      {showRegion && (
        <>
          <label className="sr-only" htmlFor="region">{t.guides.region}</label>
          <select id="region" name="region" defaultValue={defaults.region ?? ''} className="field">
            <option value="">{t.guides.anyRegion}</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </>
      )}

      <button className="btn">{t.home.search}</button>
    </form>
  );
}
