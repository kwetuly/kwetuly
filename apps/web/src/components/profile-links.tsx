import { Globe } from 'lucide-react';
import { USER_LINK_REL, isPunycodeHost, profileLinkLabel, profileLinksShownText, type ShownProfileLink } from '@kwetuly/shared';

// Links a guide (or later a business) added to their page (slice S5). Every link is user content:
// rel={USER_LINK_REL} (nofollow ugc, no opener, no referrer) and a new tab. The links passed in come
// from shownProfileLinks(), which cleans each stored value again and leaves out anything invalid.

/** "Find {name} online": the profile links in the About part of the page, with the platform and the @name or host. */
export function ProfileLinks({ links, name, locale, className }: { links: ShownProfileLink[]; name: string; locale: string; className?: string }) {
  if (links.length === 0) return null;
  const t = profileLinksShownText(locale);
  return (
    <section className={className ?? 'mt-8'} aria-labelledby="profile-links-title">
      <h2 id="profile-links-title" className="text-lg font-semibold">{t.title.replace('{name}', () => name)}</h2>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {links.map((link) => (
          <li key={link.kind}>
            <a className="text-forest underline" href={link.url} rel={USER_LINK_REL} target="_blank">
              {profileLinkLabel(link.kind, locale)}
              {link.handle ? (
                <span className="ml-1 font-semibold">@{link.handle}</span>
              ) : link.kind === 'website' ? (
                <span className="ml-1 font-semibold">{link.host}</span>
              ) : null}
              {isPunycodeHost(link.host) && <span className="ml-1 text-xs text-muted">{t.punycode}</span>}
              <span className="sr-only"> {t.newTab}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">{t.note}</p>
    </section>
  );
}

/** The guide's own website as a small link below the "Ask {name}" box. */
export function ProfileWebsite({ link, name, locale }: { link: ShownProfileLink | undefined; name: string; locale: string }) {
  if (!link || link.kind !== 'website') return null;
  const t = profileLinksShownText(locale);
  return (
    <p className="text-sm">
      <a className="inline-flex items-center gap-1.5 text-forest underline" href={link.url} rel={USER_LINK_REL} target="_blank">
        <Globe className="size-4 shrink-0" aria-hidden />
        <span>
          {t.website.replace('{name}', () => name)}: <span className="font-semibold">{link.host}</span>
          {/* A punycode host is shown as it is, with a note, so a lookalike address is noticed (review L2). */}
          {isPunycodeHost(link.host) && <span className="ml-1 text-xs text-muted">{t.punycode}</span>}
        </span>
        <span className="sr-only"> {t.newTab}</span>
      </a>
    </p>
  );
}
