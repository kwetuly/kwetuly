// Guide classification. Keep these in sync with the `guide_specialty` enum in Supabase.

export const GUIDE_SPECIALTIES = [
  { id: 'mountain', en: 'Mountain & trekking', sw: 'Mlima na matembezi' },
  { id: 'safari', en: 'Safari & wildlife', sw: 'Safari na wanyamapori' },
  { id: 'cultural', en: 'Cultural & village', sw: 'Utamaduni na vijiji' },
  { id: 'city', en: 'City & town tours', sw: 'Ziara za mjini' },
  { id: 'birding', en: 'Birding', sw: 'Kutazama ndege' },
  { id: 'marine', en: 'Zanzibar & marine', sw: 'Zanzibar na bahari' },
  { id: 'photography', en: 'Photography', sw: 'Upigaji picha' },
  { id: 'day_trips', en: 'Day trips', sw: 'Safari za siku moja' },
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
  { max: 4, en: 'Up to 4 people', sw: 'Hadi watu 4' },
  { max: 8, en: 'Up to 8 people', sw: 'Hadi watu 8' },
  { max: 16, en: 'Up to 16 people', sw: 'Hadi watu 16' },
  { max: 30, en: 'Large groups', sw: 'Makundi makubwa' },
] as const;

export const PLANS = {
  msingi: { name: 'Msingi', priceUsdMonthly: 0 },
  pro: { name: 'Pro', priceUsdMonthly: null }, // price to be decided
} as const;

export type Plan = keyof typeof PLANS;
