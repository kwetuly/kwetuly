// Guide sign-up progress line, the six step names and the "My booking link" card.
// Guide texts, so English and Kiswahili. The Kiswahili is a draft: Walter checks every line.
import type { Locale } from '../locales';
import type { StepProgress } from '../steps';

const en = {
  /** The six steps, in GUIDE_STEP_IDS order. */
  steps: ['About you', 'What you do', 'Your documents', 'Your trips', 'Your page', 'Calls and booking link'],
  /** What each step asks for, in the same order. */
  stepHints: [
    'Your name, region, languages and a photo',
    'A short headline and what you guide',
    'Your ID and your guide licence',
    'At least one trip you guide',
    'A few words about you. Cover photo, gallery and links are optional',
    'Prep calls and your booking link, whenever you are ready',
  ],
  stepsIntro: 'Karibu. There are six short steps, and the first four are needed. We save your work after each step, so you are welcome to stop and come back later.',
  stepOf: 'Step {n} of {total}',
  progressLabel: 'Your sign-up progress',
  finished: 'You have finished {n} of {total}.',
  moreSteps: '{left} more steps to finish.',
  moreStep: '1 more step to finish.',
  requiredDone: 'Asante. The needed steps are done. {left} optional steps are left, whenever you like.',
  requiredDoneOne: 'Asante. The needed steps are done. 1 optional step is left, whenever you like.',
  allDone: 'Asante. You have finished every step.',
  optional: 'Optional',
  done: 'Done',
  todo: 'To do',
  /** Screen reader text for one step, for example "Step 4, Your trips: To do". */
  stepStatus: 'Step {n}, {title}: {status}',
  // Step 4, your trips (counted from packages until trip library picks exist).
  tripsIntro: 'Please add at least one trip you guide, with its days and price. Travellers see it on your page after Kwetuly has checked it.',
  tripsNone: 'You have not added a trip yet.',
  tripsOne: 'You have 1 trip sent for checking or approved.',
  tripsMany: 'You have {n} trips sent for checking or approved.',
  tripsAdd: 'Add a trip',
  tripsSee: 'See my trips',
  continue: 'Continue',
  // Step 5, your page.
  coverSoon: 'A cover photo and a photo gallery are coming soon.',
  // Step 1: the photo is needed for the step to count as finished.
  photoNeeded: 'A photo is needed for this step. Please choose a clear photo of your face.',
  needed: 'needed',
  backToSignup: 'Back to your sign-up steps',

  // My booking link.
  linkTitle: 'My booking link',
  linkMenuHint: 'Copy it, share it or show its QR code to your guests',
  linkIntro: 'This is your own page on Kwetuly. You are welcome to share it with your guests on WhatsApp or Instagram, or show them the QR code, so they can see your trips and send you a request.',
  linkPending: 'Your link starts working once Kwetuly has approved your profile. Thank you for your patience.',
  linkNoProfile: 'Please finish the first step, about you, and your link will be ready here.',
  linkOff: 'Booking links are paused for now. Please check again later.',
  linkError: 'Sorry, we could not load your link. Please try again.',
  retry: 'Try again',
  copy: 'Copy link',
  copied: 'Link copied',
  share: 'Share',
  shareMore: 'More',
  email: 'Email',
  shareMessage: 'Karibu. This is my guide page on Kwetuly, where you can see my trips and send me a request:',
  qrTitle: 'QR code',
  qrAlt: 'QR code that opens your booking link',
  qrHint: 'Guests can point their phone camera at this code to open your page. You are welcome to print it.',
  qrSave: 'Save QR code',
  qrSoon: 'Your QR code will be ready when Kwetuly opens. Thank you for your patience.',
  print: 'Print',
  back: 'Back to my profile',
};

export type GuideProgressText = typeof en;

const sw: GuideProgressText = {
  steps: ['Kuhusu wewe', 'Unachofanya', 'Nyaraka zako', 'Safari zako', 'Ukurasa wako', 'Simu na kiungo cha kuweka nafasi'],
  stepHints: [
    'Jina lako, mkoa, lugha na picha',
    'Kichwa kifupi na unachoongoza',
    'Kitambulisho chako na leseni yako ya uongozaji',
    'Angalau safari moja unayoongoza',
    'Maneno machache kukuhusu. Picha ya jalada, picha nyingine na viungo si lazima',
    'Simu za maandalizi na kiungo chako cha kuweka nafasi, utakapokuwa tayari',
  ],
  stepsIntro: 'Karibu. Kuna hatua sita fupi, na nne za kwanza zinahitajika. Tunahifadhi kazi yako baada ya kila hatua, kwa hiyo unakaribishwa kusimama na kurudi baadaye.',
  stepOf: 'Hatua {n} kati ya {total}',
  progressLabel: 'Maendeleo ya usajili wako',
  finished: 'Umemaliza hatua {n} kati ya {total}.',
  moreSteps: 'Zimebaki hatua {left} kumaliza.',
  moreStep: 'Imebaki hatua 1 kumaliza.',
  requiredDone: 'Asante. Hatua zinazohitajika zimekamilika. Zimebaki hatua {left} zisizo za lazima, ukipenda.',
  requiredDoneOne: 'Asante. Hatua zinazohitajika zimekamilika. Imebaki hatua 1 isiyo ya lazima, ukipenda.',
  allDone: 'Asante. Umemaliza hatua zote.',
  optional: 'Si lazima',
  done: 'Imekamilika',
  todo: 'Bado',
  stepStatus: 'Hatua {n}, {title}: {status}',
  tripsIntro: 'Tafadhali ongeza angalau safari moja unayoongoza, pamoja na siku na bei yake. Wasafiri wataiona kwenye ukurasa wako baada ya Kwetuly kuikagua.',
  tripsNone: 'Bado hujaongeza safari.',
  tripsOne: 'Una safari 1 iliyotumwa kukaguliwa au iliyoidhinishwa.',
  tripsMany: 'Una safari {n} zilizotumwa kukaguliwa au zilizoidhinishwa.',
  tripsAdd: 'Ongeza safari',
  tripsSee: 'Tazama safari zangu',
  continue: 'Endelea',
  coverSoon: 'Picha ya jalada na picha nyingine zinakuja hivi karibuni.',
  photoNeeded: 'Picha inahitajika kwa hatua hii. Tafadhali chagua picha safi ya uso wako.',
  needed: 'inahitajika',
  backToSignup: 'Rudi kwenye hatua zako za usajili',

  linkTitle: 'Kiungo changu cha kuweka nafasi',
  linkMenuHint: 'Nakili, shiriki au waonyeshe wageni wako msimbo wa QR',
  linkIntro: 'Huu ni ukurasa wako mwenyewe kwenye Kwetuly. Unakaribishwa kuushiriki na wageni wako kwenye WhatsApp au Instagram, au kuwaonyesha msimbo wa QR, ili waone safari zako na wakutumie ombi.',
  linkPending: 'Kiungo chako kitaanza kufanya kazi baada ya Kwetuly kuidhinisha wasifu wako. Asante kwa uvumilivu wako.',
  linkNoProfile: 'Tafadhali maliza hatua ya kwanza, kuhusu wewe, na kiungo chako kitakuwa tayari hapa.',
  linkOff: 'Viungo vya kuweka nafasi vimesimamishwa kwa sasa. Tafadhali angalia tena baadaye.',
  linkError: 'Samahani, hatukuweza kupakia kiungo chako. Tafadhali jaribu tena.',
  retry: 'Jaribu tena',
  copy: 'Nakili kiungo',
  copied: 'Kiungo kimenakiliwa',
  share: 'Shiriki',
  shareMore: 'Zaidi',
  email: 'Barua pepe',
  shareMessage: 'Karibu. Huu ni ukurasa wangu wa mwongozaji kwenye Kwetuly, ambapo unaweza kuona safari zangu na kunitumia ombi:',
  qrTitle: 'Msimbo wa QR',
  qrAlt: 'Msimbo wa QR unaofungua kiungo chako cha kuweka nafasi',
  qrHint: 'Wageni wanaweza kuelekeza kamera ya simu yao kwenye msimbo huu ili kufungua ukurasa wako. Unakaribishwa kuuchapisha.',
  qrSave: 'Hifadhi msimbo wa QR',
  qrSoon: 'Msimbo wako wa QR utakuwa tayari Kwetuly itakapofunguliwa. Asante kwa uvumilivu wako.',
  print: 'Chapisha',
  back: 'Rudi kwenye wasifu wangu',
};

/** Kiswahili for 'sw', English for every other language. */
export const guideProgressText = (locale: Locale | string): GuideProgressText => (locale === 'sw' ? sw : en);

/** "You have finished 3 of 6. 3 more steps to finish." in the guide's language. */
export function guideProgressLine(progress: StepProgress, locale: Locale | string): string {
  const g = guideProgressText(locale);
  if (progress.left === 0) return g.allDone;
  const first = g.finished.replace('{n}', String(progress.finished)).replace('{total}', String(progress.total));
  if (progress.requiredLeft === 0) return `${first} ${progress.left === 1 ? g.requiredDoneOne : g.requiredDone.replace('{left}', String(progress.left))}`;
  return `${first} ${progress.left === 1 ? g.moreStep : g.moreSteps.replace('{left}', String(progress.left))}`;
}
