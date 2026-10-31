// Security page, "Connected sign-ins": the intro while connecting another sign-in is not switched on
// yet (the full intro in ux.ts asks people to connect another one). Traveller-facing: 7 languages.
import type { Locale } from '../locales';

export const SIGN_INS_TEXT: Record<Locale, { bodyNoLinking: string }> = {
  en: { bodyNoLinking: 'The ways you can sign in to this Kwetuly account.' },
  sw: { bodyNoLinking: 'Njia unazoweza kutumia kuingia kwenye akaunti hii ya Kwetuly.' },
  fr: { bodyNoLinking: 'Les moyens de vous connecter à ce compte Kwetuly.' },
  it: { bodyNoLinking: 'I modi in cui puoi accedere a questo account Kwetuly.' },
  de: { bodyNoLinking: 'Die Wege, wie Sie sich bei diesem Kwetuly-Konto anmelden können.' },
  pl: { bodyNoLinking: 'Sposoby logowania do tego konta Kwetuly.' },
  zh: { bodyNoLinking: '你可以用来登录此 Kwetuly 账户的方式。' },
};
