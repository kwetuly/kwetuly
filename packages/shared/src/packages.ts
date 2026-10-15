import { L } from './locales';
import { formatUsd } from './money';

// Guide packages: cultural visits, one-on-one trips, day trips... Keep the ids in sync with the
// `guide_packages.kind` check in Supabase.

export const PACKAGE_KINDS = [
  { id: 'cultural', ...L('Cultural visit', 'Ziara ya kitamaduni', 'Visite culturelle', 'Visita culturale', 'Kulturbesuch', 'Wizyta kulturalna', '文化探访') },
  { id: 'one_on_one', ...L('One-on-one trip', 'Safari ya mtu mmoja', 'Voyage en tête-à-tête', 'Viaggio individuale', 'Reise zu zweit mit dem Guide', 'Wyprawa jeden na jeden', '一对一行程') },
  { id: 'day_trip', ...L('Day trip', 'Safari ya siku moja', 'Excursion d’une journée', 'Gita di un giorno', 'Tagesausflug', 'Wycieczka jednodniowa', '一日游') },
  { id: 'multi_day', ...L('Multi-day trip', 'Safari ya siku kadhaa', 'Voyage de plusieurs jours', 'Viaggio di più giorni', 'Mehrtägige Reise', 'Wyprawa kilkudniowa', '多日行程') },
  { id: 'food', ...L('Food & cooking', 'Chakula na mapishi', 'Cuisine & repas', 'Cibo e cucina', 'Essen & Kochen', 'Jedzenie i gotowanie', '美食与烹饪') },
  { id: 'city', ...L('City walk', 'Matembezi ya mjini', 'Balade en ville', 'Passeggiata in città', 'Stadtrundgang', 'Spacer po mieście', '城市漫步') },
  { id: 'nature', ...L('Nature & hiking', 'Asili na matembezi', 'Nature & randonnée', 'Natura ed escursioni', 'Natur & Wandern', 'Przyroda i wędrówki', '自然与徒步') },
  { id: 'other', ...L('Other', 'Nyingine', 'Autre', 'Altro', 'Sonstiges', 'Inne', '其他') },
] as const;

export type PackageKind = (typeof PACKAGE_KINDS)[number]['id'];
export type PackageStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export type GuidePackage = {
  id: string;
  guide_id: string;
  kind: PackageKind;
  title: string;
  summary: string;
  details: string | null;
  duration_hours: number | null;
  duration_days: number | null;
  price_usd: number | null;
  price_per: 'person' | 'group';
  max_group: number | null;
  includes: string[];
  meeting_point: string | null;
  photo_url: string | null;
  status: PackageStatus;
  review_note: string | null;
  sort_order: number;
};

export const PACKAGE_COLUMNS =
  'id, guide_id, kind, title, summary, details, duration_hours, duration_days, price_usd, price_per, max_group, includes, meeting_point, photo_url, status, review_note, sort_order';

type PackageText = {
  hour: string;
  hours: string;
  day: string;
  days: string;
  perPerson: string;
  perGroup: string;
  onRequest: string;
  upTo: string;
};

/** "4 hours" or "3 days", or null when the guide gave no length. */
export function packageDuration(p: Pick<GuidePackage, 'duration_hours' | 'duration_days'>, t: PackageText): string | null {
  if (p.duration_days) return `${p.duration_days} ${p.duration_days === 1 ? t.day : t.days}`;
  if (p.duration_hours) return `${p.duration_hours} ${p.duration_hours === 1 ? t.hour : t.hours}`;
  return null;
}

/** "$45 / person", "$200 / group" or "Price on request". */
export function packagePrice(p: Pick<GuidePackage, 'price_usd' | 'price_per'>, t: PackageText): string {
  if (p.price_usd == null) return t.onRequest;
  return `${formatUsd(Number(p.price_usd))} ${p.price_per === 'group' ? t.perGroup : t.perPerson}`;
}
