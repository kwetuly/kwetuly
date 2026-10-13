// SAMPLE_DATA — for building and reviewing the marketplace components only.
// Delete this file (and the preview screens that import it) before launch.
import type { EscrowStatus, Tier } from './design';

export const SAMPLE_DATA = {
  traveller: { name: 'Neema Lyimo', city: 'Dar es Salaam' },
  provider: {
    name: 'Kilimanjaro Road Services',
    verified: true, // NIDA verified
    city: 'Arusha',
    vehicle: 'Toyota Land Cruiser',
    plate: 'T 234 ABC',
  },
  request: {
    from: 'Arusha',
    to: 'Ngorongoro',
    start: '2026-10-14',
    end: '2026-10-16',
    people: 4,
    note: 'Need a pop-up roof. We have two large bags.',
  },
  bids: [
    { tier: 'regular' as Tier, price: 420000, includes: 'Noah, no guide, shared camp' },
    { tier: 'premium' as Tier, price: 610000, includes: 'Land Cruiser, guide, tented camp' },
    { tier: 'vip' as Tier, price: 980000, includes: 'Land Cruiser, private guide, lodge' },
  ],
  escrow: { amount: 610000, status: 'held' as EscrowStatus, releaseDate: '2026-10-17', date: '2026-10-14' },
};
