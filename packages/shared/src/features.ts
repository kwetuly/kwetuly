// Every feature switch Kwetuly has. One public site_settings row feature.<id> per entry, value
// {"on": true|false} and nothing else, read by private.feature_on(id) (a missing row is off: fail
// closed). The legal state and the team preview are admin-only data in private.feature_switch_meta.
// Seeded by supabase/migrations/20261031214101_feature_switches.sql, 20261122300000_reservations.sql and
// 20261126000000_feature_switch_admin.sql. Design: docs/team/design-2026-11-24.md section 2.
//
// This file is public (website, app, every bundle): ids, names, groups and the lock only. Which features
// wait for a legal check, the advocate's questions and board references are admin-only: ./admin/features-admin.ts, imported only
// by the server-side admin page, never through the @kwetuly/shared barrel.
//
// Other slices add their id by a one-line change to FEATURES, an entry in ./admin/features-admin.ts and a
// seed row in their own migration (packages/shared/src/features.test.ts checks all three). Names: English
// and Kiswahili (draft for native-speaker review).

export type FeaturePart = 'existing' | 'A' | 'B' | 'profile' | 'role' | 'service' | 'marketplace';
export type FeatureLocale = 'en' | 'sw';

export type FeatureDef = {
  id: string;
  part: FeaturePart;
  name: Record<FeatureLocale, string>;
  /** Never switched on from the admin page (the database refuses it too). */
  lockedOff?: true;
  /** Not listed on the admin page. Unused today. */
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
  extra: Pick<FeatureDef, 'lockedOff' | 'hidden'> = {},
): FeatureDef => ({ id, part, name: { en, sw }, ...extra });

export const FEATURES: readonly FeatureDef[] = [
  f('experiences', 'existing', 'Experiences', 'Shughuli za kitalii'),
  f('stories', 'existing', 'Stories (videos and podcasts)', 'Hadithi (video na podikasti)'),
  f('proposals', 'existing', 'Trip proposals', 'Mapendekezo ya safari'),
  f('ai_drafts', 'existing', 'AI writing help (drafts)', 'Msaada wa AI kuandika rasimu'),
  f('ai_assistant', 'existing', 'AI assistant', 'Msaidizi wa AI'),
  f('teams', 'existing', 'Guide teams', 'Timu za waongoza watalii'),
  f('projects', 'existing', 'Projects', 'Miradi'),
  f('training_plans', 'existing', 'Training plans', 'Mipango ya mazoezi'),
  f('footage', 'existing', 'Trip footage', 'Video za safari'),
  f('reservation_commission_billing', 'existing', 'Reservation commission billing', 'Ankara za kamisheni ya nafasi'),
  f('spa_reservations', 'existing', 'Spa and massage reservations', 'Kuweka nafasi spa na masaji'),
  f('booking_link', 'A', 'My booking link (A5)', 'Kiungo changu cha kuweka nafasi (A5)'),
  f('family_updates', 'A', 'Family updates during the trip (A10)', 'Taarifa kwa familia wakati wa safari (A10)'),
  f('academy', 'A', 'Guide academy and stories (A13)', 'Mafunzo na hadithi za waongoza watalii (A13)'),
  f('guide_invites', 'A', 'Invite links for guides and crew (A6)', 'Viungo vya mwaliko kwa waongoza watalii na wafanyakazi (A6)'),
  f('google_checklist', 'A', 'Google Business Profile checklist (A1)', 'Orodha ya Google Business Profile (A1)'),
  f('destination_pages', 'A', 'Destination and price pages (A2)', 'Kurasa za vivutio na bei (A2)'),
  f('rate_card', 'A', 'Rate card for guides (A3)', 'Orodha ya bei za mwongoza watalii (A3)'),
  f('verified_reviews', 'A', 'Verified reviews (A4)', 'Maoni yaliyothibitishwa (A4)'),
  f('quote_pdf', 'A', 'Itinerary and quote PDF (A7)', 'PDF ya ratiba na bei (A7)'),
  f('availability', 'A', 'Availability calendar (A8)', 'Kalenda ya nafasi (A8)'),
  f('refund_rules', 'A', 'Cancellation and refund rules (A9)', 'Masharti ya kughairi na kurudishiwa pesa (A9)'),
  f('safety_basics', 'A', 'Safety basics (A10)', 'Misingi ya usalama (A10)'),
  f('trip_planner', 'A', 'Trip planner (A11)', 'Mpangaji wa safari (A11)'),
  f('group_matching', 'A', 'Group matching for solo travellers (A12)', 'Kuunganisha wasafiri wa peke yao (A12)'),
  f('farm_page', 'A', 'Farm, village and cooking page (A14)', 'Ukurasa wa shamba, kijiji na mapishi (A14)'),
  f('price_alerts', 'A', 'Price alerts and low-season deals (A16)', 'Taarifa za bei na ofa za msimu wa chini (A16)'),
  f('offline_web', 'A', 'Offline on the website (A17)', 'Tovuti bila intaneti (A17)'),
  f('cover_gallery', 'profile', 'Cover photo and gallery', 'Picha ya jalada na mkusanyiko wa picha'),
  f('photo_share', 'profile', 'Share a photo as a story', 'Shiriki picha kama hadithi'),
  f('profile_links', 'profile', 'Profile links (Google, YouTube, website)', 'Viungo vya wasifu (Google, YouTube, tovuti)'),
  f('local_prices', 'profile', 'Estimated price in the visitor\'s currency', 'Makadirio ya bei kwa sarafu ya mgeni'),
  f('park_rules', 'profile', 'Park rules acceptance', 'Kukubali sheria za hifadhi'),
  f('library_picks', 'profile', 'Trips from the trip library on the profile', 'Safari kutoka maktaba kwenye wasifu'),
  f('vip_hosts', 'role', 'VIP hosts (concierge) sign-up', 'Usajili wa wenyeji wa wageni maalum (VIP)'),
  f('investment_hosts', 'role', 'Investment visit hosts sign-up', 'Usajili wa wenyeji wa ziara za uwekezaji'),
  f('crew_accounts', 'role', 'Crew accounts', 'Akaunti za wafanyakazi'),
  f('crew_porter', 'role', 'Crew: porters', 'Wafanyakazi: wapagazi'),
  f('crew_cook', 'role', 'Crew: cooks', 'Wafanyakazi: wapishi'),
  f('crew_camp_crew', 'role', 'Crew: camp crew', 'Wafanyakazi: wahudumu wa kambi'),
  f('crew_driver', 'role', 'Crew: drivers', 'Wafanyakazi: madereva'),
  f('crew_assistant_guide', 'role', 'Crew: assistant guides', 'Wafanyakazi: waongoza watalii wasaidizi'),
  f('crew_other', 'role', 'Crew: other roles', 'Wafanyakazi: majukumu mengine'),
  f('driver_guide', 'role', 'Driver guides', 'Waongoza watalii madereva'),
  f('hotel_reps', 'role', 'Hotel representative seats', 'Nafasi za wawakilishi wa hoteli'),
  f('service_consultant', 'service', 'Consultant calls', 'Simu za ushauri'),
  f('service_concierge', 'service', 'Concierge (VIP host) service', 'Huduma ya mwenyeji wa wageni maalum'),
  f('service_trip_runner', 'service', 'Trip runners', 'Waratibu wa safari'),
  f('service_photographer', 'service', 'Photographers', 'Wapiga picha'),
  f('service_translator', 'service', 'Translators', 'Wakalimani'),
  f('marketplace', 'marketplace', 'Marketplace', 'Soko'),
  f('marketplace_rentals', 'marketplace', 'Marketplace rentals', 'Kukodisha kwenye soko'),
  f('marketplace_checkout', 'marketplace', 'Marketplace checkout', 'Kulipia kwenye soko'),
  f('payments_live', 'B', 'Live payments (money gate)', 'Malipo halisi (lango la fedha)', { lockedOff: true }),
  f('save_to_travel', 'B', 'Save to travel (B5)', 'Weka akiba kwa safari (B5)'),
  f('payments_manual', 'B', 'Manual payments to a Lipa number', 'Malipo ya mkono kwa namba ya Lipa'),
  f('deposits_via_kwetuly_lipa', 'B', 'Trip deposits paid to the Kwetuly Lipa number', 'Amana za safari kulipwa kwa namba ya Lipa ya Kwetuly'),
  f('guide_verification_fees', 'B', 'Guide verification fees by Lipa number', 'Ada za uhakiki wa waongoza watalii kwa namba ya Lipa'),
  f('business_badge_fees', 'B', 'Business badge fees by Lipa number', 'Ada za beji ya biashara kwa namba ya Lipa'),
  f('split_settlement', 'B', 'Split settlement (B1)', 'Mgawanyo wa malipo (B1)'),
  f('mobile_money', 'B', 'Mobile money (B2)', 'Pesa kwa simu (B2)'),
  f('tips', 'B', 'Tips to the guide by QR (B3)', 'Bakshishi kwa mwongoza watalii kwa QR (B3)'),
  f('crew_payouts', 'B', 'Crew payouts through the partner (B4)', 'Malipo kwa wafanyakazi kupitia mshirika (B4)'),
  f('instalments', 'B', 'Pay little by little for a booked trip (B5)', 'Kulipa kidogo kidogo kwa safari iliyowekwa (B5)'),
  f('insurance_rescue', 'B', 'Rescue and insurance cover (B6)', 'Uokoaji na bima (B6)'),
  f('meet_and_greet', 'B', 'Airport meet and greet (B7)', 'Kupokelewa uwanja wa ndege (B7)'),
  f('transfers_driving', 'B', 'Transfers by car (B7)', 'Usafiri wa kupelekwa kwa gari (B7)'),
  f('sim_listings', 'B', 'eSIM and SIM partners (B8)', 'Washirika wa eSIM na laini za simu (B8)'),
  f('operator_channel', 'B', 'Foreign tour operator channel (B9)', 'Njia ya kampuni za utalii za nje (B9)'),
  f('ship_home', 'B', 'Courier for souvenirs (B10)', 'Kutuma zawadi nyumbani (B10)'),
  f('corporate_groups', 'B', 'Corporate and school groups (B11)', 'Vikundi vya makampuni na shule (B11)'),
  f('jobs_contact_fees', 'B', 'Jobs board contact fees (B12)', 'Ada za mawasiliano kwenye kazi (B12)'),
  f('crew_verification_fees', 'B', 'Crew verification fees (B12)', 'Ada za uhakiki wa wafanyakazi (B12)'),
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

/** Switch id to on/off, as stored in the public site_settings rows. */
export type FeatureMap = Record<string, boolean>;

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
    map[id] = v.on;
  }
  return map;
}

/** Same as private.feature_on: true only when the row exists and says on. */
export function isFeatureOn(map: FeatureMap, id: string): boolean {
  return map[id] === true;
}
