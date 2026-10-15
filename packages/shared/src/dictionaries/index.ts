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
