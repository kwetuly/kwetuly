// Guide and business-owner texts for paying Kwetuly's own fees by Lipa number (verification and the
// badge on the verification page). English and Kiswahili (Kiswahili is a draft; Walter checks every line).
import type { Locale } from '../locales';

const en = {
  payTitle: 'Verification',
  payBody: 'Once Kwetuly has checked your documents, you can switch verification on by paying monthly or yearly by Lipa number.',
  payMonth: 'Pay monthly: {amount}',
  payYear: 'Pay yearly: {amount}',
  payMonthShort: 'Pay monthly',
  payYearShort: 'Pay yearly',
  priceNotSet: 'Prices are not set yet. Kwetuly sets them.',
  checksFirst: 'Please send your documents first. You pay only after Kwetuly has checked them.',
  paidUntil: 'Verification paid until {date}.',
  closed: 'Paying by Lipa number is closed for now.',
  badgeTitle: '"Checked by Kwetuly" badge',
  badgeBody: 'One year. After you pay, Kwetuly checks your business and shows on your page what was checked and when.',
  badgePay: 'Pay for the badge: {amount}',
  badgePaidUntil: 'Badge paid until {date}.',
  badgeNoRefund: 'The fee pays for the check. It is not refunded if the business does not pass.',
  myPayments: 'My payments',
};

export type LipaMemberText = typeof en;

const sw: LipaMemberText = {
  payTitle: 'Uhakiki',
  payBody: 'Kwetuly ikishakagua nyaraka zako, unaweza kuwasha uhakiki kwa kulipa kila mwezi au kila mwaka kwa namba ya Lipa.',
  payMonth: 'Lipa kila mwezi: {amount}',
  payYear: 'Lipa kila mwaka: {amount}',
  payMonthShort: 'Lipa kila mwezi',
  payYearShort: 'Lipa kila mwaka',
  priceNotSet: 'Bei bado hazijawekwa. Kwetuly ndiyo inaziweka.',
  checksFirst: 'Tafadhali tuma nyaraka zako kwanza. Unalipa tu baada ya Kwetuly kuzikagua.',
  paidUntil: 'Uhakiki umelipwa hadi {date}.',
  closed: 'Kulipa kwa namba ya Lipa kumefungwa kwa sasa.',
  badgeTitle: 'Beji ya "Imekaguliwa na Kwetuly"',
  badgeBody: 'Mwaka mmoja. Ukishalipa, Kwetuly inakagua biashara yako na kuonyesha kwenye ukurasa wako kilichokaguliwa na lini.',
  badgePay: 'Lipia beji: {amount}',
  badgePaidUntil: 'Beji imelipwa hadi {date}.',
  badgeNoRefund: 'Ada inalipia ukaguzi. Hairudishwi kama biashara haitapita ukaguzi.',
  myPayments: 'Malipo yangu',
};

/** Kiswahili for 'sw', English for every other language. */
export const lipaMemberText = (locale: Locale | string): LipaMemberText => (locale === 'sw' ? sw : en);
