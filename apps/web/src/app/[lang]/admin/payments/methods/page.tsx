import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { METHOD_BADGES, METHOD_BADGE_NAMES, STORE_ITEM_TYPES, STORE_ROUTES, lipaAdminText, type LipaAdminText } from '@kwetuly/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/components/submit-button';
import { AdminMenu } from '../../admin-menu';
import { saveMethod, saveStorePolicy } from '../actions';

export const metadata: Metadata = { title: 'Payment methods', robots: { index: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;
type MethodRow = { id: string; display_name: string; methods: string[]; badges: string[]; status: string; sort: number; adapter_built: boolean; state_now: string };
const PLATFORMS = ['web', 'ios', 'android'] as const;

// The "Pay now" chooser's list (order, names, badges, live / coming soon / hidden) and the app-store
// rules. The server still decides what is live; this page only sets wishes and policy values.
export default async function PaymentMethodsPage({ searchParams }: { searchParams: Search }) {
  const locale = await getLocale();
  const a = lipaAdminText(locale);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <div className="min-w-0">
          <Link href={`/${locale}/admin/payments`} className="text-sm font-semibold text-forest underline">{a.menuQueue}</Link>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{a.methodsTitle}</h1>
          <Suspense fallback={<div aria-busy="true" className="mt-6 h-96 animate-pulse rounded-[5px] bg-line" />}>
            <Content locale={locale} a={a} searchParams={searchParams} />
          </Suspense>
        </div>
        <div className="lg:order-first lg:border-r lg:border-line lg:pr-6">
          <AdminMenu locale={locale} current={`/${locale}/admin/payments/methods`} />
        </div>
      </div>
    </div>
  );
}

async function Content({ locale, a, searchParams }: { locale: Locale; a: LipaAdminText; searchParams: Search }) {
  await requireAdmin(locale);
  const sp = await searchParams;
  const supabase = await createClient();
  const [methods, settings] = await Promise.all([
    supabase.rpc('admin_payment_methods'),
    supabase.from('site_settings').select('key, value').in('key', ['payments.store_policy', 'payments.store_flags']),
  ]);
  const rows = (methods.data ?? []) as MethodRow[];
  const byKey = Object.fromEntries(((settings.data ?? []) as { key: string; value: unknown }[]).map((s) => [s.key, s.value]));
  const policy = (byKey['payments.store_policy'] ?? {}) as Record<string, Record<string, string>>;
  const flags = (byKey['payments.store_flags'] ?? {}) as { show_coming_soon?: Record<string, boolean> };
  const err = typeof sp.e === 'string' && Object.hasOwn(a.errors, sp.e) ? a.errors[sp.e as keyof LipaAdminText['errors']] : '';
  const badgeName = (b: string) => (b === 'bank' ? a.networks.bank : METHOD_BADGE_NAMES[b as keyof typeof METHOD_BADGE_NAMES] ?? b);

  return (
    <div className="mt-4 space-y-10">
      {sp.ok === 'saved' && <p role="status" className="rounded-[5px] bg-mint p-3 font-semibold text-forest">{a.saved}</p>}
      {err && <p role="alert" className="rounded-[5px] bg-red-50 p-3 font-semibold text-red-800">{err}</p>}
      <p className="text-sm text-muted">{a.methodsIntro}</p>
      {methods.error && <p role="alert" className="card">{a.errors.failed}</p>}
      <ul className="space-y-4">
        {rows.map((r) => (
          <li key={r.id} className="card">
            <form action={saveMethod} className="grid gap-3 sm:grid-cols-4">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={r.id} />
              <p className="text-sm sm:col-span-4">
                <span className="font-mono font-bold">{r.id}</span> · {r.methods.join(', ')} · {a.adapter}: {r.adapter_built ? a.yes : a.no} · {a.stateNow}: <strong>{a.statuses[r.state_now as keyof LipaAdminText['statuses']] ?? r.state_now}</strong>
              </p>
              <label className="text-sm"><span className="block font-semibold">{a.displayName}</span>
                <input name="display_name" required minLength={2} maxLength={40} defaultValue={r.display_name} className="field" />
              </label>
              <label className="text-sm"><span className="block font-semibold">{a.statusLabel}</span>
                <select name="status" defaultValue={r.status} className="field">
                  {(['live', 'coming_soon', 'hidden'] as const).map((s) => <option key={s} value={s}>{a.statuses[s]}</option>)}
                </select>
              </label>
              <label className="text-sm"><span className="block font-semibold">{a.sort}</span>
                <input name="sort" type="number" min={0} max={99} defaultValue={r.sort} className="field" />
              </label>
              <fieldset className="text-sm sm:col-span-4">
                <legend className="font-semibold">{a.badges}</legend>
                <div className="mt-1 flex flex-wrap gap-3">
                  {METHOD_BADGES.map((b) => (
                    <label key={b} className="flex items-center gap-1"><input type="checkbox" name="badges" value={b} defaultChecked={r.badges.includes(b)} /> {badgeName(b)}</label>
                  ))}
                </div>
              </fieldset>
              <div className="sm:col-span-4"><SubmitButton className="btn-outline">{a.save}</SubmitButton></div>
            </form>
          </li>
        ))}
      </ul>

      <section className="card space-y-4" aria-labelledby="store">
        <h2 id="store" className="text-xl font-bold">{a.storeTitle}</h2>
        <p className="text-sm text-muted">{a.storeIntro}</p>
        <form action={saveStorePolicy} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr><th className="p-2" scope="col" />{PLATFORMS.map((p) => <th key={p} scope="col" className="p-2 font-semibold">{p}</th>)}</tr></thead>
              <tbody>
                {STORE_ITEM_TYPES.map((item) => (
                  <tr key={item} className="border-t border-line">
                    <th scope="row" className="p-2 font-mono font-normal">{item}</th>
                    {PLATFORMS.map((p) => (
                      <td key={p} className="p-2">
                        <select name={`${p}.${item}`} aria-label={`${item}, ${p}`} defaultValue={policy[p]?.[item] ?? (p === 'web' ? 'third_party_in_app' : 'not_offered')} className="field py-1.5">
                          {STORE_ROUTES.map((r) => <option key={r} value={r}>{a.routes[r]}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <fieldset>
            <legend className="font-semibold">{a.showComingSoon}</legend>
            <div className="mt-1 flex flex-wrap gap-4 text-sm">
              {PLATFORMS.map((p) => (
                <label key={p} className="flex items-center gap-1"><input type="checkbox" name={`csoon.${p}`} value="yes" defaultChecked={flags.show_coming_soon?.[p] ?? p === 'web'} /> {p}</label>
              ))}
            </div>
          </fieldset>
          <SubmitButton className="btn">{a.storeSave}</SubmitButton>
        </form>
      </section>
    </div>
  );
}
