// Site and app navigation. Each section has a URL slug and items shown in its dropdown.
// `status: 'soon'` items show a "coming soon" page that collects interest and listings.
// Labels are in the order en, sw, fr, it, de, pl, zh (see locales.ts).

import { GUIDE_EXPERTISE } from './expertise';
import { GUIDE_SPECIALTIES } from './guides';
import { L, type Label } from './locales';

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

function specialtyItem(s: (typeof GUIDE_SPECIALTIES)[number]): MenuItem {
  const { id, en, sw, fr, it, de, pl, zh } = s;
  return {
    slug: `${id.replace(/_/g, '-')}-guides`,
    icon: SPECIALTY_ICONS[id] ?? 'compass',
    href: `/guides?specialty=${id}`,
    status: 'live',
    label: { en, sw, fr, it, de, pl, zh },
    blurb: GUIDE_SPECIALTY_BLURB,
  };
}

const SPECIALTY_ICONS: Record<string, string> = {
  mountain: 'mountain',
  safari: 'binoculars',
  cultural: 'users',
  city: 'building-2',
  birding: 'bird',
  marine: 'sailboat',
  day_trips: 'sun',
};

const GUIDE_SPECIALTY_BLURB = L('Verified guides who specialise in this', 'Waongozaji waliobobea katika hili', 'Guides vérifiés spécialisés dans ce domaine', 'Guide verificate specializzate in questo', 'Geprüfte Guides mit diesem Schwerpunkt', 'Sprawdzeni przewodnicy z tą specjalizacją', '专精此领域的认证导游');

function expertiseItem(e: (typeof GUIDE_EXPERTISE)[number]): MenuItem {
  return { slug: e.id.replace(/_/g, '-'), icon: e.icon, href: `/guides?expertise=${e.id}`, status: 'live', label: e.label, blurb: e.blurb };
}

const SECTIONS: MenuSection[] = [
  {
    // URL slug is "trips" because /guides/[slug] is used for guide profiles.
    slug: 'trips',
    icon: 'compass',
    label: L('Guides', 'Waongozaji', 'Guides', 'Guide', 'Guides', 'Przewodnicy', '导游'),
    tagline: L(
      'Verified local guides, booked direct',
      'Waongozaji waliothibitishwa, moja kwa moja',
      'Des guides locaux vérifiés, réservés en direct',
      'Guide locali verificate, prenotate direttamente',
      'Geprüfte lokale Guides, direkt gebucht',
      'Sprawdzeni lokalni przewodnicy, rezerwowani bezpośrednio',
      '经过认证的本地导游，直接预订',
    ),
    items: [
      {
        slug: 'find', icon: 'users', href: '/guides', status: 'live',
        label: L('Find a guide', 'Tafuta mwongozaji', 'Trouver un guide', 'Trova una guida', 'Guide finden', 'Znajdź przewodnika', '寻找导游'),
        blurb: L('Filter by language, region and experience', 'Chuja kwa lugha, mkoa na uzoefu', 'Filtrer par langue, région et expérience', 'Filtra per lingua, regione ed esperienza', 'Nach Sprache, Region und Erfahrung filtern', 'Filtruj według języka, regionu i doświadczenia', '按语言、地区和经验筛选'),
      },
      {
        slug: 'female', icon: 'venus', href: '/guides?female=1', status: 'live',
        label: L('Female guides', 'Waongozaji wanawake', 'Guides femmes', 'Guide donne', 'Weibliche Guides', 'Przewodniczki', '女性导游'),
        blurb: L('Women who lead climbs, safaris and city tours', 'Wanawake wanaoongoza milima, safari na ziara za mji', 'Des femmes qui mènent ascensions, safaris et visites', 'Donne che guidano scalate, safari e tour in città', 'Frauen, die Besteigungen, Safaris und Stadttouren leiten', 'Kobiety prowadzące wejścia, safari i zwiedzanie', '带领登山、游猎和城市游的女性导游'),
      },
      {
        slug: 'by-language', icon: 'languages', href: '/guides#languages', status: 'live',
        label: L('Guides by language', 'Waongozaji kwa lugha', 'Guides par langue', 'Guide per lingua', 'Guides nach Sprache', 'Przewodnicy według języka', '按语言找导游'),
        blurb: L('French, Italian, German, Polish, Chinese and more', 'Kifaransa, Kiitaliano, Kijerumani, Kipolandi, Kichina na zaidi', 'Français, italien, allemand, polonais, chinois et plus', 'Francese, italiano, tedesco, polacco, cinese e altre', 'Französisch, Italienisch, Deutsch, Polnisch, Chinesisch und mehr', 'Francuski, włoski, niemiecki, polski, chiński i inne', '法语、意大利语、德语、波兰语、中文等'),
      },
      // One link per kind of work, except photography which sits under Special trips.
      ...GUIDE_SPECIALTIES.filter((s) => s.id !== 'photography').map(specialtyItem),
      {
        slug: 'calls', icon: 'video', href: '/calls', status: 'live',
        label: L('1-on-1 prep calls', 'Simu za maandalizi', 'Appels de préparation 1-à-1', 'Chiamate di preparazione 1:1', '1:1-Vorbereitungsgespräche', 'Rozmowy przygotowawcze 1:1', '一对一行前咨询'),
        blurb: L('Kili, safari or Zanzibar advice from a guide you choose', 'Ushauri wa Kili, safari au Zanzibar kutoka kwa mwongozaji unayemchagua', 'Conseils Kili, safari ou Zanzibar par le guide de votre choix', 'Consigli su Kili, safari o Zanzibar dalla guida che scegli', 'Tipps zu Kili, Safari oder Sansibar von einem Guide Ihrer Wahl', 'Porady o Kili, safari lub Zanzibarze od wybranego przewodnika', '由你选择的导游提供乞力马扎罗、游猎或桑给巴尔建议'),
      },
      {
        slug: 'group-trips', icon: 'users-round', href: '/group-trips', status: 'live',
        label: L('Join a group trip', 'Jiunge na kundi', 'Rejoindre un groupe', 'Unisciti a un gruppo', 'Gruppenreise beitreten', 'Dołącz do grupy', '加入拼团行程'),
        blurb: L('Share a trip, split the cost', 'Shiriki safari, gawana gharama', 'Partagez un voyage, divisez les frais', 'Condividi il viaggio, dividi i costi', 'Reise teilen, Kosten teilen', 'Wspólna wyprawa, wspólne koszty', '同行出游，分摊费用'),
      },
      {
        slug: 'trip-requests', icon: 'gavel', href: '/requests/new', status: 'live',
        label: L('Post a trip request', 'Weka ombi la safari', 'Publier une demande de voyage', 'Pubblica una richiesta di viaggio', 'Reiseanfrage stellen', 'Dodaj zapytanie o wyprawę', '发布行程需求'),
        blurb: L('Describe your trip, verified guides send offers', 'Eleza safari yako, waongozaji wanakutumia ofa', 'Décrivez votre voyage, les guides vous font des offres', 'Descrivi il viaggio, le guide ti fanno offerte', 'Reise beschreiben, Guides schicken Angebote', 'Opisz wyprawę, przewodnicy przyślą oferty', '描述行程，认证导游为你报价'),
      },
    ],
  },
  {
    // Special trips: each item opens the guide list filtered by that expertise.
    slug: 'special',
    icon: 'heart-handshake',
    label: L('Special trips', 'Safari maalum', 'Voyages spéciaux', 'Viaggi speciali', 'Spezialreisen', 'Wyprawy specjalne', '特色主题游'),
    tagline: L(
      'Guides with the skills your trip needs',
      'Waongozaji wenye ujuzi ambao safari yako inahitaji',
      'Des guides aux compétences adaptées à votre voyage',
      'Guide con le competenze che servono al tuo viaggio',
      'Guides mit genau den Fähigkeiten, die Ihre Reise braucht',
      'Przewodnicy z umiejętnościami, jakich wymaga Twoja podróż',
      '具备你的旅程所需专长的导游',
    ),
    items: [
      ...GUIDE_EXPERTISE.slice(0, 4).map(expertiseItem),
      {
        slug: 'photography', icon: 'camera', href: '/guides?specialty=photography', status: 'live',
        label: L('Photography safaris', 'Safari za upigaji picha', 'Safaris photo', 'Safari fotografici', 'Fotosafaris', 'Safari fotograficzne', '摄影游猎'),
        blurb: L('Guides who know light, angles and animal behaviour', 'Waongozaji wanaojua mwanga, pembe na tabia za wanyama', 'Des guides qui connaissent la lumière et les animaux', 'Guide esperte di luce, inquadrature e animali', 'Guides, die Licht, Perspektiven und Tierverhalten kennen', 'Przewodnicy znający światło, kadry i zachowania zwierząt', '懂光线、角度和动物习性的导游'),
      },
      ...GUIDE_EXPERTISE.slice(4).map(expertiseItem),
    ],
  },
  {
    // Trip catalogue lives at /tours; this section only groups the menu links.
    slug: 'safaris',
    icon: 'mountain',
    label: L('Safaris & Tours', 'Safari na Ziara', 'Safaris', 'Safari e tour', 'Safaris & Touren', 'Safari i wycieczki', '游猎与行程'),
    tagline: L(
      'Every circuit of Tanzania, with trusted local operators',
      'Kila kanda ya Tanzania, na waendeshaji wa ndani wanaoaminika',
      'Tous les circuits de Tanzanie, avec des opérateurs locaux de confiance',
      'Tutti i circuiti della Tanzania, con operatori locali affidabili',
      'Alle Regionen Tansanias, mit vertrauenswürdigen lokalen Anbietern',
      'Wszystkie szlaki Tanzanii z zaufanymi lokalnymi organizatorami',
      '坦桑尼亚所有线路，由可信赖的本地运营商提供',
    ),
    items: [
      {
        slug: 'all', icon: 'map', href: '/tours', status: 'live',
        label: L('All tours', 'Ziara zote', 'Tous les circuits', 'Tutti i tour', 'Alle Touren', 'Wszystkie wycieczki', '全部行程'),
        blurb: L('Northern, southern, western and coast', 'Kaskazini, kusini, magharibi na pwani', 'Nord, sud, ouest et côte', 'Nord, sud, ovest e costa', 'Norden, Süden, Westen und Küste', 'Północ, południe, zachód i wybrzeże', '北部、南部、西部与海岸'),
      },
      {
        slug: 'safari', icon: 'binoculars', href: '/tours?category=safari', status: 'live',
        label: L('Safaris', 'Safari za wanyama', 'Safaris', 'Safari', 'Safaris', 'Safari', '野生动物游猎'),
        blurb: L('Serengeti, Ngorongoro, Ruaha, Nyerere', 'Serengeti, Ngorongoro, Ruaha, Nyerere', 'Serengeti, Ngorongoro, Ruaha, Nyerere', 'Serengeti, Ngorongoro, Ruaha, Nyerere', 'Serengeti, Ngorongoro, Ruaha, Nyerere', 'Serengeti, Ngorongoro, Ruaha, Nyerere', '塞伦盖蒂、恩戈罗恩戈罗、鲁阿哈、尼雷尔'),
      },
      {
        slug: 'climbs', icon: 'mountain', href: '/tours?category=mountain', status: 'live',
        label: L('Kilimanjaro & climbs', 'Kilimanjaro na milima', 'Kilimandjaro & ascensions', 'Kilimangiaro e scalate', 'Kilimandscharo & Besteigungen', 'Kilimandżaro i wejścia', '乞力马扎罗与登山'),
        blurb: L('Machame, Lemosho, Marangu, Meru, Lengai', 'Machame, Lemosho, Marangu, Meru, Lengai', 'Machame, Lemosho, Marangu, Meru, Lengai', 'Machame, Lemosho, Marangu, Meru, Lengai', 'Machame, Lemosho, Marangu, Meru, Lengai', 'Machame, Lemosho, Marangu, Meru, Lengai', 'Machame、Lemosho、Marangu、梅鲁山、伦盖火山'),
      },
      {
        slug: 'day-trips', icon: 'sun', href: '/tours?kind=day_trip', status: 'live',
        label: L('Day trips', 'Safari za siku moja', 'Excursions d’une journée', 'Escursioni giornaliere', 'Tagesausflüge', 'Wycieczki jednodniowe', '一日游'),
        blurb: L('Waterfalls, coffee farms, hot springs', 'Maporomoko, mashamba ya kahawa, chemchemi', 'Cascades, plantations de café, sources chaudes', 'Cascate, piantagioni di caffè, sorgenti calde', 'Wasserfälle, Kaffeefarmen, heiße Quellen', 'Wodospady, plantacje kawy, gorące źródła', '瀑布、咖啡农场、温泉'),
      },
      {
        slug: 'combos', icon: 'route', href: '/tours?kind=combo', status: 'live',
        label: L('Combo trips', 'Safari mchanganyiko', 'Voyages combinés', 'Viaggi combinati', 'Kombi-Reisen', 'Wycieczki łączone', '组合行程'),
        blurb: L('Kili + safari + Zanzibar and more', 'Kili + safari + Zanzibar na zaidi', 'Kili + safari + Zanzibar et plus', 'Kili + safari + Zanzibar e altro', 'Kili + Safari + Sansibar und mehr', 'Kili + safari + Zanzibar i więcej', '乞力马扎罗 + 游猎 + 桑给巴尔等'),
      },
      {
        slug: 'signature', icon: 'sparkles', href: '/tours?signature=1', status: 'live',
        label: L('Rafrika signature trips', 'Safari maalum za Rafrika', 'Voyages signature Rafrika', 'Viaggi firmati Rafrika', 'Rafrika Signature-Reisen', 'Autorskie wyprawy Rafrika', 'Rafrika 特色行程'),
        blurb: L('Unique trips designed by our guides', 'Safari za kipekee zilizobuniwa na waongozaji wetu', 'Des voyages uniques conçus par nos guides', 'Viaggi unici ideati dalle nostre guide', 'Einzigartige Reisen, von unseren Guides entworfen', 'Wyjątkowe wyprawy zaprojektowane przez naszych przewodników', '由我们的导游设计的独特行程'),
      },
    ],
  },
  {
    slug: 'stay',
    icon: 'bed-double',
    label: L('Stay', 'Malazi', 'Hébergement', 'Alloggi', 'Unterkünfte', 'Noclegi', '住宿'),
    tagline: L(
      'Places to sleep, checked by guides',
      'Malazi yaliyokaguliwa na waongozaji',
      'Des hébergements vérifiés par nos guides',
      'Alloggi verificati dalle guide',
      'Unterkünfte, von Guides geprüft',
      'Noclegi sprawdzone przez przewodników',
      '经导游核实的住宿',
    ),
    items: [
      {
        slug: 'hotels', icon: 'building-2',
        label: L('Hotels & lodges', 'Hoteli na loji', 'Hôtels & lodges', 'Hotel e lodge', 'Hotels & Lodges', 'Hotele i lodże', '酒店与营地小屋'),
        blurb: L('From town hotels to safari lodges', 'Kutoka hoteli za mjini hadi loji za safari', 'Des hôtels en ville aux lodges de safari', 'Dagli hotel in città ai lodge safari', 'Vom Stadthotel bis zur Safari-Lodge', 'Od hoteli w mieście po lodże safari', '从城市酒店到野生动物营地'),
      },
      {
        slug: 'homestays', icon: 'house',
        label: L('Homestays', 'Kukaa na familia', 'Chez l’habitant', 'Soggiorni in famiglia', 'Gastfamilien', 'Pobyt u rodziny', '民宿寄宿'),
        blurb: L('Live with a local family', 'Ishi na familia ya kienyeji', 'Vivez avec une famille locale', 'Vivi con una famiglia locale', 'Bei einer einheimischen Familie wohnen', 'Zamieszkaj z lokalną rodziną', '与当地家庭同住'),
      },
      {
        slug: 'hostels', icon: 'backpack',
        label: L('Hostels & backpackers', 'Hosteli', 'Auberges de jeunesse', 'Ostelli', 'Hostels', 'Hostele', '青年旅舍'),
        blurb: L('Budget beds and good company', 'Vitanda vya bei nafuu', 'Lits petits prix et bonne compagnie', 'Letti economici e buona compagnia', 'Günstige Betten und gute Gesellschaft', 'Tanie łóżka i dobre towarzystwo', '实惠床位，结识旅伴'),
      },
      {
        slug: 'rentals', icon: 'key-round',
        label: L('Holiday rentals', 'Nyumba za kupangisha', 'Locations de vacances', 'Case vacanza', 'Ferienwohnungen', 'Apartamenty wakacyjne', '度假租房'),
        blurb: L('Apartments and villas, Airbnb-style', 'Apartmenti na nyumba, kama Airbnb', 'Appartements et villas, façon Airbnb', 'Appartamenti e ville, stile Airbnb', 'Apartments und Villen, wie bei Airbnb', 'Apartamenty i wille w stylu Airbnb', '公寓和别墅，类似 Airbnb'),
      },
    ],
  },
  {
    slug: 'transport',
    icon: 'car',
    label: L('Transport', 'Usafiri', 'Transport', 'Trasporti', 'Transport', 'Transport', '交通'),
    tagline: L(
      'Verified drivers across Tanzania and beyond',
      'Madereva waliothibitishwa Tanzania na nje',
      'Des chauffeurs vérifiés en Tanzanie et au-delà',
      'Autisti verificati in Tanzania e oltre',
      'Geprüfte Fahrer in Tansania und darüber hinaus',
      'Sprawdzeni kierowcy w Tanzanii i poza nią',
      '坦桑尼亚及周边的认证司机',
    ),
    items: [
      {
        slug: 'airport-transfers', icon: 'plane-landing',
        label: L('Airport transfers', 'Usafiri wa uwanja wa ndege', 'Transferts aéroport', 'Transfer aeroportuali', 'Flughafentransfers', 'Transfery lotniskowe', '机场接送'),
        blurb: L('JRO, DAR, ZNZ and Arusha airports', 'Viwanja vya JRO, DAR, ZNZ na Arusha', 'Aéroports JRO, DAR, ZNZ et Arusha', 'Aeroporti JRO, DAR, ZNZ e Arusha', 'Flughäfen JRO, DAR, ZNZ und Arusha', 'Lotniska JRO, DAR, ZNZ i Arusha', 'JRO、DAR、ZNZ 和阿鲁沙机场'),
      },
      {
        slug: 'regional', icon: 'route',
        label: L('Region to region', 'Mkoa hadi mkoa', 'De région en région', 'Da regione a regione', 'Von Region zu Region', 'Między regionami', '跨地区交通'),
        blurb: L('Moshi, Arusha, Dar, Dodoma and more', 'Moshi, Arusha, Dar, Dodoma na zaidi', 'Moshi, Arusha, Dar, Dodoma et plus', 'Moshi, Arusha, Dar, Dodoma e altro', 'Moshi, Arusha, Dar, Dodoma und mehr', 'Moshi, Arusha, Dar, Dodoma i więcej', '莫希、阿鲁沙、达累斯萨拉姆、多多马等'),
      },
      {
        slug: 'cross-border', icon: 'globe',
        label: L('Cross-border', 'Kuvuka mpaka', 'Transfrontalier', 'Transfrontaliero', 'Grenzüberschreitend', 'Przez granicę', '跨境交通'),
        blurb: L('Kenya, Uganda, Rwanda and beyond', 'Kenya, Uganda, Rwanda na zaidi', 'Kenya, Ouganda, Rwanda et au-delà', 'Kenya, Uganda, Ruanda e oltre', 'Kenia, Uganda, Ruanda und weiter', 'Kenia, Uganda, Rwanda i dalej', '肯尼亚、乌干达、卢旺达等'),
      },
      {
        slug: 'car-hire', icon: 'key',
        label: L('Car & driver hire', 'Kukodi gari na dereva', 'Voiture avec chauffeur', 'Auto con autista', 'Auto mit Fahrer', 'Auto z kierowcą', '包车带司机'),
        blurb: L('By the day, with a local driver', 'Kwa siku, na dereva wa ndani', 'À la journée, avec un chauffeur local', 'A giornata, con un autista locale', 'Tageweise, mit einheimischem Fahrer', 'Na dzień, z lokalnym kierowcą', '按天计费，配本地司机'),
      },
    ],
  },
  {
    slug: 'shop',
    icon: 'shopping-bag',
    label: L('Gear & Shop', 'Vifaa na Duka', 'Équipement', 'Attrezzatura', 'Ausrüstung', 'Sprzęt i sklep', '装备与商店'),
    tagline: L(
      'Rent gear, and take a piece of Tanzania home',
      'Kodi vifaa, na beba kipande cha Tanzania nyumbani',
      'Louez votre équipement et rapportez un morceau de Tanzanie',
      'Noleggia l’attrezzatura e porta a casa un pezzo di Tanzania',
      'Ausrüstung leihen und ein Stück Tansania mit nach Hause nehmen',
      'Wypożycz sprzęt i zabierz kawałek Tanzanii do domu',
      '租借装备，把坦桑尼亚带回家',
    ),
    items: [
      {
        slug: 'rent-gear', icon: 'repeat',
        label: L('Rent gear locally', 'Kodi vifaa hapa', 'Louer sur place', 'Noleggio sul posto', 'Vor Ort leihen', 'Wypożycz na miejscu', '当地租借装备'),
        blurb: L('Sleeping bags, jackets, poles, boots', 'Mifuko ya kulalia, jaketi, fimbo, viatu', 'Sacs de couchage, vestes, bâtons, chaussures', 'Sacchi a pelo, giacche, bastoncini, scarponi', 'Schlafsäcke, Jacken, Stöcke, Stiefel', 'Śpiwory, kurtki, kije, buty', '睡袋、外套、登山杖、登山鞋'),
      },
      {
        slug: 'buy-gear', icon: 'tent',
        label: L('Buy before you fly', 'Nunua kabla ya kusafiri', 'Achetez avant de partir', 'Acquista prima di partire', 'Vor der Reise kaufen', 'Kup przed wylotem', '出发前选购'),
        blurb: L('Guide-approved packing lists', 'Orodha za vifaa zilizoidhinishwa na waongozaji', 'Listes d’équipement validées par les guides', 'Liste di cosa portare approvate dalle guide', 'Packlisten, von Guides empfohlen', 'Listy rzeczy zatwierdzone przez przewodników', '导游推荐的行李清单'),
      },
      {
        slug: 'art', icon: 'palette',
        label: L('Art & crafts', 'Sanaa na kazi za mikono', 'Art & artisanat', 'Arte e artigianato', 'Kunst & Handwerk', 'Sztuka i rękodzieło', '艺术与手工艺品'),
        blurb: L('Tingatinga, Makonde carvings, beadwork', 'Tingatinga, vinyago vya Makonde, shanga', 'Tingatinga, sculptures Makonde, perles', 'Tingatinga, sculture Makonde, perline', 'Tingatinga, Makonde-Schnitzereien, Perlenarbeiten', 'Tingatinga, rzeźby Makonde, koraliki', '廷加廷加画、马孔德木雕、串珠'),
      },
      {
        slug: 'tanzanite', icon: 'gem',
        label: L('Tanzanite & gems', 'Tanzanite na vito', 'Tanzanite & pierres', 'Tanzanite e gemme', 'Tansanit & Edelsteine', 'Tanzanit i kamienie', '坦桑石与宝石'),
        blurb: L('Licensed dealers only, with certificates', 'Wauzaji wenye leseni tu, pamoja na vyeti', 'Uniquement des vendeurs agréés, avec certificat', 'Solo rivenditori autorizzati, con certificato', 'Nur lizenzierte Händler, mit Zertifikat', 'Tylko licencjonowani sprzedawcy, z certyfikatem', '仅限持证商家，附证书'),
      },
    ],
  },
  {
    slug: 'local',
    icon: 'sparkles',
    label: L('Local life', 'Maisha ya mtaani', 'Vie locale', 'Vita locale', 'Lokales Leben', 'Lokalne życie', '当地生活'),
    tagline: L(
      'Where locals go, recommended by guides',
      'Wanakoenda wenyeji, kwa mapendekezo ya waongozaji',
      'Là où vont les locaux, recommandé par les guides',
      'Dove vanno i locali, consigliato dalle guide',
      'Wo Einheimische hingehen, von Guides empfohlen',
      'Tam, gdzie chodzą miejscowi, polecane przez przewodników',
      '当地人常去的地方，导游推荐',
    ),
    items: [
      {
        slug: 'massage', icon: 'flower-2',
        label: L('Massage & spa', 'Masaji na spa', 'Massage & spa', 'Massaggi e spa', 'Massage & Spa', 'Masaż i spa', '按摩与水疗'),
        blurb: L('Recover after the climb', 'Pumzika baada ya kupanda', 'Récupérez après l’ascension', 'Recupera dopo la scalata', 'Erholung nach dem Aufstieg', 'Regeneracja po wspinaczce', '登山后放松恢复'),
      },
      {
        slug: 'salons', icon: 'scissors',
        label: L('Salons & barbers', 'Saluni na kinyozi', 'Salons & barbiers', 'Saloni e barbieri', 'Salons & Barbiere', 'Salony i fryzjerzy', '美发与理发'),
        blurb: L('Braids, cuts and beauty', 'Kusuka, kunyoa na urembo', 'Tresses, coupes et beauté', 'Treccine, tagli e bellezza', 'Zöpfe, Haarschnitte und Beauty', 'Warkoczyki, strzyżenie i uroda', '编发、剪发与美容'),
      },
      {
        slug: 'food', icon: 'utensils-crossed',
        label: L('Swahili food spots', 'Vyakula vya Kiswahili', 'Cuisine swahilie', 'Cucina swahili', 'Swahili-Küche', 'Kuchnia suahili', '斯瓦希里美食'),
        blurb: L('Nyama choma, pilau, street food', 'Nyama choma, pilau, vyakula vya mtaani', 'Nyama choma, pilau, cuisine de rue', 'Nyama choma, pilau, street food', 'Nyama Choma, Pilau, Streetfood', 'Nyama choma, pilau, jedzenie uliczne', '烤肉、香料饭、街头小吃'),
      },
      {
        slug: 'hot-spots', icon: 'music',
        label: L('Nightlife & hot spots', 'Starehe na sehemu maarufu', 'Vie nocturne & bons plans', 'Vita notturna e locali', 'Nachtleben & Hotspots', 'Życie nocne i modne miejsca', '夜生活与热门去处'),
        blurb: L('Live music, clubs, rooftops', 'Muziki, klabu, sehemu za juu', 'Concerts, clubs, rooftops', 'Musica dal vivo, club, rooftop', 'Livemusik, Clubs, Rooftops', 'Muzyka na żywo, kluby, tarasy', '现场音乐、俱乐部、屋顶酒吧'),
      },
    ],
  },
  {
    slug: 'discover',
    icon: 'book-open',
    label: L('Discover', 'Gundua', 'Découvrir', 'Scopri', 'Entdecken', 'Odkrywaj', '探索'),
    tagline: L(
      'Stories, events and opportunities',
      'Hadithi, matukio na fursa',
      'Histoires, événements et opportunités',
      'Storie, eventi e opportunità',
      'Geschichten, Events und Chancen',
      'Historie, wydarzenia i możliwości',
      '故事、活动与机会',
    ),
    items: [
      {
        slug: 'stories', icon: 'book-open',
        label: L('Guide stories', 'Hadithi za waongozaji', 'Récits de guides', 'Storie delle guide', 'Guide-Geschichten', 'Historie przewodników', '导游故事'),
        blurb: L('Real stories from the trail', 'Hadithi halisi kutoka safarini', 'De vraies histoires du terrain', 'Storie vere dal sentiero', 'Echte Geschichten vom Weg', 'Prawdziwe historie ze szlaku', '来自旅途的真实故事'),
      },
      {
        slug: 'moments', icon: 'camera', href: '/moments', status: 'live',
        label: L('Traveller moments', 'Matukio ya wasafiri', 'Moments de voyageurs', 'Momenti dei viaggiatori', 'Reisemomente', 'Chwile podróżników', '旅行者瞬间'),
        blurb: L('Photos and tips shared by travellers', 'Picha na vidokezo kutoka kwa wasafiri', 'Photos et conseils partagés par des voyageurs', 'Foto e consigli condivisi dai viaggiatori', 'Fotos und Tipps von Reisenden', 'Zdjęcia i wskazówki od podróżników', '旅行者分享的照片和小贴士'),
      },
      {
        slug: 'afcon-2027', icon: 'trophy',
        label: L('AFCON 2027', 'AFCON 2027', 'CAN 2027', 'Coppa d’Africa 2027', 'Afrika-Cup 2027', 'Puchar Narodów Afryki 2027', '2027 非洲国家杯'),
        blurb: L('Match-day transfers and city tours', 'Usafiri wa mechi na ziara za mji', 'Transferts les jours de match et visites de ville', 'Transfer nei giorni di gara e tour in città', 'Transfers an Spieltagen und Stadttouren', 'Transfery w dni meczów i zwiedzanie miast', '比赛日接送与城市游览'),
      },
      {
        slug: 'invest', icon: 'trending-up',
        label: L('Invest in Tanzania', 'Wekeza Tanzania', 'Investir en Tanzanie', 'Investire in Tanzania', 'In Tansania investieren', 'Inwestuj w Tanzanii', '投资坦桑尼亚'),
        blurb: L('Tourism projects, introduced with TISEZA guidance', 'Miradi ya utalii, kwa mwongozo wa TISEZA', 'Projets touristiques, présentés avec l’appui de la TISEZA', 'Progetti turistici, presentati con il supporto di TISEZA', 'Tourismusprojekte, vorgestellt mit Unterstützung der TISEZA', 'Projekty turystyczne we współpracy z TISEZA', '旅游项目，在 TISEZA 指导下对接'),
      },
    ],
  },
];

// Placed last in MENU so the traveller sections come first.
const PARTNERS: MenuSection = {
  slug: 'partners',
  icon: 'handshake',
  label: L('For business', 'Kwa biashara', 'Professionnels', 'Per aziende', 'Für Unternehmen', 'Dla firm', '企业合作'),
  tagline: L(
    'Travel agents and tour companies: work with our verified guides',
    'Mawakala wa safari na kampuni za utalii: fanyeni kazi na waongozaji wetu waliothibitishwa',
    'Agences de voyages et tour-opérateurs : travaillez avec nos guides vérifiés',
    'Agenzie di viaggio e tour operator: lavorate con le nostre guide verificate',
    'Reisebüros und Veranstalter: arbeiten Sie mit unseren geprüften Guides',
    'Biura podróży i touroperatorzy: współpracujcie z naszymi sprawdzonymi przewodnikami',
    '旅行社与地接公司：与我们的认证导游合作',
  ),
  items: [
    {
      slug: 'travel-agents', icon: 'plane', href: '/partners/agents', status: 'live',
      label: L('For travel agents', 'Kwa mawakala wa safari', 'Pour les agences de voyages', 'Per le agenzie di viaggio', 'Für Reisebüros', 'Dla biur podróży', '旅行社合作'),
      blurb: L('Book verified guides for your clients, in their language', 'Pata waongozaji waliothibitishwa kwa wateja wako, kwa lugha yao', 'Réservez des guides vérifiés pour vos clients, dans leur langue', 'Prenota guide verificate per i tuoi clienti, nella loro lingua', 'Buchen Sie geprüfte Guides für Ihre Kunden, in deren Sprache', 'Rezerwuj sprawdzonych przewodników dla klientów, w ich języku', '为你的客户预订说其母语的认证导游'),
    },
    {
      slug: 'handover', icon: 'arrow-right-left', href: '/jobs/post?kind=handover', status: 'live',
      label: L('Hand over extra clients', 'Kabidhi wateja wa ziada', 'Confier des clients en surplus', 'Affida i clienti in eccesso', 'Überzählige Kunden weitergeben', 'Przekaż nadmiarowych klientów', '转交超额客户'),
      blurb: L('Fully booked? Verified guides take the trip for you', 'Mmejaa? Waongozaji waliothibitishwa wanachukua safari', 'Complet ? Des guides vérifiés prennent le voyage en charge', 'Al completo? Le guide verificate prendono il viaggio', 'Ausgebucht? Geprüfte Guides übernehmen die Reise', 'Brak miejsc? Sprawdzeni przewodnicy przejmą wyprawę', '满员了？认证导游帮你接团'),
    },
    {
      slug: 'partner-guides', icon: 'badge-check', href: '/guides?partners=1', status: 'live',
      label: L('Guides who work with agencies', 'Waongozaji wanaofanya kazi na mawakala', 'Guides qui travaillent avec les agences', 'Guide che lavorano con le agenzie', 'Guides für Agenturen', 'Przewodnicy współpracujący z biurami', '与旅行社合作的导游'),
      blurb: L('Freelance guides ready to lead under your brand', 'Waongozaji huru tayari kuongoza kwa jina lako', 'Des guides indépendants prêts à guider sous votre marque', 'Guide freelance pronte a lavorare con il tuo marchio', 'Freie Guides, die unter Ihrer Marke führen', 'Niezależni przewodnicy gotowi pracować pod Twoją marką', '可以以你的品牌带团的自由导游'),
    },
    {
      slug: 'hire-crew', icon: 'briefcase', href: '/jobs/post', status: 'live',
      label: L('Hire guides & crew', 'Ajiri waongozaji na wafanyakazi', 'Recruter guides & équipe', 'Assumi guide e staff', 'Guides & Crew einstellen', 'Zatrudnij przewodników i ekipę', '招聘导游与团队'),
      blurb: L('For companies: post a job for guides, cooks, porters', 'Kwa makampuni: tangaza kazi kwa waongozaji, wapishi, wapagazi', 'Entreprises : publiez une offre pour guides, cuisiniers, porteurs', 'Per aziende: pubblica un annuncio per guide, cuochi, portatori', 'Für Firmen: Jobs für Guides, Köche und Träger ausschreiben', 'Dla firm: ogłoszenia dla przewodników, kucharzy, tragarzy', '企业专用：发布导游、厨师、背夫招聘'),
    },
    {
      slug: 'start-group', icon: 'users-round', href: '/group-trips/new', status: 'live',
      label: L('Start a group trip', 'Anzisha safari ya kundi', 'Créer un voyage de groupe', 'Crea un viaggio di gruppo', 'Gruppenreise starten', 'Zorganizuj wyprawę grupową', '发起拼团'),
      blurb: L('Fill empty seats on your departures', 'Jaza nafasi wazi kwenye safari zako', 'Remplissez les places libres de vos départs', 'Riempi i posti liberi delle tue partenze', 'Freie Plätze Ihrer Termine füllen', 'Zapełnij wolne miejsca w swoich terminach', '填满你团期的空位'),
    },
    {
      slug: 'list-business', icon: 'store', href: '/join?role=provider', status: 'live',
      label: L('List your business', 'Weka biashara yako', 'Inscrire votre entreprise', 'Inserisci la tua attività', 'Unternehmen eintragen', 'Dodaj swoją firmę', '入驻 Rafrika'),
      blurb: L('Hotels, drivers, shops and tour companies', 'Hoteli, madereva, maduka na kampuni za utalii', 'Hôtels, chauffeurs, boutiques et agences', 'Hotel, autisti, negozi e tour operator', 'Hotels, Fahrer, Shops und Veranstalter', 'Hotele, kierowcy, sklepy i biura', '酒店、司机、商店和旅行社'),
    },
  ],
};

export const MENU: MenuSection[] = [...SECTIONS, PARTNERS];

// The Guide Hub menu is only shown to verified guides (and admins).
// Guides work in Kiswahili or English, so other languages reuse the English wording.
const hub = (en: string, sw: string) => L(en, sw, en, en, en, en, en);

export const HUB_MENU: MenuItem[] = [
  { slug: 'hub', icon: 'layout-dashboard', href: '/hub', status: 'live', label: hub('Hub home', 'Mwanzo'), blurb: hub('Your requests, calls and news', 'Maombi, simu na habari zako') },
  { slug: 'messages', icon: 'mail', href: '/messages', status: 'live', label: hub('Messages', 'Ujumbe'), blurb: hub('Chats with travellers', 'Mazungumzo na wasafiri') },
  { slug: 'forum', icon: 'messages-square', href: '/hub/forum', status: 'live', label: hub('Guide forum', 'Jukwaa'), blurb: hub('Park updates, sightings, advice', 'Habari za hifadhi, wanyama, ushauri') },
  { slug: 'news', icon: 'newspaper', href: '/hub/news', status: 'live', label: hub('Field news', 'Habari za uwanjani'), blurb: hub('Official updates from parks and authorities', 'Taarifa rasmi kutoka hifadhi na mamlaka') },
  { slug: 'chats', icon: 'users-round', href: '/chats', status: 'live', label: hub('Group chats', 'Mazungumzo ya kikundi'), blurb: hub('Chats with your groups, photos and videos', 'Mazungumzo na vikundi vyako, picha na video') },
  { slug: 'requests', icon: 'gavel', href: '/requests', status: 'live', label: hub('Trip requests', 'Maombi ya safari'), blurb: hub('Travellers asking for offers', 'Wasafiri wanaoomba ofa') },
  { slug: 'groups', icon: 'users-round', href: '/group-trips/mine', status: 'live', label: hub('Group trips', 'Safari za makundi'), blurb: hub('Trips you organise and their requests', 'Safari unazoandaa na maombi yake') },
  { slug: 'jobs', icon: 'briefcase', href: '/hub/jobs', status: 'live', label: hub('Jobs', 'Kazi'), blurb: hub('Companies hiring guides and crew', 'Makampuni yanayoajiri') },
  { slug: 'profile', icon: 'user-round', href: '/dashboard', status: 'live', label: hub('My profile', 'Wasifu wangu'), blurb: hub('Edit your public profile and calls', 'Hariri wasifu na simu zako') },
];

export function findMenuItem(sectionSlug: string, itemSlug: string) {
  const section = MENU.find((s) => s.slug === sectionSlug);
  const item = section?.items.find((i) => i.slug === itemSlug);
  return section && item ? { section, item } : null;
}
