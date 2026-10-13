// Special expertise a guide can offer on top of what they do. Shown as "Special trips"
// in the menu. Keep in sync with the guides_expertise_known check in Supabase.
// Labels are in the order en, sw, fr, it, de, pl, zh (see locales.ts).

import { L } from './locales';

export const GUIDE_EXPERTISE = [
  {
    id: 'blind', icon: 'eye-off',
    label: L('Blind & low-vision travellers', 'Wasafiri wasioona', 'Voyageurs aveugles & malvoyants', 'Viaggiatori ciechi e ipovedenti', 'Blinde & sehbehinderte Reisende', 'Podróżni niewidomi i słabowidzący', '视障旅行者'),
    blurb: L('Trips told through sound, touch and smell', 'Safari kwa sauti, kugusa na kunusa', 'Des voyages par le son, le toucher et l’odorat', 'Viaggi raccontati con suoni, tatto e profumi', 'Reisen über Klang, Tasten und Riechen', 'Podróże poznawane dźwiękiem, dotykiem i zapachem', '用声音、触觉和气味感受旅程'),
  },
  {
    id: 'mobility', icon: 'accessibility',
    label: L('Wheelchair & limited mobility', 'Viti vya magurudumu na ulemavu wa viungo', 'Fauteuil roulant & mobilité réduite', 'Sedia a rotelle e mobilità ridotta', 'Rollstuhl & eingeschränkte Mobilität', 'Wózek i ograniczona mobilność', '轮椅与行动不便'),
    blurb: L('Step-free vehicles, lodges and routes', 'Magari, malazi na njia zisizo na ngazi', 'Véhicules, lodges et itinéraires sans marches', 'Veicoli, lodge e percorsi senza gradini', 'Stufenlose Fahrzeuge, Lodges und Routen', 'Pojazdy, lodże i trasy bez schodów', '无障碍车辆、住宿与路线'),
  },
  {
    id: 'deaf', icon: 'ear',
    label: L('Deaf travellers', 'Wasafiri viziwi', 'Voyageurs sourds', 'Viaggiatori sordi', 'Gehörlose Reisende', 'Podróżni niesłyszący', '听障旅行者'),
    blurb: L('Guides who sign or work visually', 'Waongozaji wanaotumia lugha ya alama', 'Guides qui signent ou travaillent visuellement', 'Guide che usano la lingua dei segni', 'Guides mit Gebärdensprache oder visueller Führung', 'Przewodnicy migający lub pracujący wizualnie', '会手语或擅长视觉沟通的导游'),
  },
  {
    id: 'vip', icon: 'crown',
    label: L('VIP & luxury', 'VIP na anasa', 'VIP & luxe', 'VIP e lusso', 'VIP & Luxus', 'VIP i luksus', 'VIP 与奢华'),
    blurb: L('Private vehicles, top lodges, discreet service', 'Magari binafsi, loji bora, huduma ya siri', 'Véhicules privés, meilleurs lodges, service discret', 'Veicoli privati, lodge esclusivi, servizio discreto', 'Privatfahrzeuge, Top-Lodges, diskreter Service', 'Prywatne auta, najlepsze lodże, dyskretna obsługa', '私人车辆、顶级营地、低调服务'),
  },
  {
    id: 'record_climbs', icon: 'timer',
    label: L('Kili speed & record climbs', 'Kupanda Kili kwa kasi na rekodi', 'Ascensions rapides & records au Kili', 'Salite veloci e record sul Kili', 'Kili-Speed- & Rekordbesteigungen', 'Szybkie i rekordowe wejścia na Kili', '乞力马扎罗速攀与纪录挑战'),
    blurb: L('Record attempts, with the right park permits', 'Majaribio ya rekodi, kwa vibali sahihi vya hifadhi', 'Tentatives de record, avec les bons permis', 'Tentativi di record, con i permessi giusti', 'Rekordversuche mit den richtigen Genehmigungen', 'Próby rekordów z właściwymi pozwoleniami', '持合规许可的速度纪录挑战'),
  },
  {
    id: 'charity_climbs', icon: 'hand-heart',
    label: L('Charity & fundraising climbs', 'Kupanda kwa ajili ya hisani', 'Ascensions caritatives', 'Scalate di beneficenza', 'Charity- & Spendenbesteigungen', 'Wejścia charytatywne', '慈善筹款登山'),
    blurb: L('Group climbs for a cause', 'Makundi yanayopanda kwa lengo maalum', 'Des ascensions de groupe pour une cause', 'Scalate di gruppo per una causa', 'Gruppenbesteigungen für einen guten Zweck', 'Grupowe wejścia w szczytnym celu', '为公益而登山的团体'),
  },
  {
    id: 'solo_women', icon: 'venus',
    label: L('Women travelling solo', 'Wanawake wanaosafiri peke yao', 'Voyageuses en solo', 'Donne che viaggiano da sole', 'Frauen, die allein reisen', 'Kobiety podróżujące solo', '独自旅行的女性'),
    blurb: L('Safe, relaxed trips, often with female guides', 'Safari salama, mara nyingi na waongozaji wanawake', 'Voyages sereins, souvent avec des guides femmes', 'Viaggi sicuri, spesso con guide donne', 'Sichere Reisen, oft mit weiblichen Guides', 'Bezpieczne wyprawy, często z przewodniczkami', '安全安心，常由女性导游陪同'),
  },
  {
    id: 'families', icon: 'baby',
    label: L('Families with children', 'Familia zenye watoto', 'Familles avec enfants', 'Famiglie con bambini', 'Familien mit Kindern', 'Rodziny z dziećmi', '亲子家庭'),
    blurb: L('Shorter drives, kid-friendly lodges and games', 'Safari fupi, malazi rafiki kwa watoto', 'Trajets courts, lodges adaptés aux enfants', 'Tragitti brevi, lodge adatti ai bambini', 'Kürzere Fahrten, kinderfreundliche Lodges', 'Krótsze przejazdy, lodże przyjazne dzieciom', '车程短、适合儿童的住宿和活动'),
  },
  {
    id: 'seniors', icon: 'armchair',
    label: L('Seniors & slow travel', 'Wazee na safari za taratibu', 'Seniors & voyage lent', 'Senior e viaggi lenti', 'Senioren & entspanntes Reisen', 'Seniorzy i spokojne podróże', '长者与慢旅行'),
    blurb: L('Gentle pace, comfort and care for health', 'Mwendo wa taratibu na faraja', 'Rythme doux, confort et attention à la santé', 'Ritmo tranquillo, comfort e attenzione alla salute', 'Ruhiges Tempo, Komfort und Gesundheitsbewusstsein', 'Spokojne tempo, komfort i dbałość o zdrowie', '节奏舒缓、舒适并关注健康'),
  },
  {
    id: 'honeymoon', icon: 'heart',
    label: L('Honeymoon & couples', 'Fungate na wapenzi', 'Lune de miel & couples', 'Luna di miele e coppie', 'Flitterwochen & Paare', 'Podróż poślubna i pary', '蜜月与情侣'),
    blurb: L('Bush dinners, balloon flights and Zanzibar sunsets', 'Chakula porini, puto na machweo Zanzibar', 'Dîners en brousse, montgolfière et couchers de soleil à Zanzibar', 'Cene nella savana, mongolfiera e tramonti a Zanzibar', 'Busch-Dinner, Ballonfahrten und Sonnenuntergänge auf Sansibar', 'Kolacje w buszu, balony i zachody słońca na Zanzibarze', '丛林晚餐、热气球和桑给巴尔日落'),
  },
  {
    id: 'muslim_friendly', icon: 'moon-star',
    label: L('Muslim-friendly travel', 'Safari rafiki kwa Waislamu', 'Voyage adapté aux musulmans', 'Viaggi per viaggiatori musulmani', 'Muslimfreundliches Reisen', 'Podróże przyjazne muzułmanom', '穆斯林友好旅行'),
    blurb: L('Halal food and time for prayer', 'Chakula halali na muda wa sala', 'Repas halal et temps pour la prière', 'Cibo halal e tempo per la preghiera', 'Halal-Essen und Zeit für das Gebet', 'Jedzenie halal i czas na modlitwę', '清真餐食与礼拜时间'),
  },
  {
    id: 'students', icon: 'graduation-cap',
    label: L('School & student groups', 'Makundi ya shule na wanafunzi', 'Groupes scolaires & étudiants', 'Gruppi scolastici e studenti', 'Schul- & Studentengruppen', 'Grupy szkolne i studenckie', '学校与学生团体'),
    blurb: L('Educational trips, volunteering and research', 'Safari za kujifunza, kujitolea na utafiti', 'Voyages éducatifs, bénévolat et recherche', 'Viaggi educativi, volontariato e ricerca', 'Bildungsreisen, Freiwilligenarbeit und Forschung', 'Wyjazdy edukacyjne, wolontariat i badania', '研学、志愿服务与科研考察'),
  },
] as const;

export type GuideExpertise = (typeof GUIDE_EXPERTISE)[number]['id'];
