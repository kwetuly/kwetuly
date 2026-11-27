import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { linkErrorMessage, profileLinkCheckMessage, profileLinkErrorCode, profileLinkErrorMessage, profileLinkLabel, profileLinksShownText, profileLinksText, PROFILE_LINKS_TEXT } from './dictionaries';
import { LOCALES } from './locales';
import {
  BUSINESS_LINK_KINDS,
  GUIDE_LINK_KINDS,
  invalidProfileLinks,
  isPunycodeHost,
  LINK_PATTERNS,
  PROFILE_LINK_COLUMNS,
  normaliseGoogleBusiness,
  normaliseProfileLink,
  normaliseProfileWebsite,
  normaliseSocial,
  normaliseTripadvisor,
  normaliseWebsite,
  normaliseYoutube,
  safeExternalUrl,
  shownProfileLinks,
  socialHandle,
  type LinkResult,
  type SocialPlatform,
} from './links';

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
    // N3: a website the rules refuse is "not allowed", in English and Kiswahili.
    expect(linkErrorMessage('link_website_refused', 'en')).toMatch(/^This website is not allowed\./);
    expect(linkErrorMessage('link_website_blocked', 'sw')).toMatch(/^Tovuti hii hairuhusiwi\./);
  });
});

// ---------------------------------------------------------------------------
// S5: Google Business Profile, YouTube, a profile's own website
// ---------------------------------------------------------------------------

describe('normaliseGoogleBusiness', () => {
  const g = (s: string) => url(normaliseGoogleBusiness(s));
  it('accepts the Google share links and keeps one stored form', () => {
    expect(g('https://maps.app.goo.gl/AbCd1234XyZ')).toBe('https://maps.app.goo.gl/AbCd1234XyZ');
    expect(g('maps.app.goo.gl/AbCd1234?g_st=iw')).toBe('https://maps.app.goo.gl/AbCd1234');
    expect(g('https://g.page/amani-safaris')).toBe('https://g.page/amani-safaris');
    expect(g('https://g.page/amani-safaris/review?rc')).toBe('https://g.page/amani-safaris');
    expect(g('https://g.page/r/CQ1a2b3c4d5e6EAE/review')).toBe('https://g.page/r/CQ1a2b3c4d5e6EAE');
    expect(g('http://g.page/r/CQ1a2b3c4d5e6EAE/')).toBe('https://g.page/r/CQ1a2b3c4d5e6EAE');
    expect(g('https://www.google.com/maps/place/Amani+Safaris/@-3.3869,36.6830,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d-3.38!4d36.68?entry=ttu'))
      .toBe('https://www.google.com/maps/place/Amani+Safaris/@-3.3869,36.6830,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d-3.38!4d36.68');
    expect(g('https://maps.google.com/maps/place/Amani%20Lodge/')).toBe('https://www.google.com/maps/place/Amani%20Lodge');
    expect(g('google.com/maps/place/Moshi')).toBe('https://www.google.com/maps/place/Moshi');
    expect(g('https://business.google.com/n/12345/profile')).toBe('https://business.google.com/n/12345/profile');
    const r = normaliseGoogleBusiness('https://g.page/amani');
    expect(r.ok && r.handle).toBeNull();
  });
  it('refuses other short links, Google redirects and lookalikes', () => {
    expect(g('https://goo.gl/maps/abc123')).toBe('fail:host');
    expect(g('https://goo.gl/abc123')).toBe('fail:host');
    expect(g('https://bit.ly/abc123')).toBe('fail:host');
    expect(g('https://www.google.com/url?q=https://evil.com')).toBe('fail:handle');
    expect(g('https://www.google.com/amp/s/evil.com')).toBe('fail:handle');
    expect(g('https://www.google.com/search?q=amani')).toBe('fail:handle');
    expect(g('https://www.google.com/maps/place/../../url')).toBe('fail:handle');
    expect(g('https://www.google.com/maps/place/x/%2e%2e/%2e%2e/url')).toBe('fail:handle');
    expect(g('https://www.google.com/maps/place/')).toBe('fail:handle');
    // L1: no empty path segment after the host.
    expect(g('https://www.google.com/maps/place//evil.example')).toBe('fail:handle');
    expect(g('https://www.google.com/maps/place/a//b')).toBe('fail:handle');
    expect(g('https://business.google.com//evil.example')).toBe('fail:handle');
    expect(new RegExp(LINK_PATTERNS.googleBadPath).test('https://www.google.com//maps/place/x')).toBe(true);
    expect(g('https://www.google.co.tz/maps/place/Moshi')).toBe('fail:host');
    expect(g('https://google.com.evil.com/maps/place/x')).toBe('fail:host');
    expect(g('https://evil.com/g.page/x')).toBe('fail:host');
    expect(g('https://maps.app.goo.gl.evil.com/AbCd1234')).toBe('fail:host');
    expect(g('https://maps.app.goo.gl/')).toBe('fail:handle');
    expect(g('https://maps.app.goo.gl/a/b')).toBe('fail:handle');
    expect(g('https://g.page/')).toBe('fail:handle');
    expect(g('https://g.page/a/b/c')).toBe('fail:handle');
    expect(g('https://business.google.com/')).toBe('fail:handle');
    expect(g('https://business.google.com/a.b')).toBe('fail:handle');
    expect(g('https://user@g.page/amani')).toBe('fail:credentials');
    expect(g('https://g.page:8443/amani')).toBe('fail:port');
    expect(g('javascript:alert(1)')).toBe('fail:scheme');
    // A quote is encoded by the address parser, so it can never close the href.
    expect(g('https://www.google.com/maps/place/a"onmouseover=x')).toBe('https://www.google.com/maps/place/a%22onmouseover=x');
    expect(g("https://www.google.com/maps/place/Mama's")).toBe('fail:handle');
    expect(g('https://www.google.com/maps/place/a b')).toBe('fail:invalid');
    expect(g(`https://www.google.com/maps/place/${'a'.repeat(600)}`)).toBe('fail:too_long');
    expect(g('')).toBe('fail:empty');
  });
});

describe('normaliseYoutube', () => {
  const yt = (s: string) => url(normaliseYoutube(s));
  it('accepts channel links, @names and channel ids', () => {
    expect(yt('https://www.youtube.com/@AmaniSafaris')).toBe('https://www.youtube.com/@amanisafaris');
    expect(yt('youtube.com/@amani.tz/videos')).toBe('https://www.youtube.com/@amani.tz');
    expect(yt('https://m.youtube.com/@amani-tz/?si=abc')).toBe('https://www.youtube.com/@amani-tz');
    expect(yt('@amani_tz')).toBe('https://www.youtube.com/@amani_tz');
    expect(yt('amani_tz')).toBe('https://www.youtube.com/@amani_tz');
    expect(yt('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv')).toBe('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv');
    expect(yt('https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw/featured')).toBe('https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw');
    const r = normaliseYoutube('@amani_tz');
    expect(r.ok && r.handle).toBe('amani_tz');
  });
  it('refuses videos, old links, other hosts and bad names', () => {
    expect(yt('https://youtu.be/dQw4w9WgXcQ')).toBe('fail:host');
    expect(yt('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('fail:handle');
    expect(yt('https://www.youtube.com/c/amani')).toBe('fail:handle');
    expect(yt('https://www.youtube.com/user/amani')).toBe('fail:handle');
    expect(yt('https://www.youtube.com/@amani/watch')).toBe('fail:handle');
    expect(yt('https://www.youtube.com/@amani/videos/extra')).toBe('fail:handle');
    expect(yt('https://www.youtube.com/channel/UCshort')).toBe('fail:handle');
    expect(yt('https://www.youtube.com/channel/XXabcdefghijklmnopqrstuv')).toBe('fail:handle');
    expect(yt('https://www.youtube.com/redirect?q=https://evil.com')).toBe('fail:handle');
    expect(yt('http://www.youtube.com/@amani')).toBe('fail:scheme');
    expect(yt('https://youtube.com.evil.com/@amani')).toBe('fail:host');
    expect(yt('https://user@youtube.com/@amani')).toBe('fail:credentials');
    expect(yt('@ab')).toBe('fail:handle');
    expect(yt('@...')).toBe('fail:reserved');
    expect(yt('youtube.com')).toBe('fail:handle');
    expect(yt('a'.repeat(31))).toBe('fail:handle');
    expect(yt('')).toBe('fail:empty');
  });
});

describe('normaliseProfileWebsite', () => {
  const site = (s: string) => url(normaliseProfileWebsite(s));
  it('keeps own websites', () => {
    expect(site('amanisafaris.co.tz')).toBe('https://amanisafaris.co.tz/');
    expect(site('https://www.amani-tours.com/kilimanjaro')).toBe('https://www.amani-tours.com/kilimanjaro');
    expect(site('https://watchme.com/')).toBe('https://watchme.com/');
    expect(site('https://bitly.com.tz/')).toBe('https://bitly.com.tz/');
  });
  it('refuses chat links, short links and redirectors', () => {
    expect(site('https://wa.me/255700000000')).toBe('fail:blocked');
    expect(site('wa.me/255700000000')).toBe('fail:blocked');
    expect(site('https://api.whatsapp.com/send?phone=255700000000')).toBe('fail:blocked');
    expect(site('https://chat.whatsapp.com/AbC')).toBe('fail:blocked');
    expect(site('https://wa.link/abc')).toBe('fail:blocked');
    expect(site('https://t.me/amani')).toBe('fail:blocked');
    expect(site('https://telegram.me/amani')).toBe('fail:blocked');
    expect(site('https://bit.ly/abc')).toBe('fail:blocked');
    expect(site('https://TinyURL.com/abc')).toBe('fail:blocked');
    expect(site('https://goo.gl/abc')).toBe('fail:blocked');
    expect(site('https://t.co/abc')).toBe('fail:blocked');
    expect(site('https://l.facebook.com/l.php?u=https%3A%2F%2Fevil.com')).toBe('fail:blocked');
    expect(site('https://l.instagram.com/?u=https%3A%2F%2Fevil.com')).toBe('fail:blocked');
    expect(site('javascript:alert(1)')).toBe('fail:scheme');
  });
  it('refuses the hosts added after the security review (M1)', () => {
    const blocked = [
      'm.me', 'ig.me', 'signal.me', 'viber.me', 'invite.viber.com', 'wa.link',
      'linktr.ee', 'tr.ee', 'beacons.ai', 'bio.link', 'lnk.bio',
      't.ly', 's.id', 'bl.ink', 'j.mp', 'bitly.com', 'lnkd.in', 'fb.me', 'qrco.de', 'snip.ly', 'youtu.be',
      'facebook.com', 'www.facebook.com', 'm.facebook.com', 'business.facebook.com', 'instagram.com', 'www.instagram.com',
      'google.com', 'www.google.com', 'google.co.tz', 'maps.google.com', 'youtube.com', 'm.youtube.com', 'tiktok.com', 'vm.tiktok.com', 'g.page',
    ];
    for (const host of blocked) expect(site(`https://${host}/amani`), host).toBe('fail:blocked');
    expect(site('https://www.google.com/url?q=https://evil.example')).toBe('fail:blocked');
    expect(site('https://www.youtube.com/redirect?q=https://evil.example')).toBe('fail:blocked');
    // Names that only look like a blocked host are fine.
    expect(site('https://linktree-tours.co.tz/')).toBe('https://linktree-tours.co.tz/');
    expect(site('https://mytiktok.com.tz/')).toBe('https://mytiktok.com.tz/');
    expect(site('https://googlesafaris.com/')).toBe('https://googlesafaris.com/');
  });
  it('refuses a Tanzanian phone number anywhere in the address (L3, N5)', () => {
    expect(site('https://amani.co.tz/contact/255700000000')).toBe('fail:blocked');
    expect(site('https://amani.co.tz/?phone=+255700000000')).toBe('fail:blocked');
    expect(site('https://amani.co.tz/?phone=%2B255712345678')).toBe('fail:blocked');
    expect(site('https://amani.co.tz/call/0712345678')).toBe('fail:blocked');
    expect(site('https://amani.co.tz/call/0612345678')).toBe('fail:blocked');
    expect(site('https://amani.co.tz/call/0712-345-678')).toBe('fail:blocked');
    expect(site('https://amani.co.tz/call/+255.712.345.678')).toBe('fail:blocked');
    expect(site('https://amani.co.tz/call/255 712 345 678')).toBe('fail:invalid');
    expect(site('https://amani.co.tz/call/255%20712%20345%20678')).toBe('fail:blocked');
    expect(site('https://amani.co.tz/#0754123456')).toBe('fail:blocked');
    // Digits in the host count too.
    expect(site('https://0712345678.co.tz/')).toBe('fail:blocked');
    expect(site('https://call-255712345678.com/')).toBe('fail:blocked');
    // Wider separators and a 00 prefix.
    for (const path of ['0712_345_678', '0712/345/678', '(0712)345678', '0712%2D345%2D678', '0712%09345678', '00255712345678',
      '255-712--345-678', '0712.345_678', '%2B255%20712%20345%20678']) {
      expect(site(`https://amani.co.tz/call/${path}`), path).toBe('fail:blocked');
    }
  });
  it('allows booking, page and other long numbers (N5)', () => {
    expect(site('https://amani.co.tz/tours/2026/12345678')).toBe('https://amani.co.tz/tours/2026/12345678');
    expect(site('https://123456789.co.tz/')).toBe('https://123456789.co.tz/');
    expect(site('https://amani.co.tz/booking/123456789012')).toBe('https://amani.co.tz/booking/123456789012');
    expect(site('https://amani.co.tz/p/90712345678123')).toBe('https://amani.co.tz/p/90712345678123');
    expect(site('https://amani.co.tz/?id=0812345678')).toBe('https://amani.co.tz/?id=0812345678');
    expect(site('https://amani.co.tz/2026-07-12/')).toBe('https://amani.co.tz/2026-07-12/');
    expect(site('https://amani.co.tz/hotel/123456789')).toBe('https://amani.co.tz/hotel/123456789');
    expect(site('https://amani.co.tz/id/1234567890712')).toBe('https://amani.co.tz/id/1234567890712');
    expect(site('https://amani.co.tz/id/0712345678901')).toBe('https://amani.co.tz/id/0712345678901');
    expect(site('https://amani.co.tz/id/2557123456789')).toBe('https://amani.co.tz/id/2557123456789');  });
  it('refuses Messenger, Discord invites and whatsapp.net (N6)', () => {
    for (const url of ['https://www.messenger.com/t/amani', 'https://messenger.com/', 'https://m.me/amani', 'https://discord.gg/abc',
      'https://discord.com/invite/abc', 'https://www.discord.com/invite/abc', 'https://discordapp.com/invite/abc', 'https://web.whatsapp.net/x']) {
      expect(site(url), url).toBe('fail:blocked');
    }
    expect(site('https://discord.com/channels/1')).toBe('https://discord.com/channels/1');
  });
  it('marks punycode hosts (L2)', () => {
    expect(isPunycodeHost('xn--mnchen-3ya.de')).toBe(true);
    expect(isPunycodeHost('www.xn--80ak6aa92e.com')).toBe(true);
    expect(isPunycodeHost('amani.co.tz')).toBe(false);
    expect(isPunycodeHost('maxn--a.com')).toBe(false);
  });
});

describe('profile link kinds', () => {
  it('normaliseProfileLink uses the rules for each kind', () => {
    expect(url(normaliseProfileLink('instagram', '@amani'))).toBe('https://www.instagram.com/amani/');
    expect(url(normaliseProfileLink('google', 'https://g.page/amani'))).toBe('https://g.page/amani');
    expect(url(normaliseProfileLink('youtube', '@amani'))).toBe('https://www.youtube.com/@amani');
    expect(url(normaliseProfileLink('website', 'https://wa.me/1'))).toBe('fail:blocked');
  });
  it('every kind has a column, guides get the website, businesses do not', () => {
    for (const kind of GUIDE_LINK_KINDS) expect(PROFILE_LINK_COLUMNS[kind]).toBeTruthy();
    expect(GUIDE_LINK_KINDS).toContain('website');
    expect(BUSINESS_LINK_KINDS).not.toContain('website');
  });
  it('shownProfileLinks keeps valid stored links in order and drops bad ones', () => {
    const shown = shownProfileLinks(
      {
        website: 'https://amani.co.tz/',
        google_business_url: 'https://g.page/amani',
        youtube_url: 'https://evil.com/@amani',
        instagram_url: 'https://www.instagram.com/amani/',
        facebook_url: null,
        tiktok_url: 'javascript:alert(1)',
      },
      GUIDE_LINK_KINDS,
    );
    expect(shown.map((l) => l.kind)).toEqual(['website', 'google', 'instagram']);
    expect(shown[2]).toMatchObject({ url: 'https://www.instagram.com/amani/', handle: 'amani' });
    expect(shownProfileLinks({ website: 'https://wa.me/255700000000' }, ['website'])).toEqual([]);
    expect(shownProfileLinks(null, GUIDE_LINK_KINDS)).toEqual([]);
    expect(invalidProfileLinks({ youtube_url: 'https://evil.com/@amani', website: 'https://amani.co.tz/', tiktok_url: null }, GUIDE_LINK_KINDS))
      .toEqual([{ kind: 'youtube', value: 'https://evil.com/@amani' }]);
  });
});

describe('S5 stored links match the database patterns', () => {
  it('google, youtube and website outputs match', () => {
    for (const input of ['https://g.page/r/CQ1a2b3c4d5e6EAE', 'maps.app.goo.gl/Ab12', 'https://www.google.com/maps/place/A+B/@-3.1,36.2,17z', 'https://business.google.com/n/1/profile']) {
      const r = normaliseGoogleBusiness(input);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(new RegExp(LINK_PATTERNS.google).test(r.url)).toBe(true);
        expect(new RegExp(LINK_PATTERNS.googleBadPath).test(r.url)).toBe(false);
        expect(r.url.length).toBeLessThanOrEqual(600);
      }
    }
    for (const input of ['@abc', 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv', 'z'.repeat(30)]) {
      const r = normaliseYoutube(input);
      expect(r.ok).toBe(true);
      if (r.ok) expect(new RegExp(LINK_PATTERNS.youtube).test(r.url)).toBe(true);
    }
    for (const input of ['amani.co.tz', 'https://wa.me.example.com/']) {
      const r = normaliseProfileWebsite(input);
      expect(r.ok).toBe(true);
      if (r.ok) expect(new RegExp(LINK_PATTERNS.websiteBlocked).test(r.url)).toBe(false);
    }
  });

  it('the S5 migration uses the same patterns', () => {
    const sql = readFileSync(new URL('../../../supabase/migrations/20261126000200_profile_links.sql', import.meta.url), 'utf8');
    const body = sql.split('\n').filter((line) => !line.trimStart().startsWith('--')).join('\n');
    const count = (needle: string) => body.split(needle).length - 1;
    // Guides and providers each have the Google and YouTube checks.
    expect(count(`google_business_url ~ '${LINK_PATTERNS.google}'`)).toBe(2);
    expect(count(`google_business_url !~ '${LINK_PATTERNS.googleBadPath}'`)).toBe(2);
    expect(count(`youtube_url ~ '${LINK_PATTERNS.youtube}'`)).toBe(2);
    expect(count(`youtube_url !~ '${LINK_PATTERNS.youtubeReserved}'`)).toBe(2);
    expect(count('char_length(google_business_url) <= 600')).toBe(2);
    // The guide's website: the website form and the blocked hosts.
    // guides.website: the website form, the blocked hosts and the phone check, as a constraint.
    expect(count(`website ~ '${LINK_PATTERNS.website}'`)).toBe(1);
    expect(count(`  and website !~ '${LINK_PATTERNS.websiteBlocked}'`)).toBe(1);
    expect(count(`  and website !~ '${LINK_PATTERNS.websitePhoneLike}'`)).toBe(1);
    // providers.website (N3): providers_website_format is left alone; the same rules run in a trigger
    // only when the website is set or changed.
    expect(body).not.toContain('providers_website_format');
    expect(body).toContain(`if new.website ~ '${LINK_PATTERNS.websiteBlocked}'`);
    expect(body).toContain(`or new.website ~ '${LINK_PATTERNS.websitePhoneLike}'`);
    expect(body).toContain("new.website is not distinct from old.website");
    expect(body).toMatch(/before insert or update of website on public\.providers\s+for each row execute function private\.guard_provider_website\(\)/);
    // The read-only query in the header uses the same block and phone patterns.
    expect(sql).toContain(`website ~ '${LINK_PATTERNS.websiteBlocked}'`);
    expect(sql).toContain(`or website ~ '${LINK_PATTERNS.websitePhoneLike}'`);
    // Providers' social links: the guides' rules.
    expect(body).toContain(`instagram_url ~ '${LINK_PATTERNS.instagram}'`);
    expect(body).toContain(`instagram_url !~ '${LINK_PATTERNS.instagramReserved}'`);
    expect(body).toContain(`facebook_url ~ '${LINK_PATTERNS.facebook}'`);
    expect(body).toContain(`facebook_url !~ '${LINK_PATTERNS.facebookReserved}'`);
    expect(body).toContain(`tiktok_url ~ '${LINK_PATTERNS.tiktok}'`);
    expect(body).toContain(`tiktok_url !~ '${LINK_PATTERNS.tiktokReserved}'`);
    // The Maps place length in the pattern fits inside the 600-character limit.
    expect(LINK_PATTERNS.google).toContain('{1,560}');
  });
});

describe('profile link texts', () => {
  it('has traveller texts in all 7 languages', () => {
    for (const locale of LOCALES) {
      const t = profileLinksShownText(locale);
      for (const value of Object.values(t)) expect(value.length).toBeGreaterThan(0);
      expect(t.title).toContain('{name}');
      expect(t.website).toContain('{name}');
      if (locale !== 'en') expect(t.note).not.toBe(profileLinksShownText('en').note);
    }
    expect(profileLinkLabel('youtube', 'zh')).toBe('YouTube');
    expect(profileLinkLabel('website', 'sw')).toBe('Tovuti');
  });
  it('has guide and owner texts in English and Kiswahili with the same keys', () => {
    expect(Object.keys(PROFILE_LINKS_TEXT.sw).sort()).toEqual(Object.keys(PROFILE_LINKS_TEXT.en).sort());
    expect(profileLinksText('fr')).toBe(PROFILE_LINKS_TEXT.en);
    expect(profileLinksText('sw')).toBe(PROFILE_LINKS_TEXT.sw);
  });
  it('has a message for every error code', () => {
    for (const kind of GUIDE_LINK_KINDS) expect(profileLinkErrorMessage(profileLinkErrorCode(kind, 'handle'), 'en')).toBeTruthy();
    expect(profileLinkErrorCode('website', 'blocked')).toBe('pl_website_blocked');
    expect(profileLinkErrorMessage('pl_website_blocked', 'sw')).toContain('WhatsApp');
    expect(profileLinkErrorMessage('pl_instagram', 'en')).toContain('https://www.instagram.com/yourname');
    expect(profileLinkErrorMessage('other', 'en')).toBeNull();
    expect(profileLinkCheckMessage('youtube', 'handle', 'en')).toContain('https://www.youtube.com/@yourname');
  });
});
