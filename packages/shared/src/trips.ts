// Trip catalogue labels. Keep in sync with the trip_* enums in Supabase.

export const TRIP_CIRCUITS = [
  { id: 'northern', en: 'Northern circuit', sw: 'Kanda ya Kaskazini' },
  { id: 'southern', en: 'Southern circuit', sw: 'Kanda ya Kusini' },
  { id: 'western', en: 'Western circuit', sw: 'Kanda ya Magharibi' },
  { id: 'coast', en: 'Coast & islands', sw: 'Pwani na visiwa' },
  { id: 'nationwide', en: 'Across Tanzania', sw: 'Tanzania nzima' },
] as const;

export const TRIP_KINDS = [
  { id: 'day_trip', en: 'Day trip', sw: 'Safari ya siku moja' },
  { id: 'multi_day', en: 'Multi-day', sw: 'Siku kadhaa' },
  { id: 'combo', en: 'Combo', sw: 'Mchanganyiko' },
] as const;

export const TRIP_CATEGORIES = [
  { id: 'safari', icon: 'binoculars', en: 'Safari', sw: 'Safari' },
  { id: 'mountain', icon: 'mountain', en: 'Mountain', sw: 'Mlima' },
  { id: 'cultural', icon: 'users', en: 'Culture', sw: 'Utamaduni' },
  { id: 'beach', icon: 'sun', en: 'Beach', sw: 'Ufukwe' },
  { id: 'historical', icon: 'book-open', en: 'History', sw: 'Historia' },
  { id: 'marine', icon: 'globe', en: 'Marine', sw: 'Bahari' },
  { id: 'chimpanzee', icon: 'tent', en: 'Chimpanzees', sw: 'Sokwe' },
  { id: 'walking', icon: 'route', en: 'Walking', sw: 'Matembezi' },
  { id: 'event', icon: 'trophy', en: 'Events', sw: 'Matukio' },
] as const;

export const TRIP_OPERATORS = {
  partner: { en: 'Operated by a licensed partner', sw: 'Inaendeshwa na mshirika mwenye leseni' },
  rafrika: { en: 'Operated by Rafrika', sw: 'Inaendeshwa na Rafrika' },
  guide: { en: 'Led by a verified Rafrika guide', sw: 'Inaongozwa na mwongozaji wa Rafrika' },
} as const;

export const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  sw: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'],
} as const;
