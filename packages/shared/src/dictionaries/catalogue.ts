// Texts for the read-only "What they offer" list on business pages and for sample photo credits.
// Travellers see these, so all 7 languages. Non-English text is a draft for native-speaker review.
import type { Locale } from '../locales';

export type CatalogueText = {
  whatTheyOffer: string;
  sampleItemsNote: string;
  photoCredits: string;
  photoCreditsNote: string;
  source: string;
  loadError: string;
};

export const CATALOGUE_TEXT: Record<Locale, CatalogueText> = {
  en: {
    whatTheyOffer: 'What they offer',
    sampleItemsNote: 'Sample items for testing. Typical prices come from published sources, not from a shop.',
    photoCredits: 'Photo credits',
    photoCreditsNote: 'Stock photos used on this sample page.',
    source: 'Source',
    loadError: 'These items could not be loaded. Please try again later.',
  },
  sw: {
    whatTheyOffer: 'Wanachotoa',
    sampleItemsNote: 'Bidhaa za mfano za kujaribu. Bei za kawaida zinatoka kwenye vyanzo vilivyochapishwa, si kwa duka.',
    photoCredits: 'Wamiliki wa picha',
    photoCreditsNote: 'Picha za hifadhi zilizotumika kwenye ukurasa huu wa mfano.',
    source: 'Chanzo',
    loadError: 'Bidhaa hizi hazikuweza kupakiwa. Tafadhali jaribu tena baadaye.',
  },
  fr: {
    whatTheyOffer: 'Ce qu’ils proposent',
    sampleItemsNote: 'Articles d’exemple pour tester. Les prix habituels viennent de sources publiées, pas d’une boutique.',
    photoCredits: 'Crédits photo',
    photoCreditsNote: 'Photos d’illustration utilisées sur cette page d’exemple.',
    source: 'Source',
    loadError: 'Impossible de charger ces articles. Veuillez réessayer plus tard.',
  },
  it: {
    whatTheyOffer: 'Cosa offrono',
    sampleItemsNote: 'Articoli di esempio per i test. I prezzi tipici vengono da fonti pubblicate, non da un negozio.',
    photoCredits: 'Crediti fotografici',
    photoCreditsNote: 'Foto di repertorio usate in questa pagina di esempio.',
    source: 'Fonte',
    loadError: 'Impossibile caricare questi articoli. Riprova più tardi.',
  },
  de: {
    whatTheyOffer: 'Was sie anbieten',
    sampleItemsNote: 'Beispielartikel zum Testen. Übliche Preise stammen aus veröffentlichten Quellen, nicht von einem Geschäft.',
    photoCredits: 'Bildnachweise',
    photoCreditsNote: 'Stockfotos auf dieser Beispielseite.',
    source: 'Quelle',
    loadError: 'Diese Artikel konnten nicht geladen werden. Bitte versuchen Sie es später erneut.',
  },
  pl: {
    whatTheyOffer: 'Co oferują',
    sampleItemsNote: 'Przykładowe produkty do testów. Typowe ceny pochodzą z opublikowanych źródeł, nie od sklepu.',
    photoCredits: 'Autorzy zdjęć',
    photoCreditsNote: 'Zdjęcia stockowe użyte na tej przykładowej stronie.',
    source: 'Źródło',
    loadError: 'Nie udało się wczytać tych produktów. Spróbuj ponownie później.',
  },
  zh: {
    whatTheyOffer: '提供的商品与服务',
    sampleItemsNote: '用于测试的示例商品。常见价格来自公开资料，并非商店报价。',
    photoCredits: '图片来源',
    photoCreditsNote: '本示例页面使用的图库照片。',
    source: '来源',
    loadError: '无法加载这些商品，请稍后再试。',
  },
};

export const catalogueText = (locale: Locale | string): CatalogueText => CATALOGUE_TEXT[(locale in CATALOGUE_TEXT ? locale : 'en') as Locale];
