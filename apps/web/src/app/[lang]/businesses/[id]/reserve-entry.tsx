import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { isNotAppliedError, isReservableType, reserveText } from '@kwetuly/shared';
import { createClient } from '@/lib/supabase/server';

// "Reserve" on restaurant, spa and salon pages (slice 2): shown when the business takes reservations.
// While the reservation columns are not on the database, the button is shown switched off with
// "opens soon". The form and the database check every other rule.
export async function ReserveEntry({ providerId, businessType, locale }: { providerId: string; businessType: string; locale: string }) {
  if (!isReservableType(businessType)) return null;
  const r = reserveText(locale);
  const supabase = await createClient();
  const { data, error } = await supabase.from('providers').select('takes_reservations').eq('id', providerId).maybeSingle<{ takes_reservations: boolean }>();
  const soon = isNotAppliedError(error);
  if (!soon && !data?.takes_reservations) return null;
  return (
    <section aria-labelledby="reserve-title" className="mt-6 space-y-3 rounded-[5px] border border-line bg-white p-4">
      <h2 id="reserve-title" className="flex items-center gap-2 text-lg font-bold">
        <CalendarClock className="size-5 text-leaf-dark" aria-hidden /> {r.reserve}
      </h2>
      <p className="text-sm text-muted">{r.reserveHint}</p>
      {soon ? (
        <>
          <button type="button" className="btn-outline w-full sm:w-auto" disabled aria-describedby="reserve-soon">{r.reserve}</button>
          <p id="reserve-soon" className="rounded-[5px] bg-sand p-3 text-sm font-semibold">{r.soon}</p>
        </>
      ) : (
        <Link href={`/${locale}/businesses/${providerId}/reserve`} className="btn-outline w-full sm:w-auto" data-track="business_reserve">{r.reserve}</Link>
      )}
    </section>
  );
}
