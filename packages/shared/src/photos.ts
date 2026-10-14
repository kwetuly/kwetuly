// Rafrika's own photos (local: true, served from the website's /photos folder and bundled in the
// app) plus stock photos from Unsplash (free for commercial use under the Unsplash License, no
// attribution required; we credit photographers anyway). Every stock photo was checked to be taken
// in Tanzania and to be free (not Unsplash+).

export type Photo = { id: string; alt: string; credit: string; local?: true };

export const PHOTOS = {
  // Rafrika's own photos from Kilimanjaro (location data removed).
  kiliCampMawenzi: { id: 'kili-camp-mawenzi', alt: 'Tents above the clouds on Kilimanjaro, with Mawenzi peak behind', credit: 'Rafrika', local: true },
  saddleHikers: { id: 'saddle-hikers-mawenzi', alt: 'A guided group walking across the Kilimanjaro saddle towards Mawenzi', credit: 'Rafrika', local: true },
  kiboSaddleHikers: { id: 'kibo-saddle-hikers', alt: 'Hikers on the trail to Kibo, the summit cone of Kilimanjaro', credit: 'Rafrika', local: true },
  kiboFromShira: { id: 'kibo-from-shira', alt: 'Kibo peak above the moorland of the Shira Plateau', credit: 'Rafrika', local: true },
  kiboHutTrail: { id: 'kibo-hut-trail', alt: 'Hikers on the alpine desert below Kibo Hut, Kilimanjaro', credit: 'Rafrika', local: true },
  kiliMoorland: { id: 'kili-moorland-trail', alt: 'Rocky moorland trail with Kibo peak in the distance', credit: 'Rafrika', local: true },
  mawenziClouds: { id: 'mawenzi-clouds', alt: 'Mawenzi peak under a clear blue sky', credit: 'Rafrika', local: true },
  mawenziMist: { id: 'mawenzi-mist', alt: 'Mist rolling past Mawenzi peak over the heath', credit: 'Rafrika', local: true },
  kiboCrater: { id: 'kibo-crater-glacier', alt: 'The crater rim and glaciers at the top of Kilimanjaro at sunrise', credit: 'Rafrika', local: true },
  uhuruPeak: { id: 'uhuru-peak', alt: 'Climbers at the Uhuru Peak summit sign, 5,895 m', credit: 'Rafrika', local: true },
  kiliRainforest: { id: 'kili-rainforest-hikers', alt: 'A group hiking through the Kilimanjaro rainforest', credit: 'Rafrika', local: true },
  kiliRockyTrail: { id: 'kili-rocky-trail', alt: 'Hikers on a rocky trail with the snowy summit ahead', credit: 'Rafrika', local: true },
  kiliHeather: { id: 'kili-heather-zone', alt: 'Hikers in the heather zone above a sea of clouds', credit: 'Rafrika', local: true },
  mountainHut: { id: 'mountain-hut', alt: 'Bunk beds inside a mountain hut on the Marangu route', credit: 'Rafrika', local: true },
  colobus: { id: 'colobus-monkey', alt: 'Black-and-white colobus monkey in the forest', credit: 'Rafrika', local: true },
  blueMonkey: { id: 'blue-monkey', alt: 'Blue monkey on a forest trail on Kilimanjaro', credit: 'Rafrika', local: true },
  // Unsplash stock photos.
  leopardTree: { id: 'photo-1667987486234-a1330e262ea3', alt: 'Leopard resting in a tree in Tarangire', credit: 'Uzuri Safaris Tanzania' },
  giraffesBalloon: { id: 'photo-1707410436230-d4b2fba910e7', alt: 'Giraffes and a hot-air balloon in the Serengeti', credit: 'Tanzania Wild Sky' },
  elephantDrinking: { id: 'photo-1627394678482-833a3d8d10f5', alt: 'Elephant drinking at a lake in Tanzania', credit: 'Elliot Paris' },
  elephantsTarangire: { id: 'photo-1507087549419-3ec469e82d13', alt: 'Elephants among trees in Tarangire National Park', credit: 'Jeff Lemond' },
  buffaloGolden: { id: 'photo-1528277342758-f1d7613953a2', alt: 'Buffalo herd at golden hour in Tarangire', credit: 'Ray Rui' },
  ngorongoroView: { id: 'photo-1745885979468-44a855f8a5fa', alt: 'View down into the Ngorongoro Crater and its lake', credit: 'Matthew Stephenson' },
  darAerial: { id: 'photo-1589177900326-900782f88a55', alt: 'Dar es Salaam city and harbour from the air', credit: 'Peter Mitchell' },
  darHarbour: { id: 'photo-1674334264912-704cb2a24b37', alt: 'Dar es Salaam skyline over the water', credit: 'Nichika Sakurai' },
  darStreet: { id: 'photo-1718010561203-ababa995734f', alt: 'Fruit seller pushing a cart down a street in Tanzania', credit: 'Ali Mkumbwa' },
  nyerereBoat: { id: 'photo-1706870661152-de9fdc995dae', alt: 'Safari boat on the Rufiji River in Nyerere National Park', credit: 'Bart van der Lugt' },
  hadzabe: { id: 'photo-1673667617977-667fb61a9833', alt: 'Hadzabe men by their camp at Lake Eyasi', credit: 'Denice Alex' },
  bagamoyoRuins: { id: 'photo-1678636150498-cd1ee537901d', alt: 'Old stone building and steps in Bagamoyo', credit: 'Nichika Sakurai' },
  mountMeru: { id: 'photo-1673667618122-359046273a77', alt: 'Mount Meru rising above Arusha', credit: 'Denice Alex' },
  footballMwanza: { id: 'photo-1678709113455-462f8d341c22', alt: 'A football match on a pitch in Mwanza', credit: 'Temidayo' },
  basketMarket: { id: 'photo-1776409933815-3497439f829a', alt: 'Woven baskets and produce at a roadside market near Arusha', credit: 'Omar' },
  lodgePool: { id: 'photo-1667987566780-3b31fa5485c8', alt: 'Lodge pool looking out over the Serengeti', credit: 'Uzuri Safaris Tanzania' },
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

/** Web URL of a photo. Own photos are files on the website (the app bundles its own copies, see
 * apps/mobile/src/lib/photos.ts); stock photos are resized by Unsplash. */
export function photoUrl(photo: Photo, width = 1600) {
  if (photo.local) return `/photos/${photo.id}.jpg`;
  return `https://images.unsplash.com/${photo.id}?auto=format&fit=crop&w=${width}&q=80`;
}

// Hero photo for each menu section.
export const SECTION_PHOTOS: Record<string, PhotoKey> = {
  safaris: 'migration',
  trips: 'kiliRainforest',
  special: 'elephantsBalloon',
  partners: 'safariSunset',
  stay: 'lodgePool',
  transport: 'buffaloCar',
  shop: 'basketMarket',
  local: 'darStreet',
  discover: 'flamingos',
};

// Cover photo for each trip; falls back to the first category.
const TRIP_PHOTOS: Record<string, PhotoKey> = {
  'serengeti-ngorongoro-4-days': 'ngorongoroView',
  'northern-circuit-7-days': 'leopardTree',
  'migration-calving-safari-6-days': 'migration',
  'arusha-national-park-day': 'colobus',
  'tarangire-day-trip': 'elephantsTarangire',
  'kilimanjaro-machame-7-days': 'kiboCrater',
  'kilimanjaro-lemosho-8-days': 'kiboFromShira',
  'kilimanjaro-marangu-6-days': 'kiboHutTrail',
  'mount-meru-4-days': 'mountMeru',
  'ol-doinyo-lengai-natron-3-days': 'flamingos',
  'mto-wa-mbu-village-bike': 'maasai',
  'lake-eyasi-hadzabe-2-days': 'hadzabe',
  'nyerere-boat-walking-4-days': 'nyerereBoat',
  'ruaha-wilderness-5-days': 'elephantsRiver',
  'mikumi-2-days': 'buffaloCar',
  'zanzibar-stone-town-spice': 'stoneTownDoor',
  'zanzibar-beach-mnemba-4-days': 'zanzibarBoats',
  'bagamoyo-history-day': 'bagamoyoRuins',
  'kilwa-kisiwani-3-days': 'bagamoyoRuins', // no free photo of Kilwa yet: a coastal ruin stands in
  'kili-safari-zanzibar-15-days': 'uhuruPeak',
  'safari-zanzibar-9-days': 'zanzibarBeach',
  'kili-cultural-immersion-10-days': 'maasai',
  'signature-guides-day-off': 'kiliCampMawenzi',
  'signature-walk-with-a-kili-guide': 'kiliRainforest',
  'signature-afcon-2027-fan-days': 'footballMwanza',
  'signature-spice-stone-sea': 'dhowSunset',
};

const CATEGORY_PHOTOS: Record<string, PhotoKey> = {
  safari: 'serengetiHerd',
  mountain: 'saddleHikers',
  cultural: 'maasai',
  beach: 'zanzibarBeach',
  historical: 'bagamoyoRuins',
  marine: 'dhowSunset',
  chimpanzee: 'colobus', // no free photo of Tanzanian chimps yet: a forest primate stands in
  walking: 'kiliRockyTrail',
  event: 'footballMwanza',
};

export function tripPhoto(slug: string, categories: string[]): Photo {
  return PHOTOS[TRIP_PHOTOS[slug] ?? CATEGORY_PHOTOS[categories[0] ?? 'safari'] ?? 'safariSunset'];
}

// Cover photo for a group trip, chosen by the kind of trip (guide specialty).
const SPECIALTY_PHOTOS: Record<string, PhotoKey> = {
  mountain: 'saddleHikers',
  safari: 'giraffesBalloon',
  cultural: 'maasai',
  city: 'darAerial',
  birding: 'flamingos',
  marine: 'dhowSunset',
  photography: 'leopardTree',
  day_trips: 'blueMonkey',
};

export function specialtyPhoto(specialty: string): Photo {
  return PHOTOS[SPECIALTY_PHOTOS[specialty] ?? 'safariSunset'];
}
