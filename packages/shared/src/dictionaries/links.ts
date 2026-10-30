// Messages for the profile-link checks (packages/shared/src/links.ts). Only guides and business
// owners see them, so English and Kiswahili, like the other guide and owner texts.
import type { Locale } from '../locales';
import { SOCIAL_EXAMPLES, SOCIAL_NAMES, type SocialPlatform } from '../links';

const en = {
  socialInvalid: 'Your {platform} link was not saved. Paste the link to your own profile, for example {example}, or just type your @name.',
  socialHint: 'Paste the link to your profile, or just type your @name.',
  websiteInvalid: 'Your website was not saved. Use the full address of your own site, for example https://www.yourbusiness.co.tz.',
  checkLinks: 'Your profile was not saved. Please check your profile links (Instagram, Facebook, TikTok): each must be the link to your own profile, or just your @name.',
};

export type LinkTexts = typeof en;

const sw: LinkTexts = {
  socialInvalid: 'Kiungo chako cha {platform} hakikuhifadhiwa. Bandika kiungo cha wasifu wako mwenyewe, kwa mfano {example}, au andika tu @jina lako.',
  socialHint: 'Bandika kiungo cha wasifu wako, au andika tu @jina lako.',
  websiteInvalid: 'Tovuti yako haikuhifadhiwa. Tumia anwani kamili ya tovuti yako, kwa mfano https://www.biasharayako.co.tz.',
  checkLinks: 'Wasifu wako haukuhifadhiwa. Tafadhali angalia viungo vya wasifu wako (Instagram, Facebook, TikTok): kila kimoja kiwe kiungo cha wasifu wako mwenyewe, au @jina lako tu.',
};

export const LINK_TEXT: Record<'en' | 'sw', LinkTexts> = { en, sw };

/** Guide and owner texts: Kiswahili for 'sw', English for every other language. */
export const linkTexts = (locale: Locale | string): LinkTexts => (locale === 'sw' ? sw : en);

/** The error code a save path uses for each field ("link_instagram", ..., "link_website"). */
export type LinkErrorCode = `link_${SocialPlatform}` | 'link_website' | 'links';

export const linkErrorCode = (field: SocialPlatform | 'website'): LinkErrorCode => `link_${field}`;

/** The friendly message for a link error code, or null when the code is not a link error. */
export function linkErrorMessage(code: unknown, locale: Locale | string): string | null {
  const texts = linkTexts(locale);
  if (code === 'link_website') return texts.websiteInvalid;
  if (code === 'links') return texts.checkLinks;
  for (const platform of Object.keys(SOCIAL_NAMES) as SocialPlatform[]) {
    if (code === `link_${platform}`) {
      return texts.socialInvalid.replace('{platform}', SOCIAL_NAMES[platform]).replace('{example}', SOCIAL_EXAMPLES[platform]);
    }
  }
  return null;
}
