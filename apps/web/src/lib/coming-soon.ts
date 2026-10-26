// Before launch the live site (kwetuly.com) shows a "coming soon" page to everyone except the team.
// A team member opens /team-access once in their browser and types the team password
// (PREVIEW_PASSWORD, a Secret in Vercel); that browser then keeps a cookie and sees the full site.
// At launch, set SITE_OPEN=1 in Vercel and redeploy. Local development and preview builds are never closed.
export const PREVIEW_COOKIE = 'kw_team';
export const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export function siteClosed() {
  return process.env.VERCEL_ENV === 'production' && process.env.SITE_OPEN !== '1';
}

// The cookie holds a signature made with the password, never the password itself. Changing the
// password in Vercel signs every browser out of the preview.
export async function previewToken(password: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('kwetuly-team-preview-v1'));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hasPreviewAccess(cookieValue: string | undefined) {
  const password = process.env.PREVIEW_PASSWORD;
  if (!password || !cookieValue) return false;
  return safeEqual(cookieValue, await previewToken(password));
}

// Compares in constant time so the answer time doesn't reveal how much of a guess was right.
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
