// Texts of the admin feature-switch page /admin/features (slice W1-1). Admin texts: English and
// Kiswahili. Kiswahili is a draft for native-speaker review. Feature names live in ../features.ts.

export type FeaturesText = {
  title: string;
  intro: string;
  legalPendingOnly: string;
  showAll: string;
  on: string;
  off: string;
  switchOn: string;
  switchOff: string;
  lockedOff: string;
  lockedOffNote: string;
  legalPending: string;
  legalCheckedOn: string;
  legalQuestion: string;
  markCleared: string;
  markPending: string;
  checkedDate: string;
  teamOnly: string;
  teamOnlyNote: string;
  teamOnlyOn: string;
  teamOnlyOff: string;
  lastChange: string;
  noChange: string;
  setupChange: string;
  missingRow: string;
  boardRef: string;
  log: string;
  noLog: string;
  notApplied: string;
  loadFailed: string;
  tryAgain: string;
  saved: string;
  errNotAdmin: string;
  errLocked: string;
  errUnknown: string;
  errDate: string;
  errFailed: string;
};

export const FEATURES_TEXT: Record<'en' | 'sw', FeaturesText> = {
  en: {
    title: 'Feature switches',
    intro:
      'One row per feature. Off hides its screens and refuses new writes; nothing is deleted. Every change is logged with who and when. Live payments stay locked off here: the payment code also refuses live keys until the company is registered.',
    legalPendingOnly: 'Legal check pending only',
    showAll: 'Show all',
    on: 'On',
    off: 'Off',
    switchOn: 'Switch on',
    switchOff: 'Switch off',
    lockedOff: 'Locked off',
    lockedOffNote: 'Cannot be switched on from this page.',
    legalPending: 'Legal check pending',
    legalCheckedOn: 'Legal checked on',
    legalQuestion: 'Question for the advocate',
    markCleared: 'Mark legal check done',
    markPending: 'Mark legal check pending',
    checkedDate: 'Date of the advocate\'s answer',
    teamOnly: 'Team preview',
    teamOnlyNote: 'While off, admins still see it.',
    teamOnlyOn: 'Turn team preview on',
    teamOnlyOff: 'Turn team preview off',
    lastChange: 'Last change',
    noChange: 'No change logged yet',
    setupChange: 'set up',
    missingRow: 'No row in the database yet, so it reads as off.',
    boardRef: 'Board',
    log: 'Change log (latest 50)',
    noLog: 'No changes yet.',
    notApplied: 'The feature switch migration is not on this database yet.',
    loadFailed: 'Sorry, the switches could not be loaded. Please try again.',
    tryAgain: 'Try again',
    saved: 'Saved and logged.',
    errNotAdmin: 'Only admins with two-step sign-in can change switches.',
    errLocked: 'This switch is locked off.',
    errUnknown: 'This switch was not found. Reload the page.',
    errDate: 'Type the date of the advocate\'s answer (today or earlier).',
    errFailed: 'That did not work. Please try again.',
  },
  sw: {
    title: 'Swichi za huduma',
    intro:
      'Mstari mmoja kwa kila huduma. Ikizimwa, kurasa zake zinafichwa na maingizo mapya yanakataliwa; hakuna kinachofutwa. Kila badiliko linahifadhiwa pamoja na aliyebadilisha na lini. Malipo halisi yamefungwa hapa: msimbo wa malipo pia unakataa funguo halisi mpaka kampuni isajiliwe.',
    legalPendingOnly: 'Zinazosubiri ukaguzi wa kisheria tu',
    showAll: 'Onyesha zote',
    on: 'Imewashwa',
    off: 'Imezimwa',
    switchOn: 'Washa',
    switchOff: 'Zima',
    lockedOff: 'Imefungwa (imezimwa)',
    lockedOffNote: 'Haiwezi kuwashwa kutoka ukurasa huu.',
    legalPending: 'Inasubiri ukaguzi wa kisheria',
    legalCheckedOn: 'Imekaguliwa kisheria tarehe',
    legalQuestion: 'Swali kwa wakili',
    markCleared: 'Weka ukaguzi wa kisheria umekamilika',
    markPending: 'Weka inasubiri ukaguzi wa kisheria',
    checkedDate: 'Tarehe ya jibu la wakili',
    teamOnly: 'Onyesho kwa timu',
    teamOnlyNote: 'Ikiwa imezimwa, wasimamizi bado wanaiona.',
    teamOnlyOn: 'Washa onyesho kwa timu',
    teamOnlyOff: 'Zima onyesho kwa timu',
    lastChange: 'Badiliko la mwisho',
    noChange: 'Hakuna badiliko lililohifadhiwa bado',
    setupChange: 'imewekwa',
    missingRow: 'Bado haipo kwenye hifadhidata, kwa hiyo inasomeka kama imezimwa.',
    boardRef: 'Ubao',
    log: 'Kumbukumbu za mabadiliko (50 za mwisho)',
    noLog: 'Hakuna mabadiliko bado.',
    notApplied: 'Uhamisho wa swichi za huduma bado haupo kwenye hifadhidata hii.',
    loadFailed: 'Samahani, swichi hazikuweza kupakiwa. Tafadhali jaribu tena.',
    tryAgain: 'Jaribu tena',
    saved: 'Imehifadhiwa na kurekodiwa.',
    errNotAdmin: 'Wasimamizi wenye uthibitisho wa hatua mbili tu ndio wanaweza kubadilisha swichi.',
    errLocked: 'Swichi hii imefungwa.',
    errUnknown: 'Swichi hii haikupatikana. Pakia ukurasa upya.',
    errDate: 'Andika tarehe ya jibu la wakili (leo au kabla).',
    errFailed: 'Haikufanikiwa. Tafadhali jaribu tena.',
  },
};

export const featuresText = (locale: string): FeaturesText => (locale === 'sw' ? FEATURES_TEXT.sw : FEATURES_TEXT.en);
