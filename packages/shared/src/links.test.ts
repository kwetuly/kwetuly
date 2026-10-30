import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { linkErrorMessage } from './dictionaries';
import { LINK_PATTERNS, normaliseSocial, normaliseTripadvisor, normaliseWebsite, safeExternalUrl, socialHandle, type LinkResult, type SocialPlatform } from './links';

const url = (r: LinkResult) => (r.ok ? r.url : `fail:${r.reason}`);

describe('normaliseSocial: instagram', () => {
  const ig = (s: string) => url(normaliseSocial('instagram', s));
  it('accepts profile links, bare names and @names', () => {
    expect(ig('https://www.instagram.com/amani.guide')).toBe('https://www.instagram.com/amani.guide/');
    expect(ig('https://instagram.com/Amani_Guide/?igsh=abc123')).toBe('https://www.instagram.com/amani_guide/');
    expect(ig('instagram.com/amani')).toBe('https://www.instagram.com/amani/');
    expect(ig('@amani')).toBe('https://www.instagram.com/amani/');
    expect(ig('  amani  ')).toBe('https://www.instagram.com/amani/');
    expect(ig('HTTPS://WWW.INSTAGRAM.COM/amani')).toBe('https://www.instagram.com/amani/');
  });
  it('returns the handle', () => {
    const r = normaliseSocial('instagram', 'https://www.instagram.com/amani/');
    expect(r.ok && r.handle).toBe('amani');
  });
  it('refuses other hosts, schemes and lookalikes', () => {
    expect(ig('http://instagram.com/amani')).toBe('fail:scheme');
    expect(ig('javascript:alert(1)')).toBe('fail:scheme');
    expect(ig('https://instagram.com.evil.com/amani')).toBe('fail:host');
    expect(ig('https://evil.com/instagram.com/amani')).toBe('fail:host');
    expect(ig('https://l.instagram.com/?u=https://evil.com')).toBe('fail:host');
    expect(ig('https://www.instagram.com@evil.com/amani')).toBe('fail:credentials');
    expect(ig('https://user:pw@instagram.com/amani')).toBe('fail:credentials');
    expect(ig('https://@instagram.com/amani')).toBe('fail:credentials');
    expect(ig('https://instagram.com:8443/amani')).toBe('fail:port');
    expect(ig('https://www.facebook.com/amani')).toBe('fail:host');
  });
  it('refuses posts, reserved paths and bad names', () => {
    expect(ig('https://www.instagram.com/p/Cx123/')).toBe('fail:handle');
    expect(ig('https://www.instagram.com/p/')).toBe('fail:reserved');
    expect(ig('https://www.instagram.com/explore')).toBe('fail:reserved');
    expect(ig('reels')).toBe('fail:reserved');
    expect(ig('https://www.instagram.com/')).toBe('fail:handle');
    expect(ig('instagram.com')).toBe('fail:handle');
    expect(ig('a'.repeat(31))).toBe('fail:handle');
    expect(ig('amani-guide')).toBe('fail:host');
    expect(ig('...')).toBe('fail:reserved');
    expect(ig('ama ni')).toBe('fail:invalid');
    expect(ig('')).toBe('fail:empty');
  });
});

describe('normaliseSocial: facebook', () => {
  const fb = (s: string) => url(normaliseSocial('facebook', s));
  it('accepts pages, profile.php ids and fb.com', () => {
    expect(fb('https://www.facebook.com/Amani.Safaris')).toBe('https://www.facebook.com/amani.safaris');
    expect(fb('https://m.facebook.com/amanisafaris/')).toBe('https://www.facebook.com/amanisafaris');
    expect(fb('https://fb.com/amanisafaris')).toBe('https://www.facebook.com/amanisafaris');
    expect(fb('@amanisafaris')).toBe('https://www.facebook.com/amanisafaris');
    expect(fb('https://www.facebook.com/profile.php?id=100012345678&ref=xyz')).toBe('https://www.facebook.com/profile.php?id=100012345678');
    const r = normaliseSocial('facebook', 'https://www.facebook.com/profile.php?id=100012345678');
    expect(r.ok && r.handle).toBeNull();
  });
  it('never accepts the l.facebook.com redirector or share and login paths', () => {
    expect(fb('https://l.facebook.com/l.php?u=https%3A%2F%2Fevil.com')).toBe('fail:host');
    expect(fb('https://www.facebook.com/l.php?u=https%3A%2F%2Fevil.com')).toBe('fail:reserved');
    expect(fb('https://www.facebook.com/sharer')).toBe('fail:reserved');
    expect(fb('https://www.facebook.com/share/')).toBe('fail:reserved');
    expect(fb('https://www.facebook.com/login')).toBe('fail:reserved');
    expect(fb('https://www.facebook.com/groups/12345')).toBe('fail:handle');
    expect(fb('https://www.facebook.com/profile.php')).toBe('fail:handle');
    expect(fb('https://www.facebook.com/profile.php?id=12ab')).toBe('fail:handle');
    expect(fb('https://www.facebook.com/photo.php?fbid=1')).toBe('fail:reserved');
    expect(fb('https://www.facebook.com/abc')).toBe('fail:handle');
    expect(fb('https://www.facebook.com/a_b_c_d')).toBe('fail:handle');
    expect(fb('https://facebook.com.evil.com/amanisafaris')).toBe('fail:host');
    expect(fb('www.facebook.com')).toBe('fail:handle');
  });
});

describe('normaliseSocial: tiktok', () => {
  const tt = (s: string) => url(normaliseSocial('tiktok', s));
  it('accepts profile links, bare names and @names', () => {
    expect(tt('https://www.tiktok.com/@Amani.Tz')).toBe('https://www.tiktok.com/@amani.tz');
    expect(tt('https://tiktok.com/@amani_tz/?lang=en')).toBe('https://www.tiktok.com/@amani_tz');
    expect(tt('@amani')).toBe('https://www.tiktok.com/@amani');
    expect(tt('amani')).toBe('https://www.tiktok.com/@amani');
  });
  it('refuses videos, short links and bad names', () => {
    expect(tt('https://www.tiktok.com/@amani/video/123')).toBe('fail:handle');
    expect(tt('https://www.tiktok.com/amani')).toBe('fail:handle');
    expect(tt('https://vm.tiktok.com/ZMabc/')).toBe('fail:host');
    expect(tt('@a')).toBe('fail:handle');
    expect(tt('@..')).toBe('fail:reserved');
    expect(tt('a'.repeat(25))).toBe('fail:handle');
  });
});

describe('normaliseWebsite', () => {
  const web = (s: string) => url(normaliseWebsite(s));
  it('keeps https sites and lower-cases scheme and host', () => {
    expect(web('https://www.example.co.tz')).toBe('https://www.example.co.tz/');
    expect(web('HTTPS://WWW.Example.CO.TZ/Rooms?x=1#top')).toBe('https://www.example.co.tz/Rooms?x=1#top');
    expect(web('http://example.com/a')).toBe('https://example.com/a');
    expect(web('example.com')).toBe('https://example.com/');
    expect(web('https://example.com:443/')).toBe('https://example.com/');
    expect(web('http://example.com:443/')).toBe('https://example.com/');
    expect(web('https://münchen.de')).toBe('https://xn--mnchen-3ya.de/');
    const r = normaliseWebsite('https://Shop.Example.com/x');
    expect(r.ok && r.host).toBe('shop.example.com');
  });
  it('refuses other schemes, credentials, ports, odd hosts and long input', () => {
    expect(web('javascript:alert(1)')).toBe('fail:scheme');
    expect(web('data:text/html,hi')).toBe('fail:scheme');
    expect(web('ftp://example.com')).toBe('fail:scheme');
    expect(web('https://user@example.com')).toBe('fail:credentials');
    expect(web('https://user:pw@example.com')).toBe('fail:credentials');
    expect(web('https://@example.com')).toBe('fail:credentials');
    expect(web('https://example.com:8080')).toBe('fail:port');
    expect(web('https://localhost')).toBe('fail:host');
    expect(web('https://192.168.1.1')).toBe('fail:host');
    expect(web('https://[::1]/')).toBe('fail:host');
    expect(web('https://example.com./')).toBe('fail:host');
    expect(web('https://exa mple.com')).toBe('fail:invalid');
    expect(web('https://example.com/a b')).toBe('fail:invalid');
    expect(web('https://example.com\\@evil.com')).toBe('fail:invalid');
    expect(web(`https://example.com/${'a'.repeat(300)}`)).toBe('fail:too_long');
    expect(web('   ')).toBe('fail:empty');
  });
  it('encodes characters that are not safe in a link', () => {
    expect(web('https://example.com/"onmouseover=x<b>')).toBe('https://example.com/%22onmouseover=x%3Cb%3E');
    expect(web('https://example.com/ü')).toBe('https://example.com/%C3%BC');
  });
});

describe('normaliseTripadvisor', () => {
  it('accepts tripadvisor hosts only', () => {
    expect(url(normaliseTripadvisor('https://www.tripadvisor.com/Attraction_Review-g1-d2.html'))).toBe('https://www.tripadvisor.com/Attraction_Review-g1-d2.html');
    expect(url(normaliseTripadvisor('https://www.tripadvisor.co.uk/x'))).toBe('https://www.tripadvisor.co.uk/x');
    expect(url(normaliseTripadvisor('https://fr.tripadvisor.ca/x'))).toBe('https://fr.tripadvisor.ca/x');
    expect(url(normaliseTripadvisor('https://tripadvisor.com.evil.com/x'))).toBe('fail:host');
    expect(url(normaliseTripadvisor('https://evil.com/tripadvisor.com'))).toBe('fail:host');
  });
});

describe('every stored link matches the database patterns', () => {
  const samples: Record<SocialPlatform, string[]> = {
    instagram: ['amani', '@a.b_c', 'https://instagram.com/x/', 'z'.repeat(30)],
    facebook: ['amani.safaris', 'https://fb.com/abcde', 'https://www.facebook.com/profile.php?id=12345', '1'.repeat(50)],
    tiktok: ['@ab', 'https://tiktok.com/@a.b_c', 'q'.repeat(24)],
  };
  for (const [platform, inputs] of Object.entries(samples) as [SocialPlatform, string[]][]) {
    it(platform, () => {
      for (const input of inputs) {
        const r = normaliseSocial(platform, input);
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(new RegExp(LINK_PATTERNS[platform]).test(r.url)).toBe(true);
          expect(new RegExp(LINK_PATTERNS[`${platform}Reserved`]).test(r.url)).toBe(false);
        }
      }
    });
  }
  it('website', () => {
    for (const input of ['example.com', 'https://a.b.co.tz/x?y=1&z=%20#f', 'http://EXAMPLE.org/{a}|^`', 'https://münchen.de/ü']) {
      const r = normaliseWebsite(input);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(new RegExp(LINK_PATTERNS.website).test(r.url)).toBe(true);
        expect(/["<>\\]/.test(r.url)).toBe(false);
      }
    }
  });

  // The migration must use exactly the same patterns as this module.
  it('the migration uses the same patterns', () => {
    const sql = readFileSync(new URL('../../../supabase/migrations/20261030000000_profile_link_checks.sql', import.meta.url), 'utf8');
    const body = sql.split('\n').filter((line) => !line.trimStart().startsWith('--')).join('\n');
    expect(body).toContain(`instagram_url ~ '${LINK_PATTERNS.instagram}'`);
    expect(body).toContain(`instagram_url !~ '${LINK_PATTERNS.instagramReserved}'`);
    expect(body).toContain(`facebook_url ~ '${LINK_PATTERNS.facebook}'`);
    expect(body).toContain(`facebook_url !~ '${LINK_PATTERNS.facebookReserved}'`);
    expect(body).toContain(`tiktok_url ~ '${LINK_PATTERNS.tiktok}'`);
    expect(body).toContain(`tiktok_url !~ '${LINK_PATTERNS.tiktokReserved}'`);
    expect(body.split(`website ~ '${LINK_PATTERNS.website}'`).length - 1).toBe(2);
    expect(body).toContain(`meeting_link ~ '${LINK_PATTERNS.website}'`);
    expect(body).toContain(`tripadvisor_url ~ '${LINK_PATTERNS.tripadvisor}'`);
    // The read-only check in the header uses them too.
    expect(sql.split(LINK_PATTERNS.facebookReserved).length - 1).toBe(2);
  });
});

describe('socialHandle and safeExternalUrl', () => {
  it('reads the handle from a stored link, or hides a bad one', () => {
    expect(socialHandle('instagram', 'https://www.instagram.com/amani/')).toBe('amani');
    expect(socialHandle('facebook', 'https://www.facebook.com/profile.php?id=123456')).toBeNull();
    expect(socialHandle('tiktok', 'https://evil.com/@amani')).toBeUndefined();
    expect(socialHandle('tiktok', null)).toBeUndefined();
  });
  it('opens only plain https links', () => {
    expect(safeExternalUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(safeExternalUrl('http://example.com')).toBeNull();
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('intent://scan/#Intent;scheme=zxing;end')).toBeNull();
    expect(safeExternalUrl('https://user:pw@example.com')).toBeNull();
    expect(safeExternalUrl('https://example.com:8080')).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });
});

describe('link messages', () => {
  it('has English and Kiswahili messages for every field', () => {
    expect(linkErrorMessage('link_instagram', 'en')).toContain('Instagram');
    expect(linkErrorMessage('link_tiktok', 'sw')).toContain('https://www.tiktok.com/@yourname');
    expect(linkErrorMessage('link_website', 'fr')).toBe(linkErrorMessage('link_website', 'en'));
    expect(linkErrorMessage('name', 'en')).toBeNull();
  });
});
