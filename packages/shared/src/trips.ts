// Trip catalogue labels. Keep in sync with the trip_* enums in Supabase.
// Labels are in the order en, sw, fr, it, de, pl, zh (see locales.ts).

import { L, type Locale } from './locales';

export const TRIP_CIRCUITS = [
  { id: 'northern', ...L('Northern circuit', 'Kanda ya Kaskazini', 'Circuit Nord', 'Circuito settentrionale', 'Nördlicher Circuit', 'Szlak północny', '北部线路') },
  { id: 'southern', ...L('Southern circuit', 'Kanda ya Kusini', 'Circuit Sud', 'Circuito meridionale', 'Südlicher Circuit', 'Szlak południowy', '南部线路') },
  { id: 'western', ...L('Western circuit', 'Kanda ya Magharibi', 'Circuit Ouest', 'Circuito occidentale', 'Westlicher Circuit', 'Szlak zachodni', '西部线路') },
  { id: 'coast', ...L('Coast & islands', 'Pwani na visiwa', 'Côte & îles', 'Costa e isole', 'Küste & Inseln', 'Wybrzeże i wyspy', '海岸与海岛') },
  { id: 'nationwide', ...L('Across Tanzania', 'Tanzania nzima', 'Toute la Tanzanie', 'In tutta la Tanzania', 'Ganz Tansania', 'Cała Tanzania', '坦桑尼亚全境') },
] as const;

export const TRIP_KINDS = [
  { id: 'day_trip', ...L('Day trip', 'Safari ya siku moja', 'Excursion d’une journée', 'Escursione giornaliera', 'Tagesausflug', 'Wycieczka jednodniowa', '一日游') },
  { id: 'multi_day', ...L('Multi-day', 'Siku kadhaa', 'Plusieurs jours', 'Più giorni', 'Mehrtägig', 'Kilkudniowa', '多日游') },
  { id: 'combo', ...L('Combo', 'Mchanganyiko', 'Combiné', 'Combinato', 'Kombi', 'Łączona', '组合游') },
] as const;

export const TRIP_CATEGORIES = [
  { id: 'safari', icon: 'binoculars', ...L('Safari', 'Safari', 'Safari', 'Safari', 'Safari', 'Safari', '游猎') },
  { id: 'mountain', icon: 'mountain', ...L('Mountain', 'Mlima', 'Montagne', 'Montagna', 'Berge', 'Góry', '登山') },
  { id: 'cultural', icon: 'users', ...L('Culture', 'Utamaduni', 'Culture', 'Cultura', 'Kultur', 'Kultura', '文化') },
  { id: 'beach', icon: 'sun', ...L('Beach', 'Ufukwe', 'Plage', 'Spiaggia', 'Strand', 'Plaża', '海滩') },
  { id: 'historical', icon: 'book-open', ...L('History', 'Historia', 'Histoire', 'Storia', 'Geschichte', 'Historia', '历史') },
  { id: 'marine', icon: 'globe', ...L('Marine', 'Bahari', 'Mer', 'Mare', 'Meer', 'Morze', '海洋') },
  { id: 'chimpanzee', icon: 'tent', ...L('Chimpanzees', 'Sokwe', 'Chimpanzés', 'Scimpanzé', 'Schimpansen', 'Szympansy', '黑猩猩') },
  { id: 'walking', icon: 'route', ...L('Walking', 'Matembezi', 'Randonnée', 'Trekking a piedi', 'Wandern', 'Piesze wędrówki', '徒步') },
  { id: 'event', icon: 'trophy', ...L('Events', 'Matukio', 'Événements', 'Eventi', 'Events', 'Wydarzenia', '活动') },
] as const;

export const TRIP_OPERATORS = {
  partner: L('Operated by a licensed partner', 'Inaendeshwa na mshirika mwenye leseni', 'Organisé par un partenaire agréé', 'Gestito da un partner autorizzato', 'Durchgeführt von einem lizenzierten Partner', 'Realizowane przez licencjonowanego partnera', '由持证合作伙伴运营'),
  rafrika: L('Operated by Rafrika', 'Inaendeshwa na Rafrika', 'Organisé par Rafrika', 'Gestito da Rafrika', 'Durchgeführt von Rafrika', 'Realizowane przez Rafrika', '由 Rafrika 运营'),
  guide: L('Led by a verified Rafrika guide', 'Inaongozwa na mwongozaji wa Rafrika', 'Mené par un guide Rafrika vérifié', 'Guidato da una guida Rafrika verificata', 'Geführt von einem geprüften Rafrika-Guide', 'Prowadzone przez sprawdzonego przewodnika Rafrika', '由 Rafrika 认证导游带领'),
} as const;

export const MONTHS: Record<Locale, readonly string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  sw: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'],
  fr: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
  it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  pl: ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'],
  zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
};
