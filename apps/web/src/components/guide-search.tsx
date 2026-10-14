import { GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES, REGIONS } from '@rafrika/shared';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import type { GuideFilters } from '@/lib/guides';

type Props = {
  locale: Locale;
  t: Dictionary;
  defaults?: GuideFilters;
  /** The full guide list shows every filter; the home page hero keeps it short. */
  full?: boolean;
};

// Plain GET form, so search works without JavaScript and results have shareable URLs.
export function GuideSearch({ locale, t, defaults = {}, full = false }: Props) {
  return (
    <form action={`/${locale}/guides`} className="rounded-brand bg-white p-3 border border-line">
      <div className={`grid gap-3 ${full ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-flow-col sm:auto-cols-fr'}`}>
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

        {full && (
          <>
            <label className="sr-only" htmlFor="expertise">{t.guides.expertise}</label>
            <select id="expertise" name="expertise" defaultValue={defaults.expertise ?? ''} className="field">
              <option value="">{t.guides.anyExpertise}</option>
              {GUIDE_EXPERTISE.map((e) => (
                <option key={e.id} value={e.id}>{e.label[locale]}</option>
              ))}
            </select>

            <label className="sr-only" htmlFor="region">{t.guides.region}</label>
            <select id="region" name="region" defaultValue={defaults.region ?? ''} className="field">
              <option value="">{t.guides.anyRegion}</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </>
        )}

        {!full && <button className="btn">{t.home.search}</button>}
      </div>

      {full && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="female" value="1" defaultChecked={defaults.female} className="size-5 accent-leaf" />
              {t.guides.femaleOnly}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="partners" value="1" defaultChecked={defaults.partners} className="size-5 accent-leaf" />
              {t.guides.partnersOnly}
            </label>
          </div>
          <button className="btn">{t.guides.apply}</button>
        </div>
      )}
    </form>
  );
}
