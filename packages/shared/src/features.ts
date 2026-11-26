// Every feature switch Kwetuly has. One site_settings row feature.<id> per entry, value
// {"on": bool, "legal": "pending"|"cleared"|"none", "legal_checked_on": "YYYY-MM-DD"|null, "team_only": bool}
// read by private.feature_on(id) (a missing row is off: fail closed). Seeded by
// supabase/migrations/20261031214101_feature_switches.sql, 20261122300000_reservations.sql and
// 20261126000000_feature_switch_admin.sql. Design: docs/team/design-2026-11-24.md section 2.
//
// The legal question text lives here, not in the database, so a code review sees every change to it.
// The questions are for the advocate (docs/legal); none of them is an answer. Whether a check is still
// pending or cleared is stored on the row ("legal"), because Walter changes that on /admin/features.
//
// Other slices add their id by a one-line change to FEATURES plus a seed row in their own migration
// (packages/shared/src/features.test.ts checks both). Names: English for Walter and Kiswahili (draft for
// native-speaker review).

export type FeaturePart = 'existing' | 'A' | 'B' | 'profile' | 'role' | 'service' | 'marketplace';
export type FeatureLegal = 'pending' | 'cleared' | 'none';
export type FeatureLocale = 'en' | 'sw';

export type FeatureDef = {
  id: string;
  part: FeaturePart;
  name: Record<FeatureLocale, string>;
  /** Seeded with "legal": "pending" and shown with the "Legal check pending" tag. */
  legalPending: boolean;
  /** The question for the advocate (English). Set when legalPending is true. */
  legalQuestion: string | null;
  /** Where the item comes from on docs/team/board.md. */
  boardRef: string;
  /** Never switched on from the admin page (the database refuses it too). */
  lockedOff?: true;
  /** Not listed on the admin page. Unused today; kept for a switch Walter wants out of sight. */
  hidden?: true;
};

/** Same pattern as the site_settings_feature_shape check in the database. */
export const FEATURE_ID_PATTERN = /^[a-z][a-z0-9_]{1,40}$/;

/** Switches the admin page and the database never turn on (payments go live only by Walter's own SQL). */
export const LOCKED_OFF_FEATURES = ['payments_live'] as const;

export const FEATURE_PARTS: { id: FeaturePart; name: Record<FeatureLocale, string> }[] = [
  { id: 'existing', name: { en: 'Already on the site', sw: 'Tayari kwenye tovuti' } },
  { id: 'A', name: { en: 'Part A: build now', sw: 'Sehemu A: kujenga sasa' } },
  { id: 'profile', name: { en: 'Profiles', sw: 'Wasifu' } },
  { id: 'role', name: { en: 'Roles and sign-up', sw: 'Majukumu na usajili' } },
  { id: 'service', name: { en: 'Services on a guide profile', sw: 'Huduma kwenye wasifu wa mwongoza watalii' } },
  { id: 'marketplace', name: { en: 'Marketplace', sw: 'Soko' } },
  { id: 'B', name: { en: 'Part B: partners and money', sw: 'Sehemu B: washirika na fedha' } },
];

const f = (
  id: string,
  part: FeaturePart,
  en: string,
  sw: string,
  boardRef: string,
  legalQuestion: string | null = null,
  extra: Pick<FeatureDef, 'lockedOff' | 'hidden'> = {},
): FeatureDef => ({ id, part, name: { en, sw }, legalPending: legalQuestion !== null, legalQuestion, boardRef, ...extra });

export const FEATURES: readonly FeatureDef[] = [
  // Existing rows (20261031214101_feature_switches.sql, 20261122300000_reservations.sql)
  f('experiences', 'existing', 'Experiences', 'Shughuli za kitalii', '2026-10-31'),
  f('stories', 'existing', 'Stories (videos and podcasts)', 'Hadithi (video na podikasti)', '2026-10-31'),
  f('proposals', 'existing', 'Trip proposals', 'Mapendekezo ya safari', '2026-10-31'),
  f('ai_drafts', 'existing', 'AI writing help (drafts)', 'Msaada wa AI kuandika rasimu', '2026-10-31'),
  f('ai_assistant', 'existing', 'AI assistant', 'Msaidizi wa AI', '2026-10-31'),
  f('teams', 'existing', 'Guide teams', 'Timu za waongoza watalii', '2026-10-31'),
  f('projects', 'existing', 'Projects', 'Miradi', '2026-10-31'),
  f('training_plans', 'existing', 'Training plans', 'Mipango ya mazoezi', '2026-10-31'),
  f('footage', 'existing', 'Trip footage', 'Video za safari', '2026-10-31'),
  f('reservation_commission_billing', 'existing', 'Reservation commission billing', 'Ankara za kamisheni ya nafasi', '2026-11-22 reservations'),
  f('spa_reservations', 'existing', 'Spa and massage reservations', 'Kuweka nafasi spa na masaji', '2026-11-26 legal check pending list',
    'Which licence spa and massage premises need, and what Kwetuly must check before a business takes reservations (licensed premises, adults, no home visits).'),

  // Part A
  f('booking_link', 'A', 'My booking link (A5)', 'Kiungo changu cha kuweka nafasi (A5)', 'A5'),
  f('family_updates', 'A', 'Family updates during the trip (A10)', 'Taarifa kwa familia wakati wa safari (A10)', 'A10',
    'Consent and data rules for sharing a traveller\'s trip updates with family by link (who sees what, how long the link lives).'),
  f('academy', 'A', 'Guide academy and stories (A13)', 'Mafunzo na hadithi za waongoza watalii (A13)', 'A13',
    'Written consent of every person filmed or photographed for lessons and stories, and how long it lasts.'),
  f('guide_invites', 'A', 'Invite links for guides and crew (A6)', 'Viungo vya mwaliko kwa waongoza watalii na wafanyakazi (A6)', 'A6'),
  f('google_checklist', 'A', 'Google Business Profile checklist (A1)', 'Orodha ya Google Business Profile (A1)', 'A1'),
  f('destination_pages', 'A', 'Destination and price pages (A2)', 'Kurasa za vivutio na bei (A2)', 'A2'),
  f('rate_card', 'A', 'Rate card for guides (A3)', 'Orodha ya bei za mwongoza watalii (A3)', 'A3'),
  f('verified_reviews', 'A', 'Verified reviews (A4)', 'Maoni yaliyothibitishwa (A4)', 'A4'),
  f('quote_pdf', 'A', 'Itinerary and quote PDF (A7)', 'PDF ya ratiba na bei (A7)', 'A7'),
  f('availability', 'A', 'Availability calendar (A8)', 'Kalenda ya nafasi (A8)', 'A8'),
  f('refund_rules', 'A', 'Cancellation and refund rules (A9)', 'Masharti ya kughairi na kurudishiwa pesa (A9)', 'A9'),
  f('safety_basics', 'A', 'Safety basics (A10)', 'Misingi ya usalama (A10)', 'A10',
    'Liability for safety information and emergency numbers shown to travellers, and the consented share link.'),
  f('trip_planner', 'A', 'Trip planner (A11)', 'Mpangaji wa safari (A11)', 'A11'),
  f('group_matching', 'A', 'Group matching for solo travellers (A12)', 'Kuunganisha wasafiri wa peke yao (A12)', 'A12'),
  f('farm_page', 'A', 'Farm, village and cooking page (A14)', 'Ukurasa wa shamba, kijiji na mapishi (A14)', 'A14'),
  f('price_alerts', 'A', 'Price alerts and low-season deals (A16)', 'Taarifa za bei na ofa za msimu wa chini (A16)', 'A16',
    'Marketing consent for price alert sign-ups (how consent is asked, kept and withdrawn).'),
  f('offline_web', 'A', 'Offline on the website (A17)', 'Tovuti bila intaneti (A17)', 'A17'),

  // Profiles
  f('cover_gallery', 'profile', 'Cover photo and gallery', 'Picha ya juu na mkusanyiko wa picha', 'RP5'),
  f('photo_share', 'profile', 'Share a photo as a story', 'Shiriki picha kama hadithi', 'RP6'),
  f('profile_links', 'profile', 'Profile links (Google, YouTube, website)', 'Viungo vya wasifu (Google, YouTube, tovuti)', 'RP3'),
  f('local_prices', 'profile', 'Estimated price in the visitor\'s currency', 'Makadirio ya bei kwa sarafu ya mgeni', 'decision 7'),
  f('park_rules', 'profile', 'Park rules acceptance', 'Kukubali sheria za hifadhi', '2026-11-24 Walter statements'),
  f('library_picks', 'profile', 'Trips from the trip library on the profile', 'Safari kutoka maktaba kwenye wasifu', 'RP7'),

  // Roles and sign-up
  f('vip_hosts', 'role', 'VIP hosts (concierge) sign-up', 'Usajili wa wenyeji wa wageni maalum (VIP)', 'W1-3',
    'Which licence a VIP host needs and what the service may include (docs/legal/vip-and-investment-hosts.md).'),
  f('investment_hosts', 'role', 'Investment visit hosts sign-up', 'Usajili wa wenyeji wa ziara za uwekezaji', 'W1-3',
    'Which licence an investment visit host needs, and how to keep it logistics only, never advice (docs/legal/vip-and-investment-hosts.md).'),
  f('crew_accounts', 'role', 'Crew accounts', 'Akaunti za wafanyakazi', 'RP9',
    'Porter employment, minimum wage and the 18+ rule; whether guides vouching for porters is allowed and enough.'),
  f('crew_porter', 'role', 'Crew: porters', 'Wafanyakazi: wapagazi', 'RP9',
    'Porter ID from an NGO as proof (Walter\'s statement, to confirm), employment and park rules for porters.'),
  f('crew_cook', 'role', 'Crew: cooks', 'Wafanyakazi: wapishi', 'RP9',
    'Employment rules and any food handling certificate for trip cooks.'),
  f('crew_camp_crew', 'role', 'Crew: camp crew', 'Wafanyakazi: wahudumu wa kambi', 'RP9',
    'Employment rules for camp crew.'),
  f('crew_driver', 'role', 'Crew: drivers', 'Wafanyakazi: madereva', 'RP9',
    'Which driving licence class and transport licence a driver needs.'),
  f('crew_assistant_guide', 'role', 'Crew: assistant guides', 'Wafanyakazi: waongoza watalii wasaidizi', 'RP9',
    'Whether an assistant guide needs a guide licence, and from which body (TTB or TANAPA).'),
  f('crew_other', 'role', 'Crew: other roles', 'Wafanyakazi: majukumu mengine', 'RP9',
    'Employment rules for other crew roles.'),
  f('driver_guide', 'role', 'Driver guides', 'Waongoza watalii madereva', 'RP8',
    'Which driving licence class a driver guide needs (Walter says class C, to verify) and whether driving guests needs a transport licence.'),
  f('hotel_reps', 'role', 'Hotel representative seats', 'Nafasi za wawakilishi wa hoteli', 'RP10',
    'Who is responsible for what a hotel representative says or agrees on the hotel\'s behalf.'),

  // Services on a guide profile
  f('service_consultant', 'service', 'Consultant calls', 'Simu za ushauri', 'RP8, RP11',
    'Whether paid travel advice by call needs a licence.'),
  f('service_concierge', 'service', 'Concierge (VIP host) service', 'Huduma ya mwenyeji wa wageni maalum', 'RP8',
    'Which licence a guide needs to offer a VIP host service (docs/legal/vip-and-investment-hosts.md).'),
  f('service_trip_runner', 'service', 'Trip runners', 'Waratibu wa safari', 'RP11',
    'Whether running a trip for others counts as tour operating (MNRT or TALA licence).'),
  f('service_photographer', 'service', 'Photographers', 'Wapiga picha', 'RP11',
    'Consent for people in photos, and any filming permit in parks.'),
  f('service_translator', 'service', 'Translators', 'Wakalimani', 'RP11',
    'Whether interpreting for travellers needs a licence or permit.'),

  // Marketplace
  f('marketplace', 'marketplace', 'Marketplace', 'Soko', '2026-11-26 Marketplace',
    'Selling used goods and rentals, banned goods (wildlife products, gemstones), seller identity and commission disclosure.'),
  f('marketplace_rentals', 'marketplace', 'Marketplace rentals', 'Kukodisha kwenye soko', '2026-11-26 Marketplace',
    'Consumer rules for rentals and the deposit note (Kwetuly holds no deposit).'),
  f('marketplace_checkout', 'marketplace', 'Marketplace checkout', 'Kulipia kwenye soko', '2026-11-26 Marketplace',
    'Taking payment for goods sold by others (needs B1 split settlement first).'),

  // Part B
  f('payments_live', 'B', 'Live payments (money gate)', 'Malipo halisi (lango la fedha)', 'B1', null, { lockedOff: true }),
  f('save_to_travel', 'B', 'Save to travel (B5)', 'Weka akiba kwa safari (B5)', 'B5',
    'Is saving money toward a trip a savings or e-money product that needs a BoT licence (2026-11-24 decision 9 had dropped it)?'),
  f('payments_manual', 'B', 'Manual payments to a Lipa number', 'Malipo ya mkono kwa namba ya Lipa', 'payments-engineer 2026-11-26',
    'Taking traveller payments to a Lipa number before company registration: who holds the money, BoT rules, receipts and refunds.'),
  f('split_settlement', 'B', 'Split settlement (B1)', 'Mgawanyo wa malipo (B1)', 'B1',
    'Does a split through a licensed partner mean Kwetuly holds no funds (BoT)? Needs company registration and a live merchant account.'),
  f('mobile_money', 'B', 'Mobile money (B2)', 'Pesa kwa simu (B2)', 'B2',
    'Currency display and exchange-rate wording rules for mobile money payments.'),
  f('tips', 'B', 'Tips to the guide by QR (B3)', 'Bakshishi kwa mwongoza watalii kwa QR (B3)', 'B3',
    'Is a tipping QR with no fee and no holding outside payment rules; privacy of the guide\'s number.'),
  f('crew_payouts', 'B', 'Crew payouts through the partner (B4)', 'Malipo kwa wafanyakazi kupitia mshirika (B4)', 'B4',
    'Minimum wage order, employer status and payout licence.'),
  f('instalments', 'B', 'Pay little by little for a booked trip (B5)', 'Kulipa kidogo kidogo kwa safari iliyowekwa (B5)', 'B5',
    'Instalments on one booked trip versus a savings product (BoT).'),
  f('insurance_rescue', 'B', 'Rescue and insurance cover (B6)', 'Uokoaji na bima (B6)', 'B6',
    'TIRA licence of the partner and Kwetuly\'s role (agent or referral).'),
  f('meet_and_greet', 'B', 'Airport meet and greet (B7)', 'Kupokelewa uwanja wa ndege (B7)', 'B7',
    'MNRT transport licence; no airport pickup booking while transfers are off (2026-11-22 decision 9).'),
  f('transfers_driving', 'B', 'Transfers by car (B7)', 'Usafiri wa kupelekwa kwa gari (B7)', 'B7',
    'MNRT transport licence for transfers.'),
  f('sim_listings', 'B', 'eSIM and SIM partners (B8)', 'Washirika wa eSIM na laini za simu (B8)', 'B8',
    'Telco and eSIM terms, consumer rules, commission disclosure.'),
  f('operator_channel', 'B', 'Foreign tour operator channel (B9)', 'Njia ya kampuni za utalii za nje (B9)', 'B9',
    'Commission contract and the MNRT rule for foreign sellers.'),
  f('ship_home', 'B', 'Courier for souvenirs (B10)', 'Kutuma zawadi nyumbani (B10)', 'B10',
    'Customs and export rules, banned goods (wildlife, gemstones).'),
  f('corporate_groups', 'B', 'Corporate and school groups (B11)', 'Vikundi vya makampuni na shule (B11)', 'B11',
    'Group and conference terms, minors\' safeguarding.'),
  f('jobs_contact_fees', 'B', 'Jobs board contact fees (B12)', 'Ada za mawasiliano kwenye kazi (B12)', 'B12',
    'Is charging for job contacts a placement fee; never paid by the job seeker.'),
  f('crew_verification_fees', 'B', 'Crew verification fees (B12)', 'Ada za uhakiki wa wafanyakazi (B12)', 'B12',
    'Who may be charged for crew verification (the vouching guide or operator, not the porter) and the legal hold on job-seeker fees.'),
];

export const FEATURE_IDS: readonly string[] = FEATURES.map((x) => x.id);

const BY_ID = new Map(FEATURES.map((x) => [x.id, x]));

export function featureDef(id: string): FeatureDef | undefined {
  return BY_ID.get(id);
}

export function featureName(id: string, locale: string): string {
  const def = BY_ID.get(id);
  if (!def) return id;
  return locale === 'sw' ? def.name.sw : def.name.en;
}

export function isLockedOff(id: string): boolean {
  return (LOCKED_OFF_FEATURES as readonly string[]).includes(id);
}

/** One switch as stored in site_settings (feature.<id>). */
export type FeatureState = { on: boolean; legal: FeatureLegal; legalCheckedOn: string | null; teamOnly: boolean };
export type FeatureMap = Record<string, FeatureState>;

/**
 * Turns site_settings rows into a map of switches. Rows that are not feature switches, or have a broken
 * value, are left out, so they read as off (fail closed, like private.feature_on).
 */
export function parseFeatureRows(rows: readonly { key: string; value: unknown }[] | null | undefined): FeatureMap {
  const map: FeatureMap = {};
  for (const row of rows ?? []) {
    if (!row.key.startsWith('feature.')) continue;
    const id = row.key.slice('feature.'.length);
    if (!FEATURE_ID_PATTERN.test(id)) continue;
    const v = row.value as Record<string, unknown> | null;
    if (!v || typeof v !== 'object' || typeof v.on !== 'boolean') continue;
    const legal = v.legal === 'pending' || v.legal === 'cleared' ? v.legal : 'none';
    const checked = typeof v.legal_checked_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.legal_checked_on) ? v.legal_checked_on : null;
    map[id] = { on: v.on, legal, legalCheckedOn: checked, teamOnly: v.team_only === true };
  }
  return map;
}

/** Same as private.feature_on: true only when the row exists and says on. */
export function isFeatureOn(map: FeatureMap, id: string): boolean {
  return map[id]?.on === true;
}

/** Same as private.feature_visible: on for everyone, or a team-only preview for admins. */
export function isFeatureVisible(map: FeatureMap, id: string, isAdmin: boolean): boolean {
  const s = map[id];
  return !!s && (s.on || (s.teamOnly && isAdmin));
}
