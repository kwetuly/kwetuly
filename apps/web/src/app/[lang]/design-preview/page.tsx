import type { Metadata } from 'next';
import { SAMPLE_DATA, ds, formatDateSpan } from '@rafrika/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { BidCard } from '@/components/market/bid-card';
import { EscrowRow } from '@/components/market/escrow-row';
import { ProviderHeader } from '@/components/market/provider-header';
import { TripRequestCard } from '@/components/market/trip-request-card';
import { UI, displayFont, uiFont } from '@/components/market/fonts';
import { Label } from '@/components/market/parts';

// Review page for the four marketplace components, built with SAMPLE_DATA. Delete before launch.
export const metadata: Metadata = { title: 'Component preview', robots: { index: false, follow: false } };

const { color, space } = ds;

export default async function DesignPreviewPage() {
  const t = await getDictionary();
  const m = t.market;
  const s = SAMPLE_DATA;
  const route = `${s.request.from} → ${s.request.to}`;

  return (
    <div className={`${uiFont.variable} ${displayFont.variable}`} style={{ background: color.paper, color: color.ink, fontFamily: UI }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: `${space.s32}px ${space.s16}px ${space.s48}px`, display: 'grid', gap: space.s32 }}>
        <section style={{ display: 'grid', gap: space.s12 }}>
          <Label>Trip request card</Label>
          <TripRequestCard {...s.request} bidCount={s.bids.length} bestPrice={Math.min(...s.bids.map((b) => b.price))} labels={m} />
          <TripRequestCard from="Moshi" to="Materuni" start="2026-10-20" people={2} bidCount={0} labels={m} />
        </section>

        <section style={{ display: 'grid', gap: space.s12 }}>
          <Label>Bid card</Label>
          {s.bids.map((bid) => (
            <BidCard key={bid.tier} provider={s.provider.name} verified={s.provider.verified} city={s.provider.city} {...bid} labels={m} />
          ))}
        </section>

        <section style={{ display: 'grid', gap: space.s12 }}>
          <Label>Escrow row</Label>
          <div>
            <EscrowRow date={s.escrow.date} trip={route} counterparty={s.provider.name} amount={s.escrow.amount} status="held" releaseDate={s.escrow.releaseDate} labels={m} />
            <EscrowRow date="2026-09-02" trip="Arusha → Tarangire" counterparty={s.provider.name} amount={420000} status="released" labels={m} />
            <EscrowRow date="2026-08-21" trip="Moshi → Marangu" counterparty={s.provider.name} amount={150000} status="refunded" labels={m} />
          </div>
        </section>

        <section style={{ display: 'grid', gap: space.s12 }}>
          <Label>Provider header</Label>
          <ProviderHeader {...s.provider} labels={m} />
        </section>

        <p style={{ fontSize: 12, color: color.inkSoft }}>SAMPLE_DATA · {s.traveller.name}, {s.traveller.city} · {formatDateSpan(s.request.start, s.request.end)}</p>
      </div>
    </div>
  );
}
