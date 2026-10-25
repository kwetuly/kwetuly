// The Tours section: Kwetuly Signature Trips and Operator Tours, shared by the website and the app.
// Labels are in the order en, sw, fr, it, de, pl, zh (see locales.ts). Keep the ids in sync with
// the enums and checks in supabase/migrations/20261015000000_tours.sql.

import { L, type Locale } from './locales';

export const TOUR_TYPES = [
  { id: 'signature', ...L('Signature Trip', 'Safari Maalum ya Kwetuly', 'Voyage Signature', 'Viaggio Signature', 'Signature-Reise', 'Podróż Signature', '招牌行程') },
  { id: 'operator', ...L('Operator Tour', 'Safari ya Kampuni', 'Circuit d’opérateur', 'Tour di operatore', 'Veranstalter-Tour', 'Wycieczka operatora', '运营商行程') },
] as const;
export type TourTypeId = (typeof TOUR_TYPES)[number]['id'];

// The five kinds of Tanzania trip people look for first.
export const TOUR_THEMES = [
  { id: 'safari', icon: 'binoculars', ...L('Safari & wildlife', 'Safari na wanyamapori', 'Safari & faune', 'Safari e fauna', 'Safari & Tierwelt', 'Safari i przyroda', '游猎与野生动物') },
  { id: 'mountain', icon: 'mountain', ...L('Mountains & hiking', 'Milima na matembezi', 'Montagnes & randonnées', 'Montagne e trekking', 'Berge & Wandern', 'Góry i wędrówki', '登山与徒步') },
  { id: 'coast', icon: 'sun', ...L('Zanzibar & beaches', 'Zanzibar na fukwe', 'Zanzibar & plages', 'Zanzibar e spiagge', 'Sansibar & Strände', 'Zanzibar i plaże', '桑给巴尔与海滩') },
  { id: 'cultural', icon: 'users', ...L('Culture & heritage', 'Utamaduni na urithi', 'Culture & patrimoine', 'Cultura e patrimonio', 'Kultur & Erbe', 'Kultura i dziedzictwo', '文化与遗产') },
  { id: 'combo', icon: 'route', ...L('Combination trips', 'Safari mchanganyiko', 'Voyages combinés', 'Viaggi combinati', 'Kombireisen', 'Podróże łączone', '组合行程') },
] as const;
export type TourThemeId = (typeof TOUR_THEMES)[number]['id'];

export const TRAVEL_STYLES = [
  { id: 'family', ...L('Family', 'Familia', 'En famille', 'Famiglia', 'Familie', 'Rodzinne', '家庭') },
  { id: 'honeymoon', ...L('Honeymoon', 'Fungate', 'Lune de miel', 'Luna di miele', 'Flitterwochen', 'Podróż poślubna', '蜜月') },
  { id: 'vip', ...L('VIP', 'VIP', 'VIP', 'VIP', 'VIP', 'VIP', 'VIP') },
  { id: 'solo', ...L('Solo travellers', 'Wasafiri pekee', 'Voyageurs solo', 'Viaggiatori singoli', 'Alleinreisende', 'Podróżujący solo', '独自旅行') },
  { id: 'photography', ...L('Photography', 'Upigaji picha', 'Photographie', 'Fotografia', 'Fotografie', 'Fotografia', '摄影') },
  { id: 'accessible', ...L('Accessible', 'Kwa wenye ulemavu', 'Accessible', 'Accessibile', 'Barrierearm', 'Dostępne', '无障碍') },
] as const;
export type TravelStyleId = (typeof TRAVEL_STYLES)[number]['id'];

export const ACCOMMODATION_LEVELS = [
  { id: 'budget', ...L('Budget', 'Bajeti nafuu', 'Économique', 'Economico', 'Budget', 'Budżetowe', '经济型') },
  { id: 'mid_range', ...L('Mid-range', 'Wastani', 'Milieu de gamme', 'Fascia media', 'Mittelklasse', 'Średnia klasa', '中档') },
  { id: 'luxury', ...L('Luxury', 'Anasa', 'Luxe', 'Lusso', 'Luxus', 'Luksusowe', '豪华') },
  { id: 'premium', ...L('Premium', 'Hadhi ya juu', 'Premium', 'Premium', 'Premium', 'Premium', '尊享') },
] as const;
export type AccommodationId = (typeof ACCOMMODATION_LEVELS)[number]['id'];

export const TOUR_GROUP_TYPES = [
  { id: 'private', ...L('Private trip', 'Safari binafsi', 'Voyage privé', 'Viaggio privato', 'Private Reise', 'Wyjazd prywatny', '私人行程') },
  { id: 'group', ...L('Group tour', 'Safari ya kikundi', 'Voyage en groupe', 'Viaggio di gruppo', 'Gruppenreise', 'Wyjazd grupowy', '团体游') },
  { id: 'private_or_group', ...L('Private or group', 'Binafsi au kikundi', 'Privé ou en groupe', 'Privato o di gruppo', 'Privat oder Gruppe', 'Prywatnie lub w grupie', '私人或团体') },
] as const;
export type TourGroupTypeId = (typeof TOUR_GROUP_TYPES)[number]['id'];

export const FITNESS_LEVELS = [
  { id: 'easy', ...L('Easy', 'Rahisi', 'Facile', 'Facile', 'Leicht', 'Łatwy', '轻松') },
  { id: 'moderate', ...L('Moderate', 'Wastani', 'Modéré', 'Moderato', 'Mittel', 'Umiarkowany', '中等') },
  { id: 'challenging', ...L('Challenging', 'Ngumu kiasi', 'Exigeant', 'Impegnativo', 'Anspruchsvoll', 'Wymagający', '有挑战') },
  { id: 'strenuous', ...L('Strenuous', 'Ngumu sana', 'Très difficile', 'Molto faticoso', 'Sehr anstrengend', 'Bardzo trudny', '高强度') },
] as const;
export type FitnessId = (typeof FITNESS_LEVELS)[number]['id'];

export const STOP_KINDS = [
  { id: 'town', ...L('Town', 'Mji', 'Ville', 'Città', 'Stadt', 'Miasto', '城镇') },
  { id: 'airport', ...L('Airport', 'Uwanja wa ndege', 'Aéroport', 'Aeroporto', 'Flughafen', 'Lotnisko', '机场') },
  { id: 'park', ...L('Park', 'Hifadhi', 'Parc', 'Parco', 'Park', 'Park', '公园') },
  { id: 'gate', ...L('Mountain gate', 'Lango la mlima', 'Porte du parc', 'Ingresso del parco', 'Parktor', 'Brama parku', '登山口') },
  { id: 'camp', ...L('Camp', 'Kambi', 'Camp', 'Campo', 'Camp', 'Obóz', '营地') },
  { id: 'lodge', ...L('Lodge', 'Loji', 'Lodge', 'Lodge', 'Lodge', 'Lodge', '旅馆') },
  { id: 'peak', ...L('Summit', 'Kilele', 'Sommet', 'Vetta', 'Gipfel', 'Szczyt', '山顶') },
  { id: 'beach', ...L('Beach', 'Ufukwe', 'Plage', 'Spiaggia', 'Strand', 'Plaża', '海滩') },
  { id: 'island', ...L('Island', 'Kisiwa', 'Île', 'Isola', 'Insel', 'Wyspa', '岛屿') },
  { id: 'cultural', ...L('Cultural site', 'Eneo la utamaduni', 'Site culturel', 'Sito culturale', 'Kulturstätte', 'Miejsce kultury', '文化景点') },
  { id: 'activity', ...L('Activity', 'Shughuli', 'Activité', 'Attività', 'Aktivität', 'Atrakcja', '活动') },
] as const;
export type StopKindId = (typeof STOP_KINDS)[number]['id'];

export const TRANSFER_MODES = {
  drive: L('Drive', 'Gari', 'Route', 'Auto', 'Fahrt', 'Samochód', '驾车'),
  flight: L('Flight', 'Ndege', 'Vol', 'Volo', 'Flug', 'Lot', '航班'),
  boat: L('Boat', 'Boti', 'Bateau', 'Barca', 'Boot', 'Łódź', '乘船'),
  walk: L('Walk', 'Kutembea', 'À pied', 'A piedi', 'Zu Fuß', 'Pieszo', '步行'),
} as const;

export const TOUR_DURATIONS = [
  { id: 'day', min: 1, max: 1, ...L('Day tours', 'Siku moja', 'À la journée', 'In giornata', 'Tagestouren', 'Jednodniowe', '一日游') },
  { id: 'short', min: 2, max: 4, ...L('2–4 days', 'Siku 2–4', '2–4 jours', '2–4 giorni', '2–4 Tage', '2–4 dni', '2–4 天') },
  { id: 'week', min: 5, max: 8, ...L('5–8 days', 'Siku 5–8', '5–8 jours', '5–8 giorni', '5–8 Tage', '5–8 dni', '5–8 天') },
  { id: 'long', min: 9, max: 99, ...L('9+ days', 'Siku 9+', '9 jours et +', '9+ giorni', 'Ab 9 Tagen', '9+ dni', '9 天以上') },
] as const;
export type TourDurationId = (typeof TOUR_DURATIONS)[number]['id'];

// ---------------------------------------------------------------------------
// Data shared by the website and the app
// ---------------------------------------------------------------------------
export type TourStop = {
  id: string;
  position: number;
  day: number | null;
  name: string;
  kind: StopKindId;
  lat: number;
  lng: number;
  note: string | null;
  transfer_mode: keyof typeof TRANSFER_MODES | null;
  distance_km: number | null;
  transfer_hours: number | null;
  distance_source: string | null;
  place_id: string | null;
  /** Approximate, read from open terrain data. */
  elevation_m: number | null;
};

export type TourOperatorSummary = { id: string; slug: string; name: string; logo_url: string | null; location: string | null; verified_at: string | null };

export type Tour = {
  id: string;
  slug: string;
  title_en: string;
  title_sw: string | null;
  summary_en: string;
  summary_sw: string | null;
  tour_type: TourTypeId;
  is_signature: boolean;
  circuit: string;
  kind: 'day_trip' | 'multi_day' | 'combo';
  categories: string[];
  travel_styles: TravelStyleId[];
  days: number;
  nights: number | null;
  start_from: string | null;
  end_at: string | null;
  destinations: string[];
  highlights: string[];
  itinerary: ItineraryDay[];
  accommodation: AccommodationId | null;
  group_type: TourGroupTypeId | null;
  min_group: number | null;
  max_group: number | null;
  price_from: number | null;
  price_currency: string;
  price_conditions: string | null;
  price_verified_at: string | null;
  price_valid_until: string | null;
  includes: string[];
  excludes: string[];
  best_months: number[];
  best_time_note: string | null;
  fitness: FitnessId | null;
  packing: string[];
  good_to_know: string[];
  cover_url: string | null;
  source_url: string | null;
  source_checked_at: string | null;
  needs_review: boolean;
  operated_by: 'partner' | 'kwetuly' | 'guide';
  operator_id: string | null;
  promo_text: string | null;
  status: 'draft' | 'published' | 'archived';
  updated_at: string;
  tour_operators: TourOperatorSummary | null;
};

/** Temporary until the rename migration runs: rows saved before it still say 'rafrika' (the old name).
 * Read them as 'kwetuly' so forms keep the right operator. Remove once the migration has run. */
export function normalizeOperatedBy(value: string | null | undefined): string {
  return value === 'rafrika' ? 'kwetuly' : (value ?? '');
}

export const TOUR_COLUMNS =
  'id, slug, title_en, title_sw, summary_en, summary_sw, tour_type, is_signature, circuit, kind, categories, travel_styles, days, nights, start_from, end_at, destinations, highlights, itinerary, accommodation, group_type, min_group, max_group, price_from, price_currency, price_conditions, price_verified_at, price_valid_until, includes, excludes, best_months, best_time_note, fitness, packing, good_to_know, cover_url, source_url, source_checked_at, needs_review, operated_by, operator_id, promo_text, status, updated_at, tour_operators(id, slug, name, logo_url, location, verified_at)';

export const STOP_COLUMNS = 'id, position, day, name, kind, lat, lng, note, transfer_mode, distance_km, transfer_hours, distance_source, place_id, elevation_m';

export type Meal = 'B' | 'L' | 'D';
/** One day of a tour. Overnight, meals and activities are optional extra detail. */
export type ItineraryDay = { day: number | string; title: string; body: string; overnight?: string; meals?: Meal[]; activities?: string[] };

// ---------------------------------------------------------------------------
// Places: short guides to the parks, sites and villages tours visit.
// ---------------------------------------------------------------------------
export const PLACE_KINDS = [
  { id: 'national_park', ...L('National park', 'Hifadhi ya Taifa', 'Parc national', 'Parco nazionale', 'Nationalpark', 'Park narodowy', '国家公园') },
  { id: 'conservation_area', ...L('Conservation area', 'Eneo la Hifadhi', 'Aire de conservation', 'Area di conservazione', 'Schutzgebiet', 'Obszar chroniony', '保护区') },
  { id: 'game_reserve', ...L('Game reserve', 'Pori la Akiba', 'Réserve de faune', 'Riserva faunistica', 'Wildreservat', 'Rezerwat', '野生动物保护区') },
  { id: 'heritage_site', ...L('Heritage site', 'Eneo la urithi', 'Site patrimonial', 'Sito storico', 'Kulturerbe', 'Miejsce dziedzictwa', '遗产地') },
  { id: 'lake', ...L('Lake', 'Ziwa', 'Lac', 'Lago', 'See', 'Jezioro', '湖泊') },
  { id: 'mountain', ...L('Mountain', 'Mlima', 'Montagne', 'Montagna', 'Berg', 'Góra', '山') },
  { id: 'island', ...L('Island', 'Kisiwa', 'Île', 'Isola', 'Insel', 'Wyspa', '岛屿') },
  { id: 'town', ...L('Town', 'Mji', 'Ville', 'Città', 'Stadt', 'Miasto', '城镇') },
  { id: 'village', ...L('Village', 'Kijiji', 'Village', 'Villaggio', 'Dorf', 'Wieś', '村庄') },
  { id: 'marine_area', ...L('Marine area', 'Eneo la bahari', 'Zone marine', 'Area marina', 'Meeresgebiet', 'Obszar morski', '海洋区') },
] as const;
export type PlaceKindId = (typeof PLACE_KINDS)[number]['id'];

export type Place = {
  id: string;
  slug: string;
  name: string;
  kind: PlaceKindId;
  region: string | null;
  summary: string;
  known_for: string[];
  wildlife: string[];
  activities: string[];
  area_km2: number | null;
  established: number | null;
  unesco_year: number | null;
  highest_point: string | null;
  managed_by: string | null;
  lat: number | null;
  lng: number | null;
  source_name: string | null;
  source_url: string | null;
  source_checked_at: string | null;
  status: 'draft' | 'published' | 'archived';
};

export const PLACE_COLUMNS =
  'id, slug, name, kind, region, summary, known_for, wildlife, activities, area_km2, established, unesco_year, highest_point, managed_by, lat, lng, source_name, source_url, source_checked_at, status';

/** Where travellers sleep on a day: the itinerary's own note, else the day's last camp or lodge stop. */
export function overnightFor(day: ItineraryDay, stops: TourStop[]): string | null {
  if (day.overnight) return day.overnight;
  const camps = stops.filter((s) => String(s.day) === String(day.day) && (s.kind === 'camp' || s.kind === 'lodge'));
  return camps.at(-1)?.name ?? null;
}

/** Altitude profile for tours that climb (at least 800 m between lowest and highest stop). */
export function altitudeProfile(stops: TourStop[]): { stops: (TourStop & { elevation_m: number })[]; min: number; max: number } | null {
  const withHeight = stops.filter((s): s is TourStop & { elevation_m: number } => s.elevation_m != null);
  if (withHeight.length < 3) return null;
  const heights = withHeight.map((s) => s.elevation_m);
  const min = Math.min(...heights);
  const max = Math.max(...heights);
  return max - min >= 800 ? { stops: withHeight, min, max } : null;
}

export const tourTitle = (tour: Pick<Tour, 'title_en' | 'title_sw'>, locale: Locale) => (locale === 'sw' && tour.title_sw) || tour.title_en;
export const tourSummary = (tour: Pick<Tour, 'summary_en' | 'summary_sw'>, locale: Locale) => (locale === 'sw' && tour.summary_sw) || tour.summary_en;

// ---------------------------------------------------------------------------
// Search and filters (the catalogue is small, so it is filtered in memory)
// ---------------------------------------------------------------------------
export type TourFilters = {
  q?: string;
  theme?: TourThemeId;
  type?: TourTypeId;
  style?: TravelStyleId;
  accommodation?: AccommodationId;
  group?: 'private' | 'group';
  duration?: TourDurationId;
  month?: number;
};

export function tourMatchesTheme(tour: Pick<Tour, 'categories' | 'kind' | 'circuit'>, theme: TourThemeId): boolean {
  const has = (...ids: string[]) => tour.categories.some((c) => ids.includes(c));
  switch (theme) {
    case 'safari':
      return has('safari', 'chimpanzee');
    case 'mountain':
      return has('mountain', 'walking');
    case 'coast':
      return has('beach', 'marine') || tour.circuit === 'coast';
    case 'cultural':
      return has('cultural', 'historical');
    case 'combo':
      return tour.kind === 'combo';
  }
}

export function filterTours<T extends Tour>(tours: T[], f: TourFilters): T[] {
  const words = (f.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const duration = TOUR_DURATIONS.find((d) => d.id === f.duration);
  return tours.filter((tour) => {
    if (f.theme && !tourMatchesTheme(tour, f.theme)) return false;
    if (f.type && tour.tour_type !== f.type) return false;
    if (f.style && !tour.travel_styles.includes(f.style)) return false;
    if (f.accommodation && tour.accommodation !== f.accommodation) return false;
    if (f.group && tour.group_type !== f.group && tour.group_type !== 'private_or_group') return false;
    if (duration && (tour.days < duration.min || tour.days > duration.max)) return false;
    if (f.month && tour.best_months.length > 0 && !tour.best_months.includes(f.month)) return false;
    if (words.length > 0) {
      const text = [tour.title_en, tour.title_sw, tour.summary_en, tour.start_from, tour.end_at, tour.tour_operators?.name, ...tour.destinations, ...tour.highlights]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!words.every((w) => text.includes(w))) return false;
    }
    return true;
  });
}

/** Reads filters from URL search params, ignoring anything that is not a known value. */
export function readTourFilters(get: (key: string) => string | undefined): TourFilters {
  const pick = <T extends string>(key: string, ids: readonly { id: T }[]) => ids.find((x) => x.id === get(key))?.id;
  const month = Number(get('month'));
  const group = get('group');
  // Older links used ?category=, ?kind= and ?signature=1.
  const legacyTheme = ({ safari: 'safari', chimpanzee: 'safari', mountain: 'mountain', walking: 'mountain', beach: 'coast', marine: 'coast', cultural: 'cultural', historical: 'cultural' } as Record<string, TourThemeId>)[get('category') ?? ''];
  return {
    q: get('q')?.slice(0, 80) || undefined,
    theme: pick('theme', TOUR_THEMES) ?? legacyTheme ?? (get('kind') === 'combo' ? 'combo' : undefined),
    type: pick('type', TOUR_TYPES) ?? (get('signature') === '1' ? 'signature' : undefined),
    style: pick('style', TRAVEL_STYLES),
    accommodation: pick('accommodation', ACCOMMODATION_LEVELS),
    group: group === 'private' || group === 'group' ? group : undefined,
    duration: pick('duration', TOUR_DURATIONS) ?? (get('kind') === 'day_trip' ? 'day' : undefined),
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : undefined,
  };
}

// ---------------------------------------------------------------------------
// Prices: only a verified price that has not expired is ever shown.
// ---------------------------------------------------------------------------
export function verifiedPrice(
  tour: Pick<Tour, 'price_from' | 'price_currency' | 'price_verified_at' | 'price_valid_until'>,
  today: Date,
): { amount: number; currency: string } | null {
  if (tour.price_from == null || !tour.price_verified_at) return null;
  if (tour.price_valid_until && new Date(tour.price_valid_until) < today) return null;
  return { amount: Number(tour.price_from), currency: tour.price_currency };
}

const CURRENCY_SIGNS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', TZS: 'TSh ' };

/** "$2,450", "€1,900", "TSh 450,000" */
export function formatPrice(amount: number, currency: string): string {
  return `${CURRENCY_SIGNS[currency] ?? `${currency} `}${Math.round(amount).toLocaleString('en-US')}`;
}

// ---------------------------------------------------------------------------
// Map helpers
// ---------------------------------------------------------------------------
/** Straight-line distance in km between two points (not a driving distance). */
export function straightLineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// ---------------------------------------------------------------------------
// Guides: which guide specialties fit a tour (used when no guides are assigned).
// ---------------------------------------------------------------------------
const SPECIALTIES_BY_CATEGORY: Record<string, string[]> = {
  mountain: ['mountain'],
  walking: ['mountain', 'day_trips'],
  safari: ['safari', 'photography', 'birding'],
  chimpanzee: ['safari'],
  beach: ['marine'],
  marine: ['marine'],
  cultural: ['cultural', 'city'],
  historical: ['cultural', 'city'],
  event: ['city'],
};

export function guideSpecialtiesForTour(categories: string[]): string[] {
  return [...new Set(categories.flatMap((c) => SPECIALTIES_BY_CATEGORY[c] ?? []))];
}

// ---------------------------------------------------------------------------
// Admin: what a tour still needs before it can be published.
// ---------------------------------------------------------------------------
export type ReadinessItem = { id: string; label: string; ok: boolean; required: boolean };

export function tourReadiness(tour: Tour, counts: { stops: number; guides: number }): ReadinessItem[] {
  const isMountain = tour.categories.includes('mountain');
  const items: ReadinessItem[] = [
    { id: 'itinerary', label: 'Day-by-day itinerary', ok: tour.itinerary.length > 0, required: true },
    { id: 'stops', label: 'Map stops', ok: counts.stops > 0, required: true },
    { id: 'highlights', label: 'Highlights', ok: tour.highlights.length > 0, required: true },
    { id: 'includes', label: 'Included and excluded items', ok: tour.includes.length > 0 && tour.excludes.length > 0, required: true },
    { id: 'months', label: 'Best time to travel', ok: tour.best_months.length > 0, required: true },
    { id: 'fitness', label: 'Fitness level', ok: !isMountain || tour.fitness != null, required: isMountain },
    { id: 'accommodation', label: 'Accommodation level', ok: tour.accommodation != null, required: false },
    { id: 'group', label: 'Private or group', ok: tour.group_type != null, required: false },
    { id: 'price', label: 'Verified price (otherwise “Price subject to confirmation”)', ok: tour.price_verified_at != null, required: false },
    { id: 'guides', label: 'Guides assigned (otherwise matching guides are suggested)', ok: counts.guides > 0, required: false },
  ];
  if (tour.tour_type === 'operator') {
    items.push(
      { id: 'operator', label: 'Operator linked', ok: tour.operator_id != null, required: true },
      { id: 'source', label: 'Operator’s own page or enquiry link, with date checked', ok: tour.source_url != null, required: true },
    );
  }
  return items;
}
