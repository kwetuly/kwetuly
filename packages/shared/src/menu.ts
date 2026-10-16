// Site and app navigation. Each section has a URL slug and items shown in its dropdown.
// `status: 'soon'` items show a "coming soon" page that collects interest and listings.
// Labels are in the order en, sw, fr, it, de, pl, zh (see locales.ts).

import { GUIDE_EXPERTISE } from './expertise';
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

function expertiseItem(e: (typeof GUIDE_EXPERTISE)[number]): MenuItem {
  return { slug: e.id.replace(/_/g, '-'), icon: e.icon, href: `/guides?expertise=${e.id}`, status: 'live', label: e.label, blurb: e.blurb };
}

const VISA_ITEM: MenuItem = {
  slug: 'visa-insurance', icon: 'badge-check', href: '/travel-info', status: 'live',
  label: L('Visa & insurance', 'Viza na bima', 'Visa & assurance', 'Visto e assicurazione', 'Visum & Versicherung', 'Wiza i ubezpieczenie', '签证与保险'),
  blurb: L('Official links and the new insurance rule', 'Viungo rasmi na sheria mpya ya bima', 'Liens officiels et nouvelle règle d’assurance', 'Link ufficiali e nuova regola sull’assicurazione', 'Offizielle Links und die neue Versicherungspflicht', 'Oficjalne linki i nowy obowiązek ubezpieczenia', '官方链接与新的保险规定'),
};

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
      {
        slug: 'special-trips', icon: 'heart-handshake', href: '/special', status: 'live',
        label: L('Special trips', 'Safari maalum', 'Voyages spéciaux', 'Viaggi speciali', 'Spezialreisen', 'Wyprawy specjalne', '特色主题游'),
        blurb: L('Guides for blind, deaf and wheelchair travellers, VIPs, families and more', 'Waongozaji kwa wasioona, viziwi, watumiaji wa viti vya magurudumu, VIP, familia na zaidi', 'Guides pour voyageurs aveugles, sourds, en fauteuil, VIP, familles et plus', 'Guide per viaggiatori ciechi, sordi, in carrozzina, VIP, famiglie e altro', 'Guides für blinde, gehörlose und Rollstuhl-Reisende, VIPs, Familien und mehr', 'Przewodnicy dla osób niewidomych, niesłyszących, na wózkach, VIP, rodzin i nie tylko', '为盲人、听障、轮椅旅客、贵宾、家庭等提供服务的导游'),
      },
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
    label: L('Experiences', 'Safari na Ziara', 'Expériences', 'Esperienze', 'Erlebnisse', 'Doświadczenia', '体验'),
    tagline: L(
      'Guide packages, safaris and tours across Tanzania',
      'Vifurushi vya waongozaji, safari na ziara kote Tanzania',
      'Formules de guides, safaris et circuits dans toute la Tanzanie',
      'Pacchetti delle guide, safari e tour in tutta la Tanzania',
      'Angebote von Guides, Safaris und Touren in ganz Tansania',
      'Pakiety przewodników, safari i wycieczki po całej Tanzanii',
      '向导套餐、游猎与行程，遍及坦桑尼亚',
    ),
    items: [
      {
        slug: 'packages', icon: 'users', href: '/packages', status: 'live',
        label: L('Packages by local guides', 'Vifurushi vya waongozaji wa ndani', 'Formules de guides locaux', 'Pacchetti di guide locali', 'Angebote lokaler Guides', 'Pakiety lokalnych przewodników', '当地向导套餐'),
        blurb: L('Cultural visits, day trips and one-on-one trips', 'Ziara za kitamaduni, safari za siku moja na za mtu mmoja', 'Visites culturelles, excursions et voyages en tête-à-tête', 'Visite culturali, gite e viaggi individuali', 'Kulturbesuche, Tagesausflüge und Reisen zu zweit', 'Wizyty kulturalne, wycieczki i wyprawy jeden na jeden', '文化探访、一日游和一对一行程'),
      },
      {
        slug: 'all', icon: 'map', href: '/tours', status: 'live',
        label: L('All tours', 'Ziara zote', 'Tous les circuits', 'Tutti i tour', 'Alle Touren', 'Wszystkie wycieczki', '全部行程'),
        blurb: L('Northern, southern, western and coast', 'Kaskazini, kusini, magharibi na pwani', 'Nord, sud, ouest et côte', 'Nord, sud, ovest e costa', 'Norden, Süden, Westen und Küste', 'Północ, południe, zachód i wybrzeże', '北部、南部、西部与海岸'),
      },
      {
        slug: 'safari', icon: 'binoculars', href: '/tours?theme=safari', status: 'live',
        label: L('Safaris', 'Safari za wanyama', 'Safaris', 'Safari', 'Safaris', 'Safari', '野生动物游猎'),
        blurb: L('Serengeti, Ngorongoro, Ruaha, Nyerere', 'Serengeti, Ngorongoro, Ruaha, Nyerere', 'Serengeti, Ngorongoro, Ruaha, Nyerere', 'Serengeti, Ngorongoro, Ruaha, Nyerere', 'Serengeti, Ngorongoro, Ruaha, Nyerere', 'Serengeti, Ngorongoro, Ruaha, Nyerere', '塞伦盖蒂、恩戈罗恩戈罗、鲁阿哈、尼雷尔'),
      },
      {
        slug: 'climbs', icon: 'mountain', href: '/tours?theme=mountain', status: 'live',
        label: L('Kilimanjaro & climbs', 'Kilimanjaro na milima', 'Kilimandjaro & ascensions', 'Kilimangiaro e scalate', 'Kilimandscharo & Besteigungen', 'Kilimandżaro i wejścia', '乞力马扎罗与登山'),
        blurb: L('Machame, Lemosho, Marangu, Meru, Lengai', 'Machame, Lemosho, Marangu, Meru, Lengai', 'Machame, Lemosho, Marangu, Meru, Lengai', 'Machame, Lemosho, Marangu, Meru, Lengai', 'Machame, Lemosho, Marangu, Meru, Lengai', 'Machame, Lemosho, Marangu, Meru, Lengai', 'Machame、Lemosho、Marangu、梅鲁山、伦盖火山'),
      },
      {
        slug: 'zanzibar', icon: 'globe', href: '/tours?theme=coast', status: 'live',
        label: L('Zanzibar & beaches', 'Zanzibar na fukwe', 'Zanzibar & plages', 'Zanzibar e spiagge', 'Sansibar & Strände', 'Zanzibar i plaże', '桑给巴尔与海滩'),
        blurb: L('Stone Town, spice farms, Mnemba, Pemba, Mafia', 'Mji Mkongwe, mashamba ya viungo, Mnemba, Pemba, Mafia', 'Stone Town, épices, Mnemba, Pemba, Mafia', 'Stone Town, spezie, Mnemba, Pemba, Mafia', 'Stone Town, Gewürzfarmen, Mnemba, Pemba, Mafia', 'Stone Town, przyprawy, Mnemba, Pemba, Mafia', '石头城、香料园、姆内巴、奔巴、马菲亚'),
      },
      {
        slug: 'culture', icon: 'users', href: '/tours?theme=cultural', status: 'live',
        label: L('Culture & heritage', 'Utamaduni na urithi', 'Culture & patrimoine', 'Cultura e patrimonio', 'Kultur & Erbe', 'Kultura i dziedzictwo', '文化与遗产'),
        blurb: L('Maasai, Hadzabe, Chagga, Swahili coast', 'Wamasai, Wahadzabe, Wachagga, pwani ya Kiswahili', 'Maasaï, Hadzabe, Chagga, côte swahilie', 'Maasai, Hadzabe, Chagga, costa swahili', 'Massai, Hadzabe, Chagga, Swahili-Küste', 'Masajowie, Hadzabe, Chagga, wybrzeże suahili', '马赛、哈扎、查加与斯瓦希里海岸'),
      },
      {
        slug: 'day-trips', icon: 'sun', href: '/tours?duration=day', status: 'live',
        label: L('Day trips', 'Safari za siku moja', 'Excursions d’une journée', 'Escursioni giornaliere', 'Tagesausflüge', 'Wycieczki jednodniowe', '一日游'),
        blurb: L('Waterfalls, coffee farms, hot springs', 'Maporomoko, mashamba ya kahawa, chemchemi', 'Cascades, plantations de café, sources chaudes', 'Cascate, piantagioni di caffè, sorgenti calde', 'Wasserfälle, Kaffeefarmen, heiße Quellen', 'Wodospady, plantacje kawy, gorące źródła', '瀑布、咖啡农场、温泉'),
      },
      {
        slug: 'combos', icon: 'route', href: '/tours?theme=combo', status: 'live',
        label: L('Combo trips', 'Safari mchanganyiko', 'Voyages combinés', 'Viaggi combinati', 'Kombi-Reisen', 'Wycieczki łączone', '组合行程'),
        blurb: L('Kili + safari + Zanzibar and more', 'Kili + safari + Zanzibar na zaidi', 'Kili + safari + Zanzibar et plus', 'Kili + safari + Zanzibar e altro', 'Kili + Safari + Sansibar und mehr', 'Kili + safari + Zanzibar i więcej', '乞力马扎罗 + 游猎 + 桑给巴尔等'),
      },
      {
        slug: 'signature', icon: 'sparkles', href: '/tours?type=signature', status: 'live',
        label: L('Rafrika signature trips', 'Safari maalum za Rafrika', 'Voyages signature Rafrika', 'Viaggi firmati Rafrika', 'Rafrika Signature-Reisen', 'Autorskie wyprawy Rafrika', 'Rafrika 特色行程'),
        blurb: L('Unique trips designed by our guides', 'Safari za kipekee zilizobuniwa na waongozaji wetu', 'Des voyages uniques conçus par nos guides', 'Viaggi unici ideati dalle nostre guide', 'Einzigartige Reisen, von unseren Guides entworfen', 'Wyjątkowe wyprawy zaprojektowane przez naszych przewodników', '由我们的导游设计的独特行程'),
      },
      {
        slug: 'vip', icon: 'crown', href: '/tours?style=vip', status: 'live',
        label: L('VIP & luxury trips', 'Safari za VIP na anasa', 'Voyages VIP & luxe', 'Viaggi VIP e di lusso', 'VIP- & Luxusreisen', 'Podróże VIP i luksusowe', 'VIP 与奢华行程'),
        blurb: L('Private, premium lodges and camps', 'Binafsi, loji na kambi za hadhi ya juu', 'Privés, lodges et camps haut de gamme', 'Privati, lodge e campi di alto livello', 'Privat, Premium-Lodges und -Camps', 'Prywatnie, ekskluzywne lodge i obozy', '私人定制、高端旅馆与营地'),
      },
      {
        slug: 'places', icon: 'map', href: '/places', status: 'live',
        label: L('Parks & places', 'Hifadhi na maeneo', 'Parcs & lieux', 'Parchi e luoghi', 'Parks & Orte', 'Parki i miejsca', '公园与景点'),
        blurb: L('Guides to the parks and sites we visit', 'Maelezo ya hifadhi na maeneo tunayotembelea', 'Les parcs et sites que nous visitons', 'I parchi e i luoghi che visitiamo', 'Die Parks und Orte unserer Touren', 'Parki i miejsca, które odwiedzamy', '我们行程中的公园与景点'),
      },
      {
        slug: 'operators', icon: 'building-2', href: '/operators', status: 'live',
        label: L('Tour operators', 'Kampuni za utalii', 'Opérateurs touristiques', 'Tour operator', 'Reiseveranstalter', 'Biura podróży', '旅行社'),
        blurb: L('Licensed Tanzanian companies we list', 'Kampuni za Kitanzania zenye leseni', 'Entreprises tanzaniennes agréées', 'Aziende tanzaniane autorizzate', 'Lizenzierte tansanische Unternehmen', 'Licencjonowane firmy z Tanzanii', '持牌坦桑尼亚公司'),
      },
    ],
  },
  {
    slug: 'stay',
    icon: 'bed-double',
    label: L('Stays', 'Malazi', 'Hébergement', 'Alloggi', 'Unterkünfte', 'Noclegi', '住宿'),
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
    label: L('Shop', 'Duka', 'Boutique', 'Negozio', 'Shop', 'Sklep', '商店'),
    tagline: L(
      'Crafts, gems and gear: delivered to your hotel or ready to collect',
      'Sanaa, vito na vifaa: vinaletwa hotelini au unachukua dukani',
      'Artisanat, pierres et matériel : livrés à votre hôtel ou à retirer',
      'Artigianato, gemme e attrezzatura: consegnati in hotel o da ritirare',
      'Kunsthandwerk, Edelsteine und Ausrüstung: ins Hotel geliefert oder zum Abholen',
      'Rękodzieło, kamienie i sprzęt: z dostawą do hotelu lub do odbioru',
      '手工艺品、宝石和装备：送到酒店或到店自取',
    ),
    items: [
      {
        slug: 'art', icon: 'palette',
        label: L('Curio shops', 'Maduka ya sanaa na zawadi', 'Boutiques de souvenirs', 'Negozi di souvenir', 'Souvenirläden', 'Sklepy z pamiątkami', '工艺品店'),
        blurb: L('Tingatinga, Makonde carvings, beadwork', 'Tingatinga, vinyago vya Makonde, shanga', 'Tingatinga, sculptures Makonde, perles', 'Tingatinga, sculture Makonde, perline', 'Tingatinga, Makonde-Schnitzereien, Perlenarbeiten', 'Tingatinga, rzeźby Makonde, koraliki', '廷加廷加画、马孔德木雕、串珠'),
      },
      {
        slug: 'tanzanite', icon: 'gem',
        label: L('Tanzanite & gems', 'Tanzanite na vito', 'Tanzanite & pierres', 'Tanzanite e gemme', 'Tansanit & Edelsteine', 'Tanzanit i kamienie', '坦桑石与宝石'),
        blurb: L('Licensed dealers only, with certificates', 'Wauzaji wenye leseni tu, pamoja na vyeti', 'Uniquement des vendeurs agréés, avec certificat', 'Solo rivenditori autorizzati, con certificato', 'Nur lizenzierte Händler, mit Zertifikat', 'Tylko licencjonowani sprzedawcy, z certyfikatem', '仅限持证商家，附证书'),
      },
      {
        slug: 'buy-gear', icon: 'tent',
        label: L('Buy before you fly', 'Nunua kabla ya kusafiri', 'Achetez avant de partir', 'Acquista prima di partire', 'Vor der Reise kaufen', 'Kup przed wylotem', '出发前选购'),
        blurb: L('Guide-approved packing lists', 'Orodha za vifaa zilizoidhinishwa na waongozaji', 'Listes d’équipement validées par les guides', 'Liste di cosa portare approvate dalle guide', 'Packlisten, von Guides empfohlen', 'Listy rzeczy zatwierdzone przez przewodników', '导游推荐的行李清单'),
      },
      {
        slug: 'rent-gear', icon: 'repeat',
        label: L('Gear rental', 'Kukodi vifaa', 'Location de matériel', 'Noleggio attrezzatura', 'Ausrüstungsverleih', 'Wypożyczalnia sprzętu', '装备租赁'),
        blurb: L('Sleeping bags, jackets, poles, boots', 'Mifuko ya kulalia, jaketi, fimbo, viatu', 'Sacs de couchage, vestes, bâtons, chaussures', 'Sacchi a pelo, giacche, bastoncini, scarponi', 'Schlafsäcke, Jacken, Stöcke, Stiefel', 'Śpiwory, kurtki, kije, buty', '睡袋、外套、登山杖、登山鞋'),
      },
    ],
  },
  {
    slug: 'local',
    icon: 'sparkles',
    label: L('Going out', 'Viwanja vya starehe', 'Sorties', 'Uscire', 'Ausgehen', 'Wyjścia', '休闲去处'),
    tagline: L(
      'Bars, clubs, food spots and places to unwind',
      'Baa, klabu, vyakula na sehemu za kupumzika',
      'Bars, clubs, bonnes tables et lieux pour se détendre',
      'Bar, club, posti dove mangiare e rilassarsi',
      'Bars, Clubs, Essen und Orte zum Entspannen',
      'Bary, kluby, jedzenie i miejsca na relaks',
      '酒吧、夜店、美食和放松好去处',
    ),
    items: [
      {
        slug: 'hot-spots', icon: 'music',
        label: L('Bars, clubs & hotspots', 'Baa, klabu na sehemu maarufu', 'Bars, clubs & lieux branchés', 'Bar, club e locali di tendenza', 'Bars, Clubs & Hotspots', 'Bary, kluby i modne miejsca', '酒吧、夜店与热门去处'),
        blurb: L('Live music, clubs, rooftops', 'Muziki, klabu, sehemu za juu', 'Concerts, clubs, rooftops', 'Musica dal vivo, club, rooftop', 'Livemusik, Clubs, Rooftops', 'Muzyka na żywo, kluby, tarasy', '现场音乐、俱乐部、屋顶酒吧'),
      },
      {
        slug: 'food', icon: 'utensils-crossed',
        label: L('Swahili food spots', 'Vyakula vya Kiswahili', 'Cuisine swahilie', 'Cucina swahili', 'Swahili-Küche', 'Kuchnia suahili', '斯瓦希里美食'),
        blurb: L('Nyama choma, pilau, street food', 'Nyama choma, pilau, vyakula vya mtaani', 'Nyama choma, pilau, cuisine de rue', 'Nyama choma, pilau, street food', 'Nyama Choma, Pilau, Streetfood', 'Nyama choma, pilau, jedzenie uliczne', '烤肉、香料饭、街头小吃'),
      },
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
    ],
  },
  {
    slug: 'discover',
    icon: 'book-open',
    label: L('Information', 'Taarifa', 'Informations', 'Informazioni', 'Informationen', 'Informacje', '旅行信息'),
    tagline: L(
      'Visa, insurance, parks, events and stories',
      'Viza, bima, hifadhi, matukio na hadithi',
      'Visa, assurance, parcs, événements et récits',
      'Visto, assicurazione, parchi, eventi e storie',
      'Visum, Versicherung, Parks, Events und Geschichten',
      'Wiza, ubezpieczenie, parki, wydarzenia i historie',
      '签证、保险、公园、活动与故事',
    ),
    items: [
      VISA_ITEM,
      {
        slug: 'parks', icon: 'map', href: '/places', status: 'live',
        label: L('Parks & places', 'Hifadhi na maeneo', 'Parcs & lieux', 'Parchi e luoghi', 'Parks & Orte', 'Parki i miejsca', '公园与景点'),
        blurb: L('Fees, seasons and what to see', 'Ada, misimu na vitu vya kuona', 'Tarifs, saisons et choses à voir', 'Tariffe, stagioni e cosa vedere', 'Gebühren, Jahreszeiten und Sehenswertes', 'Opłaty, sezony i co zobaczyć', '门票、季节与看点'),
      },
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

// Plan your trip: travel rules first, then one link per practical section.
const PLAN: MenuSection = {
  slug: 'plan',
  icon: 'map',
  label: L('Plan your trip', 'Panga safari yako', 'Préparer votre voyage', 'Organizza il viaggio', 'Reise planen', 'Zaplanuj podróż', '规划行程'),
  tagline: L(
    'Visa, insurance, transport, gear and local tips',
    'Viza, bima, usafiri, vifaa na vidokezo vya mtaani',
    'Visa, assurance, transport, équipement et conseils locaux',
    'Visto, assicurazione, trasporti, attrezzatura e consigli locali',
    'Visum, Versicherung, Transport, Ausrüstung und lokale Tipps',
    'Wiza, ubezpieczenie, transport, sprzęt i lokalne wskazówki',
    '签证、保险、交通、装备与当地建议',
  ),
  items: [
    VISA_ITEM,
    ...['transport', 'shop', 'local', 'discover'].map((slug): MenuItem => {
      const section = SECTIONS.find((s) => s.slug === slug)!;
      return { slug: `${slug}-all`, icon: section.icon, href: `/${slug}`, status: 'live', label: section.label, blurb: section.tagline };
    }),
  ],
};

/** Every section, for section pages, the sitemap and search. */
export const ALL_SECTIONS: MenuSection[] = [...SECTIONS, PLAN, PARTNERS];

const bySlug = (slug: string) => ALL_SECTIONS.find((s) => s.slug === slug)!;
// Prep calls are a main selling point, so they get their own link in the main menu.
// A section with one item shows as a plain link in the menu.
const PREP_CALLS: MenuSection = {
  slug: 'calls',
  icon: 'video',
  label: L('Prep calls', 'Simu za maandalizi', 'Appels de préparation', 'Chiamate di preparazione', 'Vorbereitungsgespräche', 'Rozmowy przygotowawcze', '行前咨询'),
  tagline: L(
    'Talk to a local guide before you book',
    'Ongea na mwongozaji wa ndani kabla ya kulipia',
    'Parlez à un guide local avant de réserver',
    'Parla con una guida locale prima di prenotare',
    'Sprechen Sie vor der Buchung mit einem lokalen Guide',
    'Porozmawiaj z lokalnym przewodnikiem przed rezerwacją',
    '预订前先和当地导游聊一聊',
  ),
  items: [bySlug('trips').items.find((i) => i.slug === 'calls')!],
};

/** Trips are what the "Experiences" section holds; the menu calls them trips. */
const TRIPS: MenuSection = {
  ...bySlug('safaris'),
  label: L('Trips', 'Safari', 'Voyages', 'Viaggi', 'Reisen', 'Wyprawy', '行程'),
};

/** The main menu: the selling points are visible at the top; the rest sits one step deeper. */
export const MENU: MenuSection[] = [
  bySlug('trips'),
  PREP_CALLS,
  TRIPS,
  bySlug('stay'),
  bySlug('transport'),
  bySlug('shop'),
  bySlug('local'),
  bySlug('discover'),
  PARTNERS,
];

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
  const section = ALL_SECTIONS.find((s) => s.slug === sectionSlug);
  const item = section?.items.find((i) => i.slug === itemSlug);
  return section && item ? { section, item } : null;
}
