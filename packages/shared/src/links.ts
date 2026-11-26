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

export type LinkFailure = 'empty' | 'too_long' | 'invalid' | 'scheme' | 'credentials' | 'port' | 'host' | 'handle' | 'reserved' | 'blocked';

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
  /**
   * Google Business Profile links (supabase/migrations/20261126000200_profile_links.sql), stored as one of
   * https://g.page/<name>, https://g.page/r/<id>, https://maps.app.goo.gl/<id>,
   * https://www.google.com/maps/place/<path>, https://business.google.com/<path>. No query, no fragment.
   */
  google:
    '^https://(g\\.page/(r/)?[A-Za-z0-9_-]{2,100}|maps\\.app\\.goo\\.gl/[A-Za-z0-9]{4,40}|www\\.google\\.com/maps/place/[A-Za-z0-9%+._,:@!=~/-]{1,560}|business\\.google\\.com/[A-Za-z0-9_~/-]{1,200})$',
  /**
   * Refused in a Google link: a path segment that starts with a dot (or an encoded dot), so a link can
   * never climb out of /maps/place/, and an empty segment ("//") anywhere after the host.
   */
  googleBadPath: '/(\\.|%2[eE])|^https://[^/]+.*//',
  /** YouTube channels: https://www.youtube.com/@<handle> or https://www.youtube.com/channel/UC<22 characters>. */
  youtube: '^https://www\\.youtube\\.com/(@[a-z0-9._-]{3,30}|channel/UC[A-Za-z0-9_-]{22})$',
  youtubeReserved: '^https://www\\.youtube\\.com/@[._-]+$',
  /**
   * Hosts a profile's own website may not be (the host or any subdomain of it):
   * - chat links, which would publish a phone number and take the conversation off Kwetuly;
   * - link-in-bio pages, which usually carry chat links;
   * - short links, which hide where the link goes;
   * - Facebook, Instagram, Google, YouTube and TikTok, which have their own fields (this also covers
   *   their redirectors such as l.facebook.com, google.com/url and youtube.com/redirect);
   * - Discord invite links (discord.gg and discord.com/invite).
   */
  websiteBlocked:
    '^https://([a-z0-9-]+\\.)*(wa\\.me|wa\\.link|whatsapp\\.com|whatsapp\\.net|t\\.me|telegram\\.me|telegram\\.org|telegram\\.dog|m\\.me|ig\\.me|signal\\.me|viber\\.me|invite\\.viber\\.com|messenger\\.com|discord\\.gg|linktr\\.ee|tr\\.ee|beacons\\.ai|bio\\.link|lnk\\.bio|bit\\.ly|bitly\\.com|tinyurl\\.com|goo\\.gl|t\\.co|t\\.ly|s\\.id|bl\\.ink|j\\.mp|ow\\.ly|is\\.gd|buff\\.ly|cutt\\.ly|rb\\.gy|tiny\\.cc|shorturl\\.at|rebrand\\.ly|lnkd\\.in|fb\\.me|qrco\\.de|snip\\.ly|youtu\\.be|g\\.page|facebook\\.com|fb\\.com|instagram\\.com|youtube\\.com|tiktok\\.com|google\\.([a-z]{2,63}|com?\\.[a-z]{2}))(/|$)|^https://([a-z0-9-]+\\.)*discord(app)?\\.com/invite(/|$)',
  /**
   * A Tanzanian phone number anywhere in the website (host, path, query or fragment): 255 or 0, then 6 or
   * 7, then 8 digits, with an optional + (or %2B) and - . or encoded space between the digits. Not part of
   * a longer run of digits, so booking or page numbers stay allowed.
   */
  websitePhoneLike:
    '(^|[^0-9])(\\+|%2[bB])?(2(-|\\.|%20)?5(-|\\.|%20)?5|0)(-|\\.|%20)?[67]((-|\\.|%20)?[0-9]){8}([^0-9]|$)',
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

// ---------------------------------------------------------------------------
// Google Business Profile, YouTube and a profile's own website (slice S5, social links)
// Stored in guides.google_business_url, youtube_url, website and providers.google_business_url,
// youtube_url (plus the providers' Facebook, Instagram and TikTok links, with the guide rules above).
// The database checks the same patterns: supabase/migrations/20261126000200_profile_links.sql.
// ---------------------------------------------------------------------------

/** Longest Google link kept (a Maps place link with its data path can be long). */
const GOOGLE_MAX = 600;

/** Only these Google hosts. maps.app.goo.gl is Google's own Maps share link; no other goo.gl short link. */
const GOOGLE_HOSTS: readonly string[] = ['g.page', 'maps.app.goo.gl', 'google.com', 'www.google.com', 'maps.google.com', 'business.google.com'];

/** Characters never part of a link someone means to share (spaces, control characters, backslashes). */
const BAD_INPUT = /[\s\u0000-\u001f\u007f\\]/;

/** Parses typed text as an https address (http is upgraded when allowed, a bare host gets https://). */
function parseHttps(raw: string, allowHttp: boolean): { ok: true; url: URL } | { ok: false; reason: LinkFailure } {
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  const full = hasScheme ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(full);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) return { ok: false, reason: 'scheme' };
  if (url.username || url.password || /^[a-z]+:\/\/[^/?#]*@/i.test(full)) return { ok: false, reason: 'credentials' };
  if (url.port && url.port !== '443') return { ok: false, reason: 'port' };
  return { ok: true, url };
}

/**
 * Cleans a Google Business Profile link (the "Share" link from Google Maps, a g.page link, a Maps
 * place link or a business.google.com link) into one stored form: https, no query, no fragment,
 * no trailing slash.
 */
export function normaliseGoogleBusiness(input: string | null | undefined): LinkResult {
  const raw = String(input ?? '').trim();
  if (!raw) return fail('empty');
  if (raw.length > 2000) return fail('too_long');
  if (BAD_INPUT.test(raw)) return fail('invalid');
  const parsed = parseHttps(raw, true);
  if (!parsed.ok) return fail(parsed.reason);
  const { hostname: host, pathname: path } = parsed.url;
  if (!GOOGLE_HOSTS.includes(host)) return fail('host');

  let out: string;
  if (host === 'g.page') {
    // g.page/<name>, g.page/r/<id>, and the same with /review (the "write a review" link).
    const m = path.match(/^\/(r\/)?([A-Za-z0-9_-]{2,100})(\/review)?\/?$/);
    if (!m) return fail('handle');
    out = `https://g.page/${m[1] ?? ''}${m[2]}`;
  } else if (host === 'maps.app.goo.gl') {
    const m = path.match(/^\/([A-Za-z0-9]{4,40})\/?$/);
    if (!m) return fail('handle');
    out = `https://maps.app.goo.gl/${m[1]}`;
  } else if (host === 'business.google.com') {
    const trimmed = path.replace(/\/+$/, '');
    if (!trimmed) return fail('handle');
    out = `https://business.google.com${trimmed}`;
  } else {
    // google.com, www.google.com, maps.google.com: a Maps place only (never /url, /amp or search).
    if (!path.startsWith('/maps/place/')) return fail('handle');
    out = `https://www.google.com${path.replace(/\/+$/, '')}`;
  }
  if (out.length > GOOGLE_MAX) return fail('too_long');
  if (matches(LINK_PATTERNS.googleBadPath, out) || !matches(LINK_PATTERNS.google, out)) return fail('handle');
  return { ok: true, url: out, host: new URL(out).hostname, handle: null };
}

const YOUTUBE_HOSTS: readonly string[] = ['youtube.com', 'www.youtube.com', 'm.youtube.com'];
/** Channel tabs people copy by accident; the link is kept to the channel itself. */
const YOUTUBE_TABS: readonly string[] = ['featured', 'videos', 'shorts', 'streams', 'playlists', 'podcasts', 'community', 'about'];
const YOUTUBE_HANDLE = /^[a-z0-9._-]{3,30}$/;
const YOUTUBE_CHANNEL = /^UC[A-Za-z0-9_-]{22}$/;

function youtubeFromHandle(rawHandle: string): LinkResult {
  const handle = rawHandle.toLowerCase();
  if (!YOUTUBE_HANDLE.test(handle)) return fail('handle');
  const url = `https://www.youtube.com/@${handle}`;
  if (matches(LINK_PATTERNS.youtubeReserved, url)) return fail('reserved');
  if (!matches(LINK_PATTERNS.youtube, url)) return fail('handle');
  return { ok: true, url, host: 'www.youtube.com', handle };
}

/**
 * Cleans a YouTube channel link, or a bare @name, into https://www.youtube.com/@name or
 * https://www.youtube.com/channel/UC... Video links (youtu.be, /watch) and old /c/ and /user/ links are refused.
 */
export function normaliseYoutube(input: string | null | undefined): LinkResult {
  const raw = String(input ?? '').trim();
  if (!raw) return fail('empty');
  if (raw.length > 300) return fail('too_long');
  if (BAD_INPUT.test(raw)) return fail('invalid');
  if (/^@?[A-Za-z0-9._-]+$/.test(raw) && !/^(www\.|m\.)?youtube\.com$/i.test(raw)) return youtubeFromHandle(raw.replace(/^@/, ''));

  const parsed = parseHttps(raw, false);
  if (!parsed.ok) return fail(parsed.reason);
  if (!YOUTUBE_HOSTS.includes(parsed.url.hostname)) return fail('host');
  const segments = parsed.url.pathname.split('/').slice(1);
  if (segments.at(-1) === '') segments.pop();
  const [first = '', ...rest] = segments;
  let result: LinkResult;
  if (first.startsWith('@')) {
    result = youtubeFromHandle(first.slice(1));
  } else if (first === 'channel') {
    const id = rest.shift() ?? '';
    if (!YOUTUBE_CHANNEL.test(id)) return fail('handle');
    const url = `https://www.youtube.com/channel/${id}`;
    result = matches(LINK_PATTERNS.youtube, url) ? { ok: true, url, host: 'www.youtube.com', handle: null } : fail('handle');
  } else {
    return fail('handle');
  }
  if (rest.length > 1 || (rest.length === 1 && !YOUTUBE_TABS.includes(rest[0]))) return fail('handle');
  return result;
}

/**
 * A guide's or business's own website: the website rules, never a host from websiteBlocked (chat,
 * link-in-bio, short links, the platforms that have their own field) and no Tanzanian phone number
 * anywhere in it, so it cannot publish a phone number or hide where it goes.
 */
export function normaliseProfileWebsite(input: string | null | undefined): LinkResult {
  const result = normaliseWebsite(input);
  if (!result.ok) return result;
  if (matches(LINK_PATTERNS.websiteBlocked, result.url) || matches(LINK_PATTERNS.websitePhoneLike, result.url)) return fail('blocked');
  return result;
}

/** True when a host has a punycode (xn--) label: it is shown as is, with a note, so a lookalike is visible. */
export const isPunycodeHost = (host: string): boolean => /(^|\.)xn--/.test(host);

/** Every link a guide or business can put on their page. */
export type ProfileLinkKind = SocialPlatform | 'google' | 'youtube' | 'website';

/** The links on a guide page, in the order they are shown and asked for. */
export const GUIDE_LINK_KINDS: readonly ProfileLinkKind[] = ['website', 'google', 'youtube', 'instagram', 'facebook', 'tiktok'];
/** The links a business adds on the links page (its website stays in the business form). */
export const BUSINESS_LINK_KINDS: readonly ProfileLinkKind[] = ['google', 'youtube', 'instagram', 'facebook', 'tiktok'];
/** Guide links that only show while feature.profile_links is on (Instagram, Facebook and TikTok always show). */
export const SWITCHED_GUIDE_LINK_KINDS: readonly ProfileLinkKind[] = ['website', 'google', 'youtube'];

/** The database column for each link, the same on guides and providers. */
export const PROFILE_LINK_COLUMNS = {
  website: 'website',
  google: 'google_business_url',
  youtube: 'youtube_url',
  instagram: 'instagram_url',
  facebook: 'facebook_url',
  tiktok: 'tiktok_url',
} as const satisfies Record<ProfileLinkKind, string>;

export type ProfileLinkColumn = (typeof PROFILE_LINK_COLUMNS)[ProfileLinkKind];

/** Platform names (not translated). The website's label comes from the dictionary. */
export const PROFILE_LINK_NAMES: Record<Exclude<ProfileLinkKind, 'website'>, string> = { ...SOCIAL_NAMES, google: 'Google', youtube: 'YouTube' };

/** Example links shown in hints and error messages. */
export const PROFILE_LINK_EXAMPLES: Record<ProfileLinkKind, string> = {
  ...SOCIAL_EXAMPLES,
  google: 'https://maps.app.goo.gl/AbCd1234',
  youtube: 'https://www.youtube.com/@yourname',
  website: 'https://www.yourname.co.tz',
};

/** Cleans any profile link with the rules for its kind. */
export function normaliseProfileLink(kind: ProfileLinkKind, input: string | null | undefined): LinkResult {
  if (kind === 'google') return normaliseGoogleBusiness(input);
  if (kind === 'youtube') return normaliseYoutube(input);
  if (kind === 'website') return normaliseProfileWebsite(input);
  return normaliseSocial(kind, input);
}

export type ShownProfileLink = { kind: ProfileLinkKind; url: string; host: string; handle: string | null };

/** Stored links that are not valid for their kind (pages leave them out); for the admin review card. */
export function invalidProfileLinks(
  row: Partial<Record<ProfileLinkColumn, string | null | undefined>> | null | undefined,
  kinds: readonly ProfileLinkKind[],
): { kind: ProfileLinkKind; value: string }[] {
  if (!row) return [];
  return kinds.flatMap((kind) => {
    const stored = row[PROFILE_LINK_COLUMNS[kind]];
    return stored && !normaliseProfileLink(kind, stored).ok ? [{ kind, value: stored }] : [];
  });
}

/**
 * The stored links to show on a page, in the order of `kinds`. Each stored value is cleaned again and
 * left out when it is not a valid link of its kind (for example a row saved before the checks).
 * Pages render every one with rel={USER_LINK_REL}.
 */
export function shownProfileLinks(
  row: Partial<Record<ProfileLinkColumn, string | null | undefined>> | null | undefined,
  kinds: readonly ProfileLinkKind[],
): ShownProfileLink[] {
  if (!row) return [];
  const out: ShownProfileLink[] = [];
  for (const kind of kinds) {
    const stored = row[PROFILE_LINK_COLUMNS[kind]];
    if (!stored) continue;
    const result = normaliseProfileLink(kind, stored);
    if (result.ok) out.push({ kind, url: result.url, host: result.host, handle: result.handle });
  }
  return out;
}
