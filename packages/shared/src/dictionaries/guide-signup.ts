// Six-step guide sign-up (slice S8): step 4 "send for checking", step 5 "Your page" (cover, gallery,
// links and the words about you on one screen) and step 6 "Calls and booking link" with the
// "Offer VIP hosting" switch. Guide texts, so English and Kiswahili; other languages show English.
// The Kiswahili is a draft for the localization check and Walter.
// VIP wording follows the hosts texts (docs/legal/vip-and-investment-hosts.md, a draft for a
// Tanzanian advocate): "VIP" describes the style of service only; no security or protection work.
import type { Locale } from '../locales';

const en = {
  // Step 4: once steps 1-4 are done the guide can send the profile for checking.
  sendTitle: 'Ready for checking',
  beforeTitle: 'Before checking',
  // A guide whose profile was not approved: saving does not send it back by itself (only Kwetuly can
  // reopen the check), so the guide is asked to get in touch.
  rejectedTitle: 'Your profile was not approved',
  /** Shown with the "Contact Kwetuly" email link (when the team address is set). */
  rejectedBody: 'You are welcome to update your details and save each step. Then please write to Kwetuly with the link below and ask for your profile to be checked again.',
  /** Shown while no team address is set, so there is no link to point to. */
  rejectedBodyNoLink: 'You are welcome to update your details and save each step. Then please contact Kwetuly and ask for your profile to be checked again.',
  /** The subject line of that email. */
  rejectedSubject: 'Please check my guide profile again',
  sendReady: 'Asante. Steps 1 to 4 are done, so Kwetuly can now check your profile and documents.',
  sendNotReady: 'Please finish steps 1 to 4 first. Then you can send your profile for checking.',
  sendMissing: 'Still to do: {steps}',
  send: 'Send for checking',
  sent: 'Asante. Your profile is with Kwetuly for checking. Steps 5 and 6 are optional, whenever you like.',
  continuePage: 'Continue to step 5',

  // Step 5, your page.
  pageIntro: 'This is what travellers see first. A few words about you are enough. Photos and links are welcome, but they are not needed.',
  photosTitle: 'Cover photo and gallery',
  photosNote: 'Photos are saved as soon as they finish uploading, so they do not need the save button below.',
  photosLater: 'Please finish step 1, about you. Then you can add photos here.',
  aboutTitle: 'About you',
  linksTitle: 'Your links',
  linksNote: 'Instagram, Facebook, TikTok and more. Please leave a field empty if you do not use it.',

  // Step 6, calls and booking link.
  callsTitle: 'Prep calls',
  vipTitle: 'VIP hosting',
  vipLabel: 'Offer VIP hosting',
  vipHint: 'You plan and host a trip around one guest or a small group, in the style they like. VIP describes the style of service only. Security, protection and escort work are not part of it.',
  vipOn: 'Your VIP hosting trip is sent for checking or approved.',
  vipCreate: 'After you save, please describe your VIP hosting as a trip, with its days and price. Kwetuly checks it before travellers see it.',
  vipOffNote: 'Switching this off hides your VIP hosting trip from travellers. Nothing is deleted.',
  vipError: 'Sorry, we could not change your VIP hosting. Please try again.',
  /** On My packages, reached from the switch (next=calls). */
  vipDescribe: 'Please describe your VIP hosting as a trip, with its days and price. Kwetuly checks it before travellers see it.',
  vipPartial: 'Your call settings were saved, but your VIP hosting was not changed. Please try the switch again.',

  // Profile strength: the item for step 4.
  strengthTrips: 'At least one trip',
};

export type GuideSignupText = typeof en;

const sw: GuideSignupText = {
  sendTitle: 'Tayari kukaguliwa',
  beforeTitle: 'Kabla ya ukaguzi',
  rejectedTitle: 'Wasifu wako haukuidhinishwa',
  rejectedBody: 'Unakaribishwa kusasisha taarifa zako na kuhifadhi kila hatua. Kisha tafadhali iandikie Kwetuly kupitia kiungo kilicho hapa chini uombe wasifu wako ukaguliwe tena.',
  rejectedBodyNoLink: 'Unakaribishwa kusasisha taarifa zako na kuhifadhi kila hatua. Kisha tafadhali wasiliana na Kwetuly uombe wasifu wako ukaguliwe tena.',
  rejectedSubject: 'Tafadhali kagueni tena wasifu wangu wa mwongoza watalii',
  sendReady: 'Asante. Hatua ya 1 hadi ya 4 zimekamilika, kwa hiyo Kwetuly sasa inaweza kukagua wasifu wako na nyaraka zako.',
  sendNotReady: 'Tafadhali maliza hatua ya 1 hadi ya 4 kwanza. Kisha unaweza kutuma wasifu wako ukaguliwe.',
  sendMissing: 'Bado kufanya: {steps}',
  send: 'Tuma ukaguliwe',
  sent: 'Asante. Wasifu wako uko kwa Kwetuly kwa ukaguzi. Hatua ya 5 na ya 6 si lazima, ukipenda.',
  continuePage: 'Endelea na hatua ya 5',

  pageIntro: 'Hiki ndicho wasafiri wanachokiona kwanza. Maneno machache kukuhusu yanatosha. Picha na viungo vinakaribishwa, lakini si lazima.',
  photosTitle: 'Picha ya jalada na picha nyingine',
  photosNote: 'Picha zinahifadhiwa mara tu zinapomaliza kupakiwa, kwa hiyo hazihitaji kitufe cha kuhifadhi kilicho chini.',
  photosLater: 'Tafadhali maliza hatua ya 1, kuhusu wewe. Kisha utaweza kuongeza picha hapa.',
  aboutTitle: 'Kuhusu wewe',
  linksTitle: 'Viungo vyako',
  linksNote: 'Instagram, Facebook, TikTok na vingine. Tafadhali acha sehemu wazi kama huitumii.',

  callsTitle: 'Simu za maandalizi',
  vipTitle: 'Mwenyeji wa VIP',
  vipLabel: 'Toa huduma ya mwenyeji wa VIP',
  vipHint: 'Unapanga na kumhudumia mgeni mmoja au kikundi kidogo katika safari inayolingana na mtindo wanaoupenda. VIP inaeleza mtindo wa huduma tu. Kazi ya ulinzi, usalama au kusindikiza kwa usalama si sehemu yake.',
  vipOn: 'Safari yako ya mwenyeji wa VIP imetumwa kukaguliwa au imeidhinishwa.',
  vipCreate: 'Baada ya kuhifadhi, tafadhali eleza huduma yako ya mwenyeji wa VIP kama safari, pamoja na siku na bei yake. Kwetuly itaikagua kabla wasafiri hawajaiona.',
  vipOffNote: 'Ukizima hii, safari yako ya mwenyeji wa VIP itafichwa kwa wasafiri. Hakuna kitakachofutwa.',
  vipError: 'Samahani, hatukuweza kubadilisha huduma yako ya mwenyeji wa VIP. Tafadhali jaribu tena.',
  vipDescribe: 'Tafadhali eleza huduma yako ya mwenyeji wa VIP kama safari, pamoja na siku na bei yake. Kwetuly itaikagua kabla wasafiri hawajaiona.',
  vipPartial: 'Mipangilio yako ya simu imehifadhiwa, lakini huduma yako ya mwenyeji wa VIP haikubadilishwa. Tafadhali jaribu kitufe hicho tena.',

  strengthTrips: 'Angalau safari moja',
};

/** Kiswahili for 'sw', English for every other language. */
export const guideSignupText = (locale: Locale | string): GuideSignupText => (locale === 'sw' ? sw : en);
