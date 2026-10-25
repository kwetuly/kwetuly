import { L } from './locales';

// Business listings (hotels, homestays, rentals, curio shops...). Keep the ids in sync with the
// `providers.business_type` check in Supabase.

export const BUSINESS_TYPES = [
  { id: 'hotel', ...L('Hotel', 'Hoteli', 'Hôtel', 'Hotel', 'Hotel', 'Hotel', '酒店') },
  { id: 'lodge', ...L('Lodge or camp', 'Loji au kambi', 'Lodge ou camp', 'Lodge o campo', 'Lodge oder Camp', 'Lodż lub obóz', '旅馆或营地') },
  { id: 'homestay', ...L('Homestay', 'Kukaa na familia', 'Chez l’habitant', 'Soggiorno in famiglia', 'Gastfamilie', 'Pobyt u rodziny', '民宿寄宿') },
  { id: 'hostel', ...L('Hostel', 'Hosteli', 'Auberge de jeunesse', 'Ostello', 'Hostel', 'Hostel', '青年旅舍') },
  { id: 'rental', ...L('Airbnb-style apartment', 'Apartimenti ya kupangisha', 'Appartement type Airbnb', 'Appartamento stile Airbnb', 'Apartment im Airbnb-Stil', 'Apartament w stylu Airbnb', '民宿公寓') },
  { id: 'curio_shop', ...L('Curio & art shop', 'Duka la sanaa na zawadi', 'Boutique d’art et souvenirs', 'Negozio di arte e souvenir', 'Kunst- & Souvenirladen', 'Sklep z rękodziełem', '工艺品与艺术品店') },
  { id: 'gem_shop', ...L('Tanzanite & gems', 'Tanzanite na vito', 'Tanzanite & pierres', 'Tanzanite e gemme', 'Tansanit & Edelsteine', 'Tanzanit i kamienie', '坦桑石与宝石') },
  { id: 'gear_rental', ...L('Gear rental', 'Kukodisha vifaa', 'Location d’équipement', 'Noleggio attrezzatura', 'Ausrüstungsverleih', 'Wypożyczalnia sprzętu', '装备租赁') },
  { id: 'transport', ...L('Transport', 'Usafiri', 'Transport', 'Trasporti', 'Transport', 'Transport', '交通') },
  { id: 'car_hire', ...L('Car hire', 'Kukodi magari', 'Location de voitures', 'Noleggio auto', 'Autovermietung', 'Wynajem samochodów', '租车') },
  { id: 'restaurant', ...L('Restaurant', 'Mgahawa', 'Restaurant', 'Ristorante', 'Restaurant', 'Restauracja', '餐厅') },
  { id: 'spa', ...L('Massage & spa', 'Masaji na spa', 'Massage & spa', 'Massaggi e spa', 'Massage & Spa', 'Masaż i spa', '按摩与水疗') },
  { id: 'salon', ...L('Salon & barber', 'Saluni na kinyozi', 'Salon & barbier', 'Parrucchiere e barbiere', 'Salon & Barbier', 'Salon i fryzjer', '美发与理发') },
  { id: 'nightlife', ...L('Nightlife', 'Burudani ya usiku', 'Vie nocturne', 'Vita notturna', 'Nachtleben', 'Życie nocne', '夜生活') },
  { id: 'merch', ...L('Kwetuly Shop', 'Duka la Kwetuly', 'Boutique Kwetuly', 'Negozio Kwetuly', 'Kwetuly-Shop', 'Sklep Kwetuly', 'Kwetuly 商店') },
  { id: 'other', ...L('Other', 'Nyingine', 'Autre', 'Altro', 'Sonstiges', 'Inne', '其他') },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]['id'];

/** What Kwetuly can check for the paid badge. Admin ticks the ones actually done. */
export const BADGE_CHECKS = [
  { id: 'licence', ...L('Business licence', 'Leseni ya biashara', 'Licence commerciale', 'Licenza commerciale', 'Gewerbelizenz', 'Licencja działalności', '营业执照') },
  { id: 'tourism_licence', ...L('Tourism licence (TTB)', 'Leseni ya utalii (TTB)', 'Licence de tourisme (TTB)', 'Licenza turistica (TTB)', 'Tourismuslizenz (TTB)', 'Licencja turystyczna (TTB)', '旅游执照（TTB）') },
  { id: 'identity', ...L('Owner identity', 'Utambulisho wa mmiliki', 'Identité du propriétaire', 'Identità del titolare', 'Identität des Inhabers', 'Tożsamość właściciela', '经营者身份') },
  { id: 'photos', ...L('Photos match the place', 'Picha zinalingana na mahali', 'Les photos correspondent au lieu', 'Le foto corrispondono al luogo', 'Fotos stimmen mit dem Ort überein', 'Zdjęcia zgadzają się z miejscem', '照片与实地相符') },
  { id: 'visit', ...L('Visited in person', 'Imetembelewa ana kwa ana', 'Visite sur place', 'Visitato di persona', 'Vor Ort besucht', 'Odwiedzone osobiście', '实地到访') },
] as const;

export type BadgeCheck = (typeof BADGE_CHECKS)[number]['id'];

/** Which business types appear on each menu page (section slug / item slug). */
export const BUSINESS_PAGES: Record<string, BusinessType[]> = {
  'stay/hotels': ['hotel', 'lodge'],
  'stay/homestays': ['homestay'],
  'stay/hostels': ['hostel'],
  'stay/rentals': ['rental'],
  'shop/art': ['curio_shop'],
  'shop/tanzanite': ['gem_shop'],
  'shop/rent-gear': ['gear_rental'],
  'transport/airport-transfers': ['transport'],
  'transport/regional': ['transport'],
  'transport/cross-border': ['transport'],
  'transport/car-hire': ['car_hire', 'transport'],
  'local/massage': ['spa'],
  'local/salons': ['salon'],
  'local/food': ['restaurant'],
  'local/hot-spots': ['nightlife'],
};

export type Business = {
  id: string;
  business_name: string;
  business_type: BusinessType;
  story: string | null;
  base_region: string;
  location: string | null;
  website: string | null;
  photo_url: string | null;
  photos: string[];
  languages: string[];
  verification_status: 'pending' | 'approved' | 'rejected';
  badge_checks: BadgeCheck[];
  badge_checked_at: string | null;
  badge_valid_until: string | null;
  badge_requested_at: string | null;
  has_referral_agreement: boolean;
  is_sample: boolean;
  source_url: string | null;
};

export const BUSINESS_COLUMNS =
  'id, business_name, business_type, story, base_region, location, website, photo_url, photos, languages, verification_status, badge_checks, badge_checked_at, badge_valid_until, badge_requested_at, has_referral_agreement, is_sample, source_url';

/** The badge only shows while it is valid and something was actually checked. `today` is YYYY-MM-DD. */
export function hasValidBadge(b: Pick<Business, 'badge_checks' | 'badge_valid_until'>, today: string): boolean {
  return b.badge_checks.length > 0 && !!b.badge_valid_until && b.badge_valid_until >= today;
}

/** A sale's commission split from the business's agreement (percentages of the sale amount). */
export function commissionSplit(amount: number, agreement: { rafrika_pct: number; guide_pct: number } | null) {
  if (!agreement) return { kwetuly: 0, guide: 0 };
  const round = (n: number) => Math.round(n);
  return { kwetuly: round((amount * Number(agreement.rafrika_pct)) / 100), guide: round((amount * Number(agreement.guide_pct)) / 100) };
}

/** Shops where travellers can order for delivery to their hotel, or reserve and collect. */
export const ORDER_TYPES: readonly string[] = ['curio_shop', 'gem_shop', 'gear_rental'];
export type OrderMode = 'deliver' | 'collect';

/** The order request as the shop owner reads it (owners work in English or Kiswahili). */
export function orderMessage(mode: OrderMode, where: string, what: string): string {
  const how = mode === 'deliver' ? `Order: deliver to ${where || '(not given)'}` : `Order: hold for collection${where ? ` (${where})` : ''}`;
  return [how, '', what].join('\n');
}
