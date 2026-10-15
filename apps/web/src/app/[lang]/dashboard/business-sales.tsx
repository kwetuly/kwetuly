import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { reportSale } from './business-actions';

type Sale = { id: string; code: string; guide_id: string | null; sale_date: string; amount_tzs: number; status: 'reported' | 'invoiced' | 'paid'; note: string | null };

// Sales the business made thanks to a guide's Rafrika referral code, and its commission agreement.
export async function BusinessSales({ providerId, t, locale, status }: { providerId: string; t: Dictionary; locale: Locale; status: Record<string, string | string[] | undefined> }) {
  const bt = t.business;
  const supabase = await createClient();
  const [{ data: agreement }, { data: sales }] = await Promise.all([
    supabase.from('business_agreements').select('rafrika_pct, guide_pct, active').eq('provider_id', providerId).maybeSingle<{ rafrika_pct: number; guide_pct: number; active: boolean }>(),
    supabase.from('referral_sales').select('id, code, guide_id, sale_date, amount_tzs, status, note').eq('provider_id', providerId).order('sale_date', { ascending: false }).limit(50).returns<Sale[]>(),
  ]);
  const money = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  return (
    <section id="sales" className="card mt-6 scroll-mt-24 space-y-4">
      <h2 className="text-lg font-bold">{bt.salesTitle}</h2>
      <p className="text-sm text-muted">{bt.salesBody}</p>
      <p className="rounded-[5px] bg-surface p-3 text-sm font-semibold">
        {agreement?.active
          ? bt.agreementShares.replace('{r}', String(Number(agreement.rafrika_pct))).replace('{g}', String(Number(agreement.guide_pct)))
          : bt.noAgreement}
      </p>
      {status.sale_saved && <p className="rounded-[5px] bg-mint p-3 font-semibold text-forest">{bt.saved}</p>}
      {status.sale_error && <p className="rounded-[5px] bg-red-50 p-3 text-red-800">{t.auth.error}</p>}
      <form action={reportSale} className="grid gap-3 sm:grid-cols-4">
        <input type="hidden" name="locale" value={locale} />
        <label className="block">
          <span className="label">{bt.codeField}</span>
          <input className="field uppercase" name="code" required pattern="[A-Za-z0-9]{6,10}" maxLength={10} autoCapitalize="characters" />
        </label>
        <label className="block">
          <span className="label">{bt.dateField}</span>
          <input className="field" name="sale_date" type="date" />
        </label>
        <label className="block">
          <span className="label">{bt.amountField}</span>
          <input className="field" name="amount_tzs" type="number" inputMode="numeric" min={1} step="1" required />
        </label>
        <label className="block">
          <span className="label">{bt.noteField}</span>
          <input className="field" name="note" maxLength={500} />
        </label>
        <button className="btn sm:col-span-4 sm:w-fit">{bt.reportSale}</button>
      </form>
      {(sales ?? []).length === 0 ? (
        <p className="text-sm text-muted">{bt.salesNone}</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {(sales ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="tabular-nums text-muted">{date.format(new Date(s.sale_date))}</span>
              <span className="font-mono font-semibold">{s.code}</span>
              {!s.guide_id && <span className="text-red-800">{bt.unknownCode}</span>}
              <span className="ml-auto tabular-nums font-semibold">TSh {money.format(Number(s.amount_tzs))}</span>
              <span className="badge">{bt.saleStatus[s.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
