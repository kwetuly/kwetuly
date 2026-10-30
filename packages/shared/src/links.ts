// Profile links that guides and business owners type in: social profiles and websites.
// Every save path (website, app, admin) runs these, and the database checks the stored value
// against the same patterns (supabase/migrations/20261030000000_profile_link_checks.sql), so the
// shapes here and the SQL patterns below must stay identical. links.test.ts checks both.

export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok';

export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = ['instagram', 'facebook', 'tiktok'];

export const SOCIAL_NAMES: Record<SocialPlatform, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };

/** Example links shown in error messages. */
export const SOCIAL_EXAMPLES: Record<SocialPlatform, string> = {
  instagram: 'https://www.instagram.com/yourname',
  facebook: 'https://www.facebook.com/yourname',
  tiktok: 'https://www.tiktok.com/@yourname',
};

export type LinkFailure = 'empty' | 'too_long' | 'invalid' | 'scheme' | 'credentials' | 'port' | 'host' | 'handle' | 'reserved';

export type LinkResult =
  | { ok: true; url: string; host: string; handle: string | null }
  | { ok: false; reason: LinkFailure };

const fail = (reason: LinkFailure): LinkResult => ({ ok: false, reason });

// ---------------------------------------------------------------------------
// Patterns shared with the database (Postgres ARE and JavaScript read them the same way).
// ---------------------------------------------------------------------------

/** A public host name: lower-case labels, at least one dot, a letter (or punycode) top-level domain. */
const HOST = '([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})';

export const LINK_PATTERNS = {
  /** Websites: https, a public host, then printable ASCII only. */
  website: `^https://${HOST}(/[!-~]*)?$`,
  tripadvisor: '^https://(www\\.|[a-z]{2}\\.)?tripadvisor\\.(com|[a-z]{2}|co\\.[a-z]{2}|com\\.[a-z]{2})(/[!-~]*)?$',
  instagram: '^https://www\\.instagram\\.com/[a-z0-9._]{1,30}/$',
  instagramReserved: '^https://www\\.instagram\\.com/(\\.+|p|reel|reels|stories|explore|accounts)/$',
  facebook: '^https://www\\.facebook\\.com/([a-z0-9.]{5,50}|profile\\.php\\?id=[0-9]{5,20})$',
  facebookReserved:
    '^https://www\\.facebook\\.com/(\\.+|[a-z0-9.]*\\.php|share|sharer|login|logout|groups|watch|events|plugins|pages|people|photo|photos|videos|reels|stories|marketplace|gaming|settings|messages|notifications|friends|hashtag|search|dialog|policies|privacy|business|recover|checkpoint)$',
  tiktok: '^https://www\\.tiktok\\.com/@[a-z0-9._]{2,24}$',
  tiktokReserved: '^https://www\\.tiktok\\.com/@\\.+$',
} as const;

/** Characters URL encoding never leaves in a link; the database refuses them too. */
const UNSAFE_CHARS = /["<>\\]/;

const WEBSITE_MAX = 300;
const TRIPADVISOR_MAX = 400;

const matches = (pattern: string, value: string) => new RegExp(pattern).test(value);

// ---------------------------------------------------------------------------
// Websites
// ---------------------------------------------------------------------------

/**
 * Cleans a website address: https (http is upgraded), no user name or password, no port other
 * than 443, a public host with a dot, lower-case scheme and host. A bare "example.com" gets https://.
 */
export function normaliseWebsite(input: string | null | undefined, maxLength = WEBSITE_MAX): LinkResult {
  const raw = String(input ?? '').trim();
  if (!raw) return fail('empty');
  if (raw.length > maxLength) return fail('too_long');
  // Spaces, control characters and backslashes are never part of a link someone means to share.
  if (/[\s\u0000-\u001f\u007f\\]/.test(raw)) return fail('invalid');
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  let url: URL;
  try {
    url = new URL(hasScheme ? raw : `https://${raw}`);
  } catch {
    return fail('invalid');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return fail('scheme');
  if (url.username || url.password || /^[a-z]+:\/\/[^/?#]*@/i.test(hasScheme ? raw : `https://${raw}`)) return fail('credentials');
  if (url.port && !(url.port === '443')) return fail('port');
  const host = url.hostname; // already lower-case and punycode
  if (!new RegExp(`^${HOST}$`).test(host)) return fail('host');
  const out = `https://${host}${url.pathname}${url.search}${url.hash}`;
  if (out.length > maxLength) return fail('too_long');
  if (UNSAFE_CHARS.test(out) || !matches(LINK_PATTERNS.website, out)) return fail('invalid');
  return { ok: true, url: out, host, handle: null };
}

/** A TripAdvisor page (admins only): a website on a tripadvisor host. */
export function normaliseTripadvisor(input: string | null | undefined): LinkResult {
  const result = normaliseWebsite(input, TRIPADVISOR_MAX);
  if (!result.ok) return result;
  return matches(LINK_PATTERNS.tripadvisor, result.url) ? result : fail('host');
}

// ---------------------------------------------------------------------------
// Social profiles
// ---------------------------------------------------------------------------

const SOCIAL_HOSTS: Record<SocialPlatform, readonly string[]> = {
  instagram: ['instagram.com', 'www.instagram.com'],
  // fb.com links are the same profiles; they are stored as facebook.com. Never l.facebook.com (a redirector).
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'www.fb.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com'],
};

const HANDLE: Record<SocialPlatform, RegExp> = {
  instagram: /^[a-z0-9._]{1,30}$/,
  facebook: /^[a-z0-9.]{5,50}$/,
  tiktok: /^[a-z0-9._]{2,24}$/,
};

const canonical: Record<SocialPlatform, (handle: string) => string> = {
  instagram: (h) => `https://www.instagram.com/${h}/`,
  facebook: (h) => `https://www.facebook.com/${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
};

const reservedPattern: Record<SocialPlatform, string> = {
  instagram: LINK_PATTERNS.instagramReserved,
  facebook: LINK_PATTERNS.facebookReserved,
  tiktok: LINK_PATTERNS.tiktokReserved,
};

/** Text that is the platform's own address with nothing after it, e.g. "facebook.com". */
const BARE_PLATFORM_HOST = /^(www\.|m\.)?(instagram|facebook|fb|tiktok)\.com$/i;

function fromHandle(platform: SocialPlatform, rawHandle: string): LinkResult {
  const handle = rawHandle.toLowerCase();
  if (!HANDLE[platform].test(handle)) return fail('handle');
  const url = canonical[platform](handle);
  if (matches(reservedPattern[platform], url)) return fail('reserved');
  if (!matches(LINK_PATTERNS[platform], url)) return fail('handle');
  return { ok: true, url, host: new URL(url).hostname, handle };
}

/**
 * Cleans an Instagram, Facebook or TikTok profile link, or a bare name / @name, into the
 * platform's canonical https profile address. The name is read from the path only.
 */
export function normaliseSocial(platform: SocialPlatform, input: string | null | undefined): LinkResult {
  const raw = String(input ?? '').trim();
  if (!raw) return fail('empty');
  if (raw.length > 300) return fail('too_long');
  if (/[\s\u0000-\u001f\u007f\\]/.test(raw)) return fail('invalid');

  // A bare name: "amani.guide" or "@amani.guide".
  if (/^@?[A-Za-z0-9._]+$/.test(raw) && !BARE_PLATFORM_HOST.test(raw)) {
    return fromHandle(platform, raw.replace(/^@/, ''));
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  const full = hasScheme ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(full);
  } catch {
    return fail('invalid');
  }
  if (url.protocol !== 'https:') return fail('scheme');
  if (url.username || url.password || /^[a-z]+:\/\/[^/?#]*@/i.test(full)) return fail('credentials');
  if (url.port) return fail('port');
  if (!SOCIAL_HOSTS[platform].includes(url.hostname)) return fail('host');

  const segments = url.pathname.split('/');
  // "/name" or "/name/" only: one path segment, at most one trailing slash.
  if (segments.length > 3 || (segments.length === 3 && segments[2] !== '')) return fail('handle');
  const segment = segments[1] ?? '';

  if (platform === 'facebook' && segment.toLowerCase() === 'profile.php') {
    const id = url.searchParams.get('id') ?? '';
    if (!/^[0-9]{5,20}$/.test(id)) return fail('handle');
    const out = `https://www.facebook.com/profile.php?id=${id}`;
    return matches(LINK_PATTERNS.facebook, out) ? { ok: true, url: out, host: 'www.facebook.com', handle: null } : fail('handle');
  }
  if (platform === 'tiktok') {
    if (!segment.startsWith('@')) return fail('handle');
    return fromHandle(platform, segment.slice(1));
  }
  return fromHandle(platform, segment);
}

/**
 * The handle to show next to a stored profile link ("@name"), or null when the link has no
 * name (a Facebook profile.php?id= link). Returns undefined when the stored value is not a valid
 * profile link at all, so pages can leave it out.
 */
export function socialHandle(platform: SocialPlatform, stored: string | null | undefined): string | null | undefined {
  if (!stored) return undefined;
  const result = normaliseSocial(platform, stored);
  return result.ok ? result.handle : undefined;
}

// ---------------------------------------------------------------------------
// Opening links from the database
// ---------------------------------------------------------------------------

/** The link if it is a plain https address (no user name, password or odd port), else null. */
export function safeExternalUrl(input: string | null | undefined): string | null {
  const raw = String(input ?? '').trim();
  if (!raw || /[\s\u0000-\u001f\u007f\\]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    if (/^[a-z]+:\/\/[^/?#]*@/i.test(raw)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** rel for every link a guide, owner or other user typed in. */
export const USER_LINK_REL = 'nofollow noopener noreferrer ugc';
