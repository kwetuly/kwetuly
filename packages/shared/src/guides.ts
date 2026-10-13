import { L } from './locales';

// Guide classification. Keep these in sync with the `guide_specialty` enum in Supabase.

export const GUIDE_SPECIALTIES = [
  { id: 'mountain', ...L('Mountain & trekking', 'Mlima na matembezi', 'Montagne & trekking', 'Montagna e trekking', 'Berge & Trekking', 'Góry i trekking', '登山与徒步') },
  { id: 'safari', ...L('Safari & wildlife', 'Safari na wanyamapori', 'Safari & faune', 'Safari e fauna', 'Safari & Tierwelt', 'Safari i dzika przyroda', '游猎与野生动物') },
  { id: 'cultural', ...L('Cultural & village', 'Utamaduni na vijiji', 'Culture & villages', 'Cultura e villaggi', 'Kultur & Dörfer', 'Kultura i wioski', '文化与村落') },
  { id: 'city', ...L('City & town tours', 'Ziara za mjini', 'Visites de ville', 'Tour in città', 'Stadtführungen', 'Zwiedzanie miast', '城市观光') },
  { id: 'birding', ...L('Birding', 'Kutazama ndege', 'Ornithologie', 'Birdwatching', 'Vogelbeobachtung', 'Obserwacja ptaków', '观鸟') },
  { id: 'marine', ...L('Zanzibar & marine', 'Zanzibar na bahari', 'Zanzibar & mer', 'Zanzibar e mare', 'Sansibar & Meer', 'Zanzibar i morze', '桑给巴尔与海洋') },
  { id: 'photography', ...L('Photography', 'Upigaji picha', 'Photographie', 'Fotografia', 'Fotografie', 'Fotografia', '摄影') },
  { id: 'day_trips', ...L('Day trips', 'Safari za siku moja', 'Excursions d’une journée', 'Escursioni giornaliere', 'Tagesausflüge', 'Wycieczki jednodniowe', '一日游') },
] as const;

export type GuideSpecialty = (typeof GUIDE_SPECIALTIES)[number]['id'];

export const GUIDE_LANGUAGES = [
  { code: 'sw', name: 'Kiswahili' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'zh', name: '中文' },
  { code: 'ar', name: 'العربية' },
  { code: 'ru', name: 'Русский' },
  { code: 'pl', name: 'Polski' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'ja', name: '日本語' },
] as const;

export type GuideLanguage = (typeof GUIDE_LANGUAGES)[number]['code'];

export const REGIONS = [
  'Kilimanjaro',
  'Moshi',
  'Arusha',
  'Serengeti',
  'Ngorongoro',
  'Tarangire',
  'Manyara',
  'Zanzibar',
  'Dar es Salaam',
  'Dodoma',
  'Bagamoyo',
  'Ruaha',
  'Mikumi',
  'Nyerere (Selous)',
] as const;

export const GROUP_SIZES = [
  { max: 4, ...L('Up to 4 people', 'Hadi watu 4', 'Jusqu’à 4 personnes', 'Fino a 4 persone', 'Bis zu 4 Personen', 'Do 4 osób', '最多 4 人') },
  { max: 8, ...L('Up to 8 people', 'Hadi watu 8', 'Jusqu’à 8 personnes', 'Fino a 8 persone', 'Bis zu 8 Personen', 'Do 8 osób', '最多 8 人') },
  { max: 16, ...L('Up to 16 people', 'Hadi watu 16', 'Jusqu’à 16 personnes', 'Fino a 16 persone', 'Bis zu 16 Personen', 'Do 16 osób', '最多 16 人') },
  { max: 30, ...L('Large groups', 'Makundi makubwa', 'Grands groupes', 'Gruppi numerosi', 'Große Gruppen', 'Duże grupy', '大型团体') },
] as const;

// Topics a guide can offer 1-on-1 prep calls on.
export const CALL_TOPICS = [
  { id: 'kilimanjaro', ...L('Kilimanjaro prep', 'Maandalizi ya Kilimanjaro', 'Préparer le Kilimandjaro', 'Preparazione Kilimangiaro', 'Kilimandscharo-Vorbereitung', 'Przygotowanie do Kilimandżaro', '乞力马扎罗准备') },
  { id: 'safari', ...L('Safari planning', 'Kupanga safari', 'Organiser un safari', 'Pianificare il safari', 'Safari-Planung', 'Planowanie safari', '游猎规划') },
  { id: 'zanzibar', ...L('Zanzibar & coast', 'Zanzibar na pwani', 'Zanzibar & côte', 'Zanzibar e costa', 'Sansibar & Küste', 'Zanzibar i wybrzeże', '桑给巴尔与海岸') },
  { id: 'culture', ...L('Culture & etiquette', 'Utamaduni na adabu', 'Culture & usages', 'Cultura e galateo', 'Kultur & Umgangsformen', 'Kultura i savoir-vivre', '文化与礼仪') },
  { id: 'meru', ...L('Mount Meru & other climbs', 'Mlima Meru na mingine', 'Mont Meru & autres ascensions', 'Monte Meru e altre salite', 'Mount Meru & andere Gipfel', 'Góra Meru i inne szczyty', '梅鲁山及其他登山') },
  { id: 'itinerary', ...L('Full trip itinerary', 'Ratiba kamili ya safari', 'Itinéraire complet', 'Itinerario completo', 'Komplette Reiseroute', 'Pełny plan podróży', '完整行程规划') },
] as const;

export const JOB_ROLES = [
  { id: 'guide', ...L('Guide', 'Mwongozaji', 'Guide', 'Guida', 'Guide', 'Przewodnik', '导游') },
  { id: 'assistant_guide', ...L('Assistant guide', 'Msaidizi wa mwongozaji', 'Guide assistant', 'Guida assistente', 'Assistenz-Guide', 'Asystent przewodnika', '助理导游') },
  { id: 'cook', ...L('Cook', 'Mpishi', 'Cuisinier', 'Cuoco', 'Koch', 'Kucharz', '厨师') },
  { id: 'porter', ...L('Porter', 'Mpagazi', 'Porteur', 'Portatore', 'Träger', 'Tragarz', '背夫') },
  { id: 'driver', ...L('Driver', 'Dereva', 'Chauffeur', 'Autista', 'Fahrer', 'Kierowca', '司机') },
  { id: 'other', ...L('Other crew', 'Wengine', 'Autre équipe', 'Altro staff', 'Weitere Crew', 'Inna ekipa', '其他人员') },
] as const;

export const PLANS = {
  msingi: { name: 'Msingi', priceUsdMonthly: 0 },
  pro: { name: 'Pro', priceUsdMonthly: null }, // price to be decided
} as const;

export type Plan = keyof typeof PLANS;
