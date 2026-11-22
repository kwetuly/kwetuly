import type { Locale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { markReservationCommission, resolveReservationDispute } from './reservation-actions';

// Admin only (the page calls requireAdmin first). Reservation commission per business for one month,
// and the disputes waiting for a decision. Kwetuly charges nobody from this page; while the billing
// switch is off every statement is "for information, no charge" and the database refuses
// "invoiced" and "paid". Admin texts are English only.

type MonthRow = {
  provider_id: string | null;
  business_name: string;
  completed: number;
  held: number;
  no_show: number;
  commission_owed_tzs: number;
  commission_invoiced_tzs: number;
  commission_paid_tzs: number;
  commission_waived_tzs: number;
  guide_share_tzs: number;
  billing_on: boolean;
};
type Dispute = {
  id: string;
  business_name: string;
  starts_at: string;
  party_size: number;
  came_count: number | null;
  status: string;
  traveller_said_happened: boolean | null;
  commission_tzs: number | null;
};

const OK_TEXT: Record<string, string> = {
  invoiced: 'Marked invoiced.',
  paid: 'Marked paid.',
  waived: 'Marked waived. Nothing is owed for these reservations.',
  resolved: 'Decision saved. The commission follows it.',
};
const ERROR_TEXT: Record<string, string> = {
  billing_off: 'Billing is off: statements are for information only, so nothing can be marked invoiced or paid.',
  month_open: 'This month is not finished yet.',
  no_dispute: 'This dispute was already decided.',
  not_admin: 'Only admins with two-step sign-in can do this.',
  confirm: 'Tick the box to confirm first.',
  failed: 'That did not work. Please try again.',
};

const tzs = (n: number) => `TSh ${Math.round(n).toLocaleString('en-US')}`;
const pick = (table: Record<string, string>, key: unknown) =>
  typeof key === 'string' && Object.hasOwn(table, key) ? table[key] : '';

export async function ReservationCommissions({ locale, month, params }: {
  locale: Locale;
  month: string;
  params: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createClient();
  const [monthRows, billing, disputes] = await Promise.all([
    supabase.rpc('admin_reservation_commission_month', { p_month: `${month}-01` }),
    supabase.rpc('reservation_billing_on'),
    supabase
      .from('reservations')
      .select('id, business_name, starts_at, party_size, came_count, status, traveller_said_happened, commission_tzs')
      .not('disputed_at', 'is', null)
      .is('dispute_resolved_at', null)
      .order('starts_at')
      .limit(50),
  ]);
  const ok = pick(OK_TEXT, params.rok);
  const error = pick(ERROR_TEXT, params.rerr);

  if (monthRows.error) {
    return (
      <section id="reservation-commission" className="mt-12 card space-y-2">
        <h2 className="text-2xl font-bold">Reservations</h2>
        <p className="text-muted">Reservation commission could not be loaded. If the reservations migration is not on this database yet, this is expected.</p>
      </section>
    );
  }
  const rows = (monthRows.data ?? []) as MonthRow[];
  const billingOn = billing.data === true;
  const list = (disputes.data ?? []) as Dispute[];
  const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam', dateStyle: 'medium', timeStyle: 'short' });

  return (
    <section id="reservation-commission" className="mt-12 space-y-4">
      <h2 className="text-2xl font-bold">Reservations</h2>
      {!billingOn && (
        <p className="rounded-[5px] bg-sand p-3 font-semibold">For information, no charge. Billing is off: businesses are not invoiced for reservations.</p>
      )}
      <p className="text-sm text-muted">
        Commission is counted only for reservations that took place. Declined, cancelled, no-show and disputed reservations owe nothing.
        Guides&apos; shares are recorded only. Kwetuly never charges travellers.
      </p>
      {ok && <p role="status" className="rounded-[5px] bg-mint p-3 font-semibold text-forest">{ok}</p>}
      {error && <p role="alert" className="rounded-[5px] bg-red-50 p-3 font-semibold text-red-800">{error}</p>}

      {rows.length === 0 && <p className="text-muted">No reservations took place this month.</p>}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.provider_id ?? r.business_name} className="card space-y-2">
            <h3 className="text-lg font-bold">{r.business_name}</h3>
            <p className="text-sm">
              {r.completed} took place · {r.no_show} did not come{r.held > 0 ? ` · ${r.held} held (disputed)` : ''}
            </p>
            <p className="text-sm">
              Owed {tzs(r.commission_owed_tzs)} · invoiced {tzs(r.commission_invoiced_tzs)} · paid {tzs(r.commission_paid_tzs)}
              {r.commission_waived_tzs > 0 ? ` · waived ${tzs(r.commission_waived_tzs)}` : ''} · guides&apos; shares {tzs(r.guide_share_tzs)}
            </p>
            {r.provider_id && (
              <form action={markReservationCommission} className="flex flex-wrap items-center gap-2 pt-1">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="provider_id" value={r.provider_id} />
                <input type="hidden" name="month" value={month} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="confirm" value="yes" required />
                  <span>I checked this month for {r.business_name}</span>
                </label>
                <button name="to" value="invoiced" className="btn-outline px-3 py-1.5 text-sm" disabled={!billingOn}>Mark invoiced</button>
                <button name="to" value="paid" className="btn px-3 py-1.5 text-sm" disabled={!billingOn}>Mark paid</button>
                <button name="to" value="waived" className="btn-outline px-3 py-1.5 text-sm">Waive</button>
              </form>
            )}
          </li>
        ))}
      </ul>

      <div id="reservation-disputes" className="card space-y-3">
        <h3 className="font-bold">Disputes waiting ({list.length})</h3>
        {list.length === 0 ? (
          <p className="text-sm text-muted">No disputes.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {list.map((d) => (
              <li key={d.id} className="space-y-1">
                <p>
                  {d.business_name} · {when(d.starts_at)} · {d.party_size} booked · business: {d.status === 'completed' ? `came (${d.came_count ?? d.party_size})` : 'did not come'} ·
                  traveller: {d.traveller_said_happened ? 'it happened' : 'it did not happen'}
                </p>
                <form action={resolveReservationDispute} className="flex flex-wrap gap-2">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="month" value={month} />
                  <input type="hidden" name="reservation_id" value={d.id} />
                  <button name="outcome" value="completed" className="btn-outline px-3 py-1.5 text-sm">It took place</button>
                  <button name="outcome" value="no_show" className="btn-outline px-3 py-1.5 text-sm">It did not take place</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
