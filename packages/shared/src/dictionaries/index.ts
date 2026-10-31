// Site and app text in every supported language. English is the source; every other
// dictionary has the same shape. All non-English text is a draft for native-speaker review.
import type { Locale } from '../locales';
import { de } from './de';
import { en, type Dictionary } from './en';
import { fr } from './fr';
import { it } from './it';
import { pl } from './pl';
import { sw } from './sw';
import { zh } from './zh';

export type { Dictionary };
export const DICTIONARIES: Record<Locale, Dictionary> = { en, sw, fr, it, de, pl, zh };
export { UX_TEXT } from './ux';
export { TRAVEL_LINKS } from './travel';
export { LEGAL_PUBLISHED } from './legal';
export { MENU_TEXT, type MenuText } from './menu-text';
export type { PhoneText } from './phone';
export { LINK_TEXT, linkTexts, linkErrorCode, linkErrorMessage, type LinkTexts, type LinkErrorCode } from './links';
export { LIMIT_TEXT, limitTexts, isRateLimited, RATE_LIMIT_SQLSTATE, RATE_LIMIT_MESSAGE, type LimitTexts } from './limits';
export { linkCheckText, type LinkCheckText } from './link-check';
export { guideStatusText, type GuideStatusText } from './guide-status';
export { SIGN_INS_TEXT } from './sign-ins';
export { CATALOGUE_TEXT, catalogueText, type CatalogueText } from './catalogue';
export { HOSTS_TEXT, hostsText, type HostsText } from './hosts';
