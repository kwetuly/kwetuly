import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';

type Sale = { id: string; sale_date: string; amount_tzs: number; status: 'reported' | 'invoiced' | 'paid'; providers: { business_name: string } | null };

// The guide's personal referral code and the sales businesses recorded with it.
export async function GuideReferral({ approved, t, locale }: { approved: boolean; t: Dictionary; locale: Locale }) {
  const bt = t.business;
  if (!approved) {
    return (
      <section className="card mt-6">
        <h2 className="text-lg font-bold">{bt.referralTitle}</h2>
        <p className="mt-2 text-sm text-muted">{bt.referralPending}</p>
      </section>
    );
  }
  const supabase = await createClient();
  const [{ data: code }, { data: sales }] = await Promise.all([
    supabase.rpc('my_referral_code'),
    supabase.from('referral_sales').select('id, sale_date, amount_tzs, status, providers(business_name)').order('sale_date', { ascending: false }).limit(30).returns<Sale[]>(),
  ]);
  const money = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <section className="card mt-6 space-y-3">
      <h2 className="text-lg font-bold">{bt.referralTitle}</h2>
      {code && <p className="w-fit rounded-[5px] bg-mint px-4 py-2 font-mono text-2xl font-extrabold tracking-widest text-forest">{code as string}</p>}
      <p className="text-sm text-muted">{bt.referralBody}</p>
      <h3 className="pt-2 text-sm font-semibold">{bt.referralSales}</h3>
      {(sales ?? []).length === 0 ? (
        <p className="text-sm text-muted">{bt.referralNone}</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {(sales ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="tabular-nums text-muted">{date.format(new Date(s.sale_date))}</span>
              <span className="font-semibold">{s.providers?.business_name}</span>
              <span className="ml-auto tabular-nums">TSh {money.format(Number(s.amount_tzs))}</span>
              <span className="badge">{bt.saleStatus[s.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
