// Payer texts for the payment-method chooser (website sheet, app modal). All 7 languages; English is
// the source, the others are drafts for native-speaker review. Brand and network names are not translated.
import type { Locale } from '../locales';

export type PayChooserText = {
  payNow: string;
  title: string;
  subtitle: string;
  close: string;
  live: string;
  comingSoon: string;
  comingSoonHint: string;
  lastUsed: string;
  choose: string;
  loading: string;
  error: string;
  retry: string;
  offline: string;
  none: string;
  methods: { mobile_money: string; bank: string; card: string };
  bank: string;
  amountLabel: string;
  usdApprox: string;
  localEstimate: string;
  methodsLabel: string;
};

const en: PayChooserText = {
  payNow: 'Pay now',
  title: 'Choose how to pay',
  subtitle: 'Choose a way to pay that is open today. Others are coming soon.',
  close: 'Close',
  live: 'Available now',
  comingSoon: 'Coming soon',
  comingSoonHint: 'Not open yet. You cannot pay with this today.',
  lastUsed: 'Last used',
  choose: 'Pay with {name}',
  loading: 'Loading ways to pay',
  error: 'Sorry, we could not load the ways to pay. Please try again.',
  retry: 'Try again',
  offline: 'You are offline. Paying needs an internet connection.',
  none: 'Sorry, there is no way to pay this here right now.',
  methods: { mobile_money: 'Mobile money', bank: 'Bank', card: 'Card' },
  bank: 'Bank',
  amountLabel: 'Amount',
  usdApprox: 'About US$ {usd}',
  localEstimate: 'Estimate only: about {amount}. You pay in TZS.',
  methodsLabel: 'Ways to pay',
};

const sw: PayChooserText = {
  payNow: 'Lipa sasa',
  title: 'Chagua jinsi ya kulipa',
  subtitle: 'Chagua njia ya kulipa iliyo wazi leo. Nyingine zinakuja hivi karibuni.',
  close: 'Funga',
  live: 'Inapatikana sasa',
  comingSoon: 'Inakuja hivi karibuni',
  comingSoonHint: 'Bado haijafunguliwa. Huwezi kulipa kwa njia hii leo.',
  lastUsed: 'Uliyotumia mwisho',
  choose: 'Lipa kwa {name}',
  loading: 'Tunapakia njia za kulipa',
  error: 'Samahani, hatukuweza kupakia njia za kulipa. Tafadhali jaribu tena.',
  retry: 'Jaribu tena',
  offline: 'Huna mtandao. Kulipa kunahitaji intaneti.',
  none: 'Samahani, hakuna njia ya kulipa hili hapa kwa sasa.',
  methods: { mobile_money: 'Pesa kwa simu', bank: 'Benki', card: 'Kadi' },
  bank: 'Benki',
  amountLabel: 'Kiasi',
  usdApprox: 'Takriban US$ {usd}',
  localEstimate: 'Makadirio tu: takriban {amount}. Unalipa kwa TZS.',
  methodsLabel: 'Njia za kulipa',
};

const fr: PayChooserText = {
  payNow: 'Payer maintenant',
  title: 'Choisissez comment payer',
  subtitle: 'Choisissez un moyen de paiement ouvert aujourd\'hui. D\'autres arrivent bientôt.',
  close: 'Fermer',
  live: 'Disponible',
  comingSoon: 'Bientôt disponible',
  comingSoonHint: 'Pas encore ouvert. Vous ne pouvez pas payer ainsi aujourd\'hui.',
  lastUsed: 'Utilisé la dernière fois',
  choose: 'Payer avec {name}',
  loading: 'Chargement des moyens de paiement',
  error: 'Désolé, impossible de charger les moyens de paiement. Veuillez réessayer.',
  retry: 'Réessayer',
  offline: 'Vous êtes hors ligne. Le paiement nécessite une connexion internet.',
  none: 'Désolé, aucun moyen de payer ceci ici pour le moment.',
  methods: { mobile_money: 'Mobile money', bank: 'Banque', card: 'Carte' },
  bank: 'Banque',
  amountLabel: 'Montant',
  usdApprox: 'Environ {usd} $ US',
  localEstimate: 'Estimation seulement : environ {amount}. Vous payez en TZS.',
  methodsLabel: 'Moyens de paiement',
};

const it: PayChooserText = {
  payNow: 'Paga ora',
  title: 'Scegli come pagare',
  subtitle: 'Scegli un metodo di pagamento attivo oggi. Altri arriveranno presto.',
  close: 'Chiudi',
  live: 'Disponibile ora',
  comingSoon: 'In arrivo',
  comingSoonHint: 'Non ancora attivo. Oggi non puoi pagare così.',
  lastUsed: 'Usato l\'ultima volta',
  choose: 'Paga con {name}',
  loading: 'Caricamento dei metodi di pagamento',
  error: 'Spiacenti, non è stato possibile caricare i metodi di pagamento. Riprova.',
  retry: 'Riprova',
  offline: 'Sei offline. Per pagare serve una connessione internet.',
  none: 'Spiacenti, al momento non c\'è modo di pagarlo qui.',
  methods: { mobile_money: 'Mobile money', bank: 'Banca', card: 'Carta' },
  bank: 'Banca',
  amountLabel: 'Importo',
  usdApprox: 'Circa {usd} USD',
  localEstimate: 'Solo una stima: circa {amount}. Paghi in TZS.',
  methodsLabel: 'Metodi di pagamento',
};

const de: PayChooserText = {
  payNow: 'Jetzt bezahlen',
  title: 'Zahlungsart wählen',
  subtitle: 'Wählen Sie eine Zahlungsart, die heute offen ist. Weitere folgen bald.',
  close: 'Schließen',
  live: 'Jetzt verfügbar',
  comingSoon: 'Demnächst',
  comingSoonHint: 'Noch nicht geöffnet. Damit können Sie heute nicht bezahlen.',
  lastUsed: 'Zuletzt verwendet',
  choose: 'Mit {name} bezahlen',
  loading: 'Zahlungsarten werden geladen',
  error: 'Leider konnten die Zahlungsarten nicht geladen werden. Bitte versuchen Sie es erneut.',
  retry: 'Erneut versuchen',
  offline: 'Sie sind offline. Zum Bezahlen brauchen Sie eine Internetverbindung.',
  none: 'Leider kann dies hier gerade nicht bezahlt werden.',
  methods: { mobile_money: 'Mobile Money', bank: 'Bank', card: 'Karte' },
  bank: 'Bank',
  amountLabel: 'Betrag',
  usdApprox: 'Etwa {usd} US-$',
  localEstimate: 'Nur eine Schätzung: etwa {amount}. Sie zahlen in TZS.',
  methodsLabel: 'Zahlungsarten',
};

const pl: PayChooserText = {
  payNow: 'Zapłać teraz',
  title: 'Wybierz sposób płatności',
  subtitle: 'Wybierz sposób płatności otwarty dzisiaj. Kolejne wkrótce.',
  close: 'Zamknij',
  live: 'Dostępne teraz',
  comingSoon: 'Wkrótce',
  comingSoonHint: 'Jeszcze nieotwarte. Dziś nie można tak zapłacić.',
  lastUsed: 'Ostatnio używane',
  choose: 'Zapłać przez {name}',
  loading: 'Wczytywanie sposobów płatności',
  error: 'Niestety nie udało się wczytać sposobów płatności. Spróbuj ponownie.',
  retry: 'Spróbuj ponownie',
  offline: 'Jesteś offline. Płatność wymaga połączenia z internetem.',
  none: 'Niestety nie można teraz tu tego zapłacić.',
  methods: { mobile_money: 'Płatność mobilna', bank: 'Bank', card: 'Karta' },
  bank: 'Bank',
  amountLabel: 'Kwota',
  usdApprox: 'Około {usd} USD',
  localEstimate: 'Tylko szacunek: około {amount}. Płacisz w TZS.',
  methodsLabel: 'Sposoby płatności',
};

const zh: PayChooserText = {
  payNow: '立即付款',
  title: '选择付款方式',
  subtitle: '请选择今天开放的付款方式。其他方式即将推出。',
  close: '关闭',
  live: '现已可用',
  comingSoon: '即将推出',
  comingSoonHint: '尚未开放，今天无法用此方式付款。',
  lastUsed: '上次使用',
  choose: '用 {name} 付款',
  loading: '正在加载付款方式',
  error: '抱歉，无法加载付款方式。请再试一次。',
  retry: '重试',
  offline: '您处于离线状态。付款需要网络连接。',
  none: '抱歉，目前无法在这里支付此项。',
  methods: { mobile_money: '手机钱包', bank: '银行', card: '银行卡' },
  bank: '银行',
  amountLabel: '金额',
  usdApprox: '约 {usd} 美元',
  localEstimate: '仅为估算：约 {amount}。您以坦桑尼亚先令付款。',
  methodsLabel: '付款方式',
};

export const PAY_CHOOSER_TEXT: Record<Locale, PayChooserText> = { en, sw, fr, it, de, pl, zh };
export const payChooserText = (locale: Locale | string): PayChooserText => PAY_CHOOSER_TEXT[(locale in PAY_CHOOSER_TEXT ? locale : 'en') as Locale];
