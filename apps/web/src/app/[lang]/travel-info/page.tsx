import type { Metadata } from 'next';
import { ExternalLink, ShieldCheck, Stamp } from 'lucide-react';
import { TRAVEL_LINKS } from '@rafrika/shared';
import { pageMeta } from '@/lib/seo';
import { getDictionary } from '@/i18n/dictionaries';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return pageMeta({ path: '/travel-info', title: t.travel.title, description: t.travel.intro });
}

// Visa and the mandatory inbound travel insurance, with links to the official government sites only.
export default async function TravelInfoPage() {
  const t = (await getDictionary()).travel;
  const link = 'inline-flex items-center gap-2 rounded-[5px] border-2 border-forest px-4 py-2.5 font-semibold text-forest hover:bg-mint';
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-extrabold">{t.title}</h1>
      <p className="mt-3 text-lg text-muted">{t.intro}</p>

      <section className="card mt-8 space-y-3" aria-labelledby="visa">
        <h2 id="visa" className="flex items-center gap-2 text-2xl font-bold">
          <Stamp className="size-6 text-leaf-dark" aria-hidden /> {t.visaTitle}
        </h2>
        <p>{t.visaBody}</p>
        <a href={TRAVEL_LINKS.visa} className={link} target="_blank" rel="noopener" data-track="travel_visa">
          {t.visaLink} <ExternalLink className="size-4" aria-hidden />
        </a>
        <p className="text-sm text-muted">{t.visaWarn}</p>
      </section>

      <section className="card mt-6 space-y-3" aria-labelledby="insurance">
        <h2 id="insurance" className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="size-6 text-leaf-dark" aria-hidden /> {t.insuranceTitle}
        </h2>
        <p>{t.insuranceBody}</p>
        <p className="rounded-[5px] bg-mint p-3 font-semibold text-forest">{t.insuranceOne}</p>
        <div className="flex flex-wrap gap-3">
          <a href={TRAVEL_LINKS.mainland} className={link} target="_blank" rel="noopener" data-track="travel_insurance_mainland">
            {t.mainlandLink} <ExternalLink className="size-4" aria-hidden />
          </a>
          <a href={TRAVEL_LINKS.zanzibar} className={link} target="_blank" rel="noopener" data-track="travel_insurance_zanzibar">
            {t.zanzibarLink} <ExternalLink className="size-4" aria-hidden />
          </a>
        </div>
        <p className="text-sm">{t.proof}</p>
        <p className="text-sm text-muted">{t.insuranceExempt}</p>
      </section>

      <p className="mt-6 text-sm text-muted">
        {t.checkNote} {t.checked}.
      </p>
    </div>
  );
}
