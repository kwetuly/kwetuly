// Guide dashboard texts: the status line for a profile only shown to people with its link, the
// message when the chosen profile link is taken, and short field names for error messages.
// Guide texts, so English and Kiswahili.
import type { Locale } from '../locales';

const en = {
  approvedLinkOnly: 'Your profile is live and visible to people with your link.',
  slugTaken: 'This profile link is already taken. Please choose another one.',
  phoneShort: 'Phone',
  whatsappShort: 'WhatsApp',
};

export type GuideStatusText = typeof en;

const sw: GuideStatusText = {
  approvedLinkOnly: 'Wasifu wako uko hewani na unaonekana kwa watu wenye kiungo chako.',
  slugTaken: 'Kiungo hiki cha wasifu kimeshachukuliwa. Tafadhali chagua kingine.',
  phoneShort: 'Simu',
  whatsappShort: 'WhatsApp',
};

/** Kiswahili for 'sw', English for every other language. */
export const guideStatusText = (locale: Locale | string): GuideStatusText => (locale === 'sw' ? sw : en);
