// Site and app navigation. Each section has a URL slug and items shown in its dropdown.
// `status: 'soon'` items show a "coming soon" page that collects interest and listings.

type Label = { en: string; sw: string };

export type MenuItem = {
  slug: string;
  icon: string; // icon name, mapped to an icon component in each app
  label: Label;
  blurb: Label;
  href?: string; // set when the item lives at a dedicated page instead of /[section]/[item]
  status?: 'live' | 'soon';
};

export type MenuSection = {
  slug: string;
  icon: string;
  label: Label;
  tagline: Label;
  items: MenuItem[];
};

export const MENU: MenuSection[] = [
  {
    // URL slug is "trips" because /guides/[slug] is used for guide profiles.
    slug: 'trips',
    icon: 'compass',
    label: { en: 'Guides', sw: 'Waongozaji' },
    tagline: { en: 'Verified local guides, booked direct', sw: 'Waongozaji waliothibitishwa, moja kwa moja' },
    items: [
      { slug: 'find', icon: 'users', href: '/guides', status: 'live', label: { en: 'Find a guide', sw: 'Tafuta mwongozaji' }, blurb: { en: 'Filter by language, region and experience', sw: 'Chuja kwa lugha, mkoa na uzoefu' } },
      { slug: 'calls', icon: 'video', href: '/calls', status: 'live', label: { en: '1-on-1 prep calls', sw: 'Simu za maandalizi' }, blurb: { en: 'Kili, safari or Zanzibar advice from a guide you choose', sw: 'Ushauri wa Kili, safari au Zanzibar kutoka kwa mwongozaji unayemchagua' } },
      { slug: 'day-trips', icon: 'sun', label: { en: 'Day trips', sw: 'Safari za siku moja' }, blurb: { en: 'Waterfalls, coffee farms, hot springs', sw: 'Maporomoko, mashamba ya kahawa, chemchemi' } },
      { slug: 'group-trips', icon: 'users-round', label: { en: 'Join a group trip', sw: 'Jiunge na kundi' }, blurb: { en: 'Share a trip, split the cost', sw: 'Shiriki safari, gawana gharama' } },
      { slug: 'trip-requests', icon: 'gavel', label: { en: 'Post a trip request', sw: 'Weka ombi la safari' }, blurb: { en: 'Guides send you Regular, Premium and VIP offers', sw: 'Waongozaji wanakutumia ofa za kawaida, premium na VIP' } },
    ],
  },
  {
    slug: 'stay',
    icon: 'bed-double',
    label: { en: 'Stay', sw: 'Malazi' },
    tagline: { en: 'Places to sleep, checked by guides', sw: 'Malazi yaliyokaguliwa na waongozaji' },
    items: [
      { slug: 'hotels', icon: 'building-2', label: { en: 'Hotels & lodges', sw: 'Hoteli na loji' }, blurb: { en: 'From town hotels to safari lodges', sw: 'Kutoka hoteli za mjini hadi loji za safari' } },
      { slug: 'homestays', icon: 'house', label: { en: 'Homestays', sw: 'Kukaa na familia' }, blurb: { en: 'Live with a local family', sw: 'Ishi na familia ya kienyeji' } },
      { slug: 'hostels', icon: 'backpack', label: { en: 'Hostels & backpackers', sw: 'Hosteli' }, blurb: { en: 'Budget beds and good company', sw: 'Vitanda vya bei nafuu' } },
      { slug: 'rentals', icon: 'key-round', label: { en: 'Holiday rentals', sw: 'Nyumba za kupangisha' }, blurb: { en: 'Apartments and villas, Airbnb-style', sw: 'Apartmenti na nyumba, kama Airbnb' } },
    ],
  },
  {
    slug: 'transport',
    icon: 'car',
    label: { en: 'Transport', sw: 'Usafiri' },
    tagline: { en: 'Verified drivers across Tanzania and beyond', sw: 'Madereva waliothibitishwa Tanzania na nje' },
    items: [
      { slug: 'airport-transfers', icon: 'plane-landing', label: { en: 'Airport transfers', sw: 'Usafiri wa uwanja wa ndege' }, blurb: { en: 'JRO, DAR, ZNZ and Arusha airports', sw: 'Viwanja vya JRO, DAR, ZNZ na Arusha' } },
      { slug: 'regional', icon: 'route', label: { en: 'Region to region', sw: 'Mkoa hadi mkoa' }, blurb: { en: 'Moshi, Arusha, Dar, Dodoma and more', sw: 'Moshi, Arusha, Dar, Dodoma na zaidi' } },
      { slug: 'cross-border', icon: 'globe', label: { en: 'Cross-border', sw: 'Kuvuka mpaka' }, blurb: { en: 'Kenya, Uganda, Rwanda and beyond', sw: 'Kenya, Uganda, Rwanda na zaidi' } },
      { slug: 'car-hire', icon: 'key', label: { en: 'Car & driver hire', sw: 'Kukodi gari na dereva' }, blurb: { en: 'By the day, with a local driver', sw: 'Kwa siku, na dereva wa ndani' } },
    ],
  },
  {
    slug: 'shop',
    icon: 'shopping-bag',
    label: { en: 'Gear & Shop', sw: 'Vifaa na Duka' },
    tagline: { en: 'Rent gear, and take a piece of Tanzania home', sw: 'Kodi vifaa, na beba kipande cha Tanzania nyumbani' },
    items: [
      { slug: 'rent-gear', icon: 'repeat', label: { en: 'Rent gear locally', sw: 'Kodi vifaa hapa' }, blurb: { en: 'Sleeping bags, jackets, poles, boots', sw: 'Mifuko ya kulalia, jaketi, fimbo, viatu' } },
      { slug: 'buy-gear', icon: 'tent', label: { en: 'Buy before you fly', sw: 'Nunua kabla ya kusafiri' }, blurb: { en: 'Guide-approved packing lists', sw: 'Orodha za vifaa zilizoidhinishwa na waongozaji' } },
      { slug: 'art', icon: 'palette', label: { en: 'Art & crafts', sw: 'Sanaa na kazi za mikono' }, blurb: { en: 'Tingatinga, Makonde carvings, beadwork', sw: 'Tingatinga, vinyago vya Makonde, shanga' } },
      { slug: 'tanzanite', icon: 'gem', label: { en: 'Tanzanite & gems', sw: 'Tanzanite na vito' }, blurb: { en: 'Licensed dealers only, with certificates', sw: 'Wauzaji wenye leseni tu, pamoja na vyeti' } },
    ],
  },
  {
    slug: 'local',
    icon: 'sparkles',
    label: { en: 'Local life', sw: 'Maisha ya mtaani' },
    tagline: { en: 'Where locals go, recommended by guides', sw: 'Wanakoenda wenyeji, kwa mapendekezo ya waongozaji' },
    items: [
      { slug: 'massage', icon: 'flower-2', label: { en: 'Massage & spa', sw: 'Masaji na spa' }, blurb: { en: 'Recover after the climb', sw: 'Pumzika baada ya kupanda' } },
      { slug: 'salons', icon: 'scissors', label: { en: 'Salons & barbers', sw: 'Saluni na kinyozi' }, blurb: { en: 'Braids, cuts and beauty', sw: 'Kusuka, kunyoa na urembo' } },
      { slug: 'food', icon: 'utensils-crossed', label: { en: 'Swahili food spots', sw: 'Vyakula vya Kiswahili' }, blurb: { en: 'Nyama choma, pilau, street food', sw: 'Nyama choma, pilau, vyakula vya mtaani' } },
      { slug: 'hot-spots', icon: 'music', label: { en: 'Nightlife & hot spots', sw: 'Starehe na sehemu maarufu' }, blurb: { en: 'Live music, clubs, rooftops', sw: 'Muziki, klabu, sehemu za juu' } },
    ],
  },
  {
    slug: 'discover',
    icon: 'book-open',
    label: { en: 'Discover', sw: 'Gundua' },
    tagline: { en: 'Stories, events and opportunities', sw: 'Hadithi, matukio na fursa' },
    items: [
      { slug: 'stories', icon: 'book-open', label: { en: 'Guide stories', sw: 'Hadithi za waongozaji' }, blurb: { en: 'Real stories from the trail', sw: 'Hadithi halisi kutoka safarini' } },
      { slug: 'afcon-2027', icon: 'trophy', label: { en: 'AFCON 2027', sw: 'AFCON 2027' }, blurb: { en: 'Match-day transfers and city tours', sw: 'Usafiri wa mechi na ziara za mji' } },
      { slug: 'invest', icon: 'trending-up', label: { en: 'Invest in Tanzania', sw: 'Wekeza Tanzania' }, blurb: { en: 'Tourism projects, introduced with TISEZA guidance', sw: 'Miradi ya utalii, kwa mwongozo wa TISEZA' } },
      { slug: 'hire-crew', icon: 'briefcase', href: '/jobs/post', status: 'live', label: { en: 'Hire guides & crew', sw: 'Ajiri waongozaji na wafanyakazi' }, blurb: { en: 'For companies: post a job for guides, cooks, porters', sw: 'Kwa makampuni: tangaza kazi kwa waongozaji, wapishi, wapagazi' } },
    ],
  },
];

// The Guide Hub menu is only shown to verified guides (and admins).
export const HUB_MENU: MenuItem[] = [
  { slug: 'hub', icon: 'layout-dashboard', href: '/hub', status: 'live', label: { en: 'Hub home', sw: 'Mwanzo' }, blurb: { en: 'Your requests, calls and news', sw: 'Maombi, simu na habari zako' } },
  { slug: 'forum', icon: 'messages-square', href: '/hub/forum', status: 'live', label: { en: 'Guide forum', sw: 'Jukwaa' }, blurb: { en: 'Park updates, sightings, advice', sw: 'Habari za hifadhi, wanyama, ushauri' } },
  { slug: 'news', icon: 'newspaper', href: '/hub/news', status: 'live', label: { en: 'Field news', sw: 'Habari za uwanjani' }, blurb: { en: 'Official updates from parks and authorities', sw: 'Taarifa rasmi kutoka hifadhi na mamlaka' } },
  { slug: 'jobs', icon: 'briefcase', href: '/hub/jobs', status: 'live', label: { en: 'Jobs', sw: 'Kazi' }, blurb: { en: 'Companies hiring guides and crew', sw: 'Makampuni yanayoajiri' } },
  { slug: 'profile', icon: 'user-round', href: '/dashboard', status: 'live', label: { en: 'My profile', sw: 'Wasifu wangu' }, blurb: { en: 'Edit your public profile and calls', sw: 'Hariri wasifu na simu zako' } },
];

export function findMenuItem(sectionSlug: string, itemSlug: string) {
  const section = MENU.find((s) => s.slug === sectionSlug);
  const item = section?.items.find((i) => i.slug === itemSlug);
  return section && item ? { section, item } : null;
}
