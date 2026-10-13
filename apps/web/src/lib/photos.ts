// Stock photos from Unsplash (free for commercial use under the Unsplash License, no attribution
// required; we credit photographers anyway). Every photo below was checked to be taken in Tanzania.
// Replace with Rafrika's own photos over time.

export type Photo = { id: string; alt: string; credit: string };

export const PHOTOS = {
  safariSunset: { id: 'photo-1516426122078-c23e76319801', alt: 'Safari vehicle at sunset in Tanzania', credit: 'Hu Chen' },
  kiliHikers: { id: 'photo-1621414050946-1b936a78491f', alt: 'Hikers above the clouds on Kilimanjaro', credit: 'Crispin Jones' },
  kiliSummit: { id: 'photo-1611961547440-bde7c756990f', alt: 'Climbers on the snowy summit of Kilimanjaro', credit: 'Kristoffer Darj' },
  kiliCamp: { id: 'photo-1588445599591-efe468e9c3ce', alt: 'Mountain camp below a snowy peak in Tanzania', credit: 'Yoad Shejtman' },
  kiliStars: { id: 'photo-1654025457990-2ac9b07a80d2', alt: 'Tent under a starry night sky in Tanzania', credit: 'David Phan' },
  migration: { id: 'photo-1564101160531-4838e8a5f4e7', alt: 'Wildebeest crossing a river in the Serengeti', credit: 'Jorge Tung' },
  serengetiHerd: { id: 'photo-1580145575237-75fec2a0320b', alt: 'Wildebeest grazing in the Serengeti with safari vehicles', credit: 'Dawn Westveld' },
  ngorongoro: { id: 'photo-1600637468460-1fa84e8eddea', alt: 'Road into the Ngorongoro Crater', credit: 'Ben Preater' },
  lions: { id: 'photo-1507088164404-020d1e905959', alt: 'Pride of lions walking on dry grass in Tanzania', credit: 'Jeff Lemond' },
  cheetah: { id: 'photo-1516628368662-4220aaf9339d', alt: 'Cheetah resting in the grass in Tanzania', credit: 'Hu Chen' },
  buffaloCar: { id: 'photo-1516497084411-042e90c17be1', alt: 'Safari vehicle passing a herd of buffalo', credit: 'Hu Chen' },
  elephantsRiver: { id: 'photo-1728238054897-05023133fe90', alt: 'Elephants crossing a river in Tanzania', credit: 'Florian Müller' },
  elephantsBalloon: { id: 'photo-1707410437019-40c82e3a417f', alt: 'Elephants and a hot-air balloon in Tanzania', credit: 'Tanzania Wild Sky' },
  flamingos: { id: 'photo-1713639160585-fa2ea361e01e', alt: 'Flamingos standing in a lake in Tanzania', credit: 'Pasha Simakov' },
  maasai: { id: 'photo-1591290689629-8ad3a992b3b9', alt: 'Maasai people on a green field in Tanzania', credit: 'Ramon Sanchez Orense' },
  zanzibarBeach: { id: 'photo-1575999502951-4ab25b5ca889', alt: 'White-sand beach with palm trees on Zanzibar', credit: 'Humphrey M' },
  zanzibarBoats: { id: 'photo-1621583628955-42fbc37bf424', alt: 'Wooden boats in turquoise water off a Tanzanian beach', credit: 'Olga Budko' },
  dhowSunset: { id: 'photo-1511684633137-6b5fc88b3dbc', alt: 'Dhow sailing at sunset off Nungwi, Zanzibar', credit: 'Camilla Frederiksen' },
  stoneTownDoor: { id: 'photo-1676157396377-e886378a295b', alt: 'Carved door in a Stone Town alley, Zanzibar', credit: 'Nichika Sakurai' },
  stoneTownStreet: { id: 'photo-1695643875095-f5620748605d', alt: 'Busy market street in Zanzibar', credit: 'Aron Marinelli' },
  stoneTownPalm: { id: 'photo-1713253981772-c3dcda50b748', alt: 'Historic building and palm tree in Zanzibar', credit: 'Alferio Njau' },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;

export function photoUrl(photo: Photo, width = 1600) {
  return `https://images.unsplash.com/${photo.id}?auto=format&fit=crop&w=${width}&q=70`;
}

// Hero photo for each menu section.
export const SECTION_PHOTOS: Record<string, PhotoKey> = {
  safaris: 'migration',
  trips: 'kiliHikers',
  special: 'elephantsBalloon',
  partners: 'safariSunset',
  stay: 'zanzibarBeach',
  transport: 'buffaloCar',
  shop: 'stoneTownDoor',
  local: 'stoneTownStreet',
  discover: 'flamingos',
};

// Cover photo for each trip; falls back to the first category.
const TRIP_PHOTOS: Record<string, PhotoKey> = {
  'serengeti-ngorongoro-4-days': 'serengetiHerd',
  'northern-circuit-7-days': 'lions',
  'migration-calving-safari-6-days': 'migration',
  'arusha-national-park-day': 'cheetah',
  'tarangire-day-trip': 'elephantsRiver',
  'kilimanjaro-machame-7-days': 'kiliSummit',
  'kilimanjaro-lemosho-8-days': 'kiliStars',
  'kilimanjaro-marangu-6-days': 'kiliHikers',
  'mount-meru-4-days': 'kiliCamp',
  'ol-doinyo-lengai-natron-3-days': 'flamingos',
  'mto-wa-mbu-village-bike': 'maasai',
  'lake-eyasi-hadzabe-2-days': 'maasai',
  'nyerere-boat-walking-4-days': 'elephantsBalloon',
  'ruaha-wilderness-5-days': 'elephantsRiver',
  'mikumi-2-days': 'buffaloCar',
  'zanzibar-stone-town-spice': 'stoneTownDoor',
  'zanzibar-beach-mnemba-4-days': 'zanzibarBoats',
  'bagamoyo-history-day': 'stoneTownPalm',
  'kilwa-kisiwani-3-days': 'stoneTownPalm',
  'kili-safari-zanzibar-15-days': 'kiliSummit',
  'safari-zanzibar-9-days': 'zanzibarBeach',
  'kili-cultural-immersion-10-days': 'maasai',
  'signature-guides-day-off': 'kiliCamp',
  'signature-walk-with-a-kili-guide': 'kiliHikers',
  'signature-afcon-2027-fan-days': 'safariSunset',
  'signature-spice-stone-sea': 'dhowSunset',
};

const CATEGORY_PHOTOS: Record<string, PhotoKey> = {
  safari: 'serengetiHerd',
  mountain: 'kiliHikers',
  cultural: 'maasai',
  beach: 'zanzibarBeach',
  historical: 'stoneTownPalm',
  marine: 'dhowSunset',
  chimpanzee: 'elephantsBalloon',
  walking: 'kiliCamp',
  event: 'safariSunset',
};

export function tripPhoto(slug: string, categories: string[]): Photo {
  return PHOTOS[TRIP_PHOTOS[slug] ?? CATEGORY_PHOTOS[categories[0] ?? 'safari'] ?? 'safariSunset'];
}

// Cover photo for a group trip, chosen by the kind of trip (guide specialty).
const SPECIALTY_PHOTOS: Record<string, PhotoKey> = {
  mountain: 'kiliHikers',
  safari: 'serengetiHerd',
  cultural: 'maasai',
  city: 'stoneTownStreet',
  birding: 'flamingos',
  marine: 'dhowSunset',
  photography: 'lions',
  day_trips: 'kiliCamp',
};

export function specialtyPhoto(specialty: string): Photo {
  return PHOTOS[SPECIALTY_PHOTOS[specialty] ?? 'safariSunset'];
}
