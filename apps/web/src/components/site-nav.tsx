'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type RefObject, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { MENU, MENU_TEXT, UX_TEXT, type MenuSection } from '@kwetuly/shared';
import type { Locale } from '@/i18n/config';
import { itemHref } from '@/lib/menu';
import { Icon } from './icon';
import { Logo } from './logo';

// Phones and tablets (below 1024px): a full-screen drawer with expandable sections. The desktop row
// is DesktopNav below. `account` holds the sign-in / account links that do not fit in the phone header.
export function SiteNav({ locale, account }: { locale: Locale; account?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const ux = UX_TEXT[locale];

  // Opening moves focus into the drawer; closing hands it back to the menu button, so keyboard and
  // screen-reader users keep their place.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) closeButton.current?.focus();
    else if (wasOpen.current) menuButton.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // Esc closes the drawer; Tab and Shift+Tab stay inside it while it is open.
  function onDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key !== 'Tab' || !dialog.current) return;
    const focusable = Array.from(
      dialog.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => el.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button
        ref={menuButton}
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-10 shrink-0 items-center justify-center rounded-[5px] border border-line lg:hidden"
        aria-label={ux.openMenu}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {/* Portal to <body>: the header's backdrop blur would otherwise trap a fixed overlay inside it. */}
      {open &&
        createPortal(
        <div
          ref={dialog}
          className="fixed inset-0 z-50 flex flex-col bg-night text-white lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={ux.menuLabel}
          onKeyDown={onDialogKeyDown}
        >
          <CloseOnNavigate onNavigate={setOpen} />
          <div className="flex items-center justify-between px-4 py-4">
            <Logo tone="light" className="text-2xl" />
            <button
              ref={closeButton}
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-10 items-center justify-center rounded-[5px] bg-white/10"
              aria-label={ux.closeMenu}
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 pb-10">
            {MENU.map((section) => {
              const isOpen = expanded === section.slug;
              if (section.items.length === 1)
                return (
                  <div key={section.slug} className="border-b border-white/10">
                    <Link
                      href={itemHref(locale, section, section.items[0])}
                      onClick={() => setOpen(false)}
                      className="flex w-full items-center gap-3 py-4 text-lg font-semibold"
                    >
                      <span className="flex size-9 items-center justify-center rounded-[5px] bg-leaf text-white">
                        <Icon name={section.icon} className="size-5" />
                      </span>
                      {section.label[locale]}
                    </Link>
                  </div>
                );
              return (
                <div key={section.slug} className="border-b border-white/10">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : section.slug)}
                    className="flex w-full items-center gap-3 py-4 text-left text-lg font-semibold"
                    aria-expanded={isOpen}
                  >
                    <span className="flex size-9 items-center justify-center rounded-[5px] bg-leaf text-white">
                      <Icon name={section.icon} className="size-5" />
                    </span>
                    {section.label[locale]}
                    <ChevronDown className={`ml-auto size-5 transition ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                  </button>
                  {isOpen && (
                    <ul className="pb-4 pl-9">
                      {section.items.map((item) => (
                        <li key={item.slug}>
                          <Link
                            href={itemHref(locale, section, item)}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 rounded-[5px] px-3 py-2.5 text-white hover:bg-white/15"
                          >
                            <Icon name={item.icon} className="size-4 shrink-0" />
                            {item.label[locale]}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            {account && (
              <div
                className="mt-2"
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('a')) setOpen(false);
                }}
              >
                {account}
              </div>
            )}
          </nav>
        </div>,
          document.body,
        )}
    </>
  );
}

// Closes the open drawer after any navigation, including a sign-out redirect. Only mounted while the
// drawer is open (never during prerendering), so reading the pathname does not block the header.
function CloseOnNavigate({ onNavigate }: { onNavigate: (open: boolean) => void }) {
  const pathname = usePathname();
  const openedAt = useRef(pathname);
  useEffect(() => {
    if (pathname !== openedAt.current) onNavigate(false);
  }, [pathname, onNavigate]);
  return null;
}

const TRIGGER =
  'flex items-center gap-1.5 whitespace-nowrap rounded-[5px] px-3 py-2 text-sm font-semibold text-charcoal/80 transition hover:bg-sand hover:text-charcoal';
const GAP = 2; // gap-0.5 between the triggers
const PANEL = 'overflow-hidden rounded-[5px] border border-line bg-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.25)]';
// Panels wrap their text (the row itself never wraps). Open or closed comes from DesktopNav's one
// `openId`, so only one menu is ever open, whether by hover, focus or tap.
const panelClass = (open: boolean) =>
  `absolute top-full z-30 whitespace-normal pt-3 transition duration-200 ${open ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-2 opacity-0'}`;

type Dropdown = {
  open: boolean;
  /** Pointer, focus, blur and tap handlers for the menu's <li>, and its button's props. */
  item: {
    onPointerEnter: () => void;
    onPointerLeave: () => void;
    onFocus: () => void;
    onBlur: (event: FocusEvent<HTMLLIElement>) => void;
    onClick: (event: MouseEvent<HTMLLIElement>) => void;
  };
  button: { onClick: () => void; 'aria-expanded': boolean };
};

function useDropdowns(row: RefObject<HTMLDivElement | null>) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Set while Escape hands focus back to the menu's button, so that focus does not reopen it.
  const closingByEscape = useRef(false);

  // One Escape press closes the open menu wherever focus is, and focus returns to its button when
  // it was inside the menu.
  useEffect(() => {
    if (openId === null) return;
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      const button = row.current?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
      const focusInside = !!button?.parentElement?.contains(document.activeElement);
      setOpenId(null);
      if (button && focusInside && document.activeElement !== button) {
        closingByEscape.current = true;
        button.focus();
        closingByEscape.current = false;
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openId, row]);

  return (id: string): Dropdown => {
    const close = () => setOpenId((current) => (current === id ? null : current));
    return {
      open: openId === id,
      item: {
        onPointerEnter: () => setOpenId(id),
        onPointerLeave: close,
        onFocus: () => {
          if (!closingByEscape.current) setOpenId(id);
        },
        onBlur: (event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
        },
        // Following a link inside the menu closes it (the header stays on the next page).
        onClick: (event) => {
          if ((event.target as HTMLElement).closest('a')) setOpenId(null);
        },
      },
      // A click or tap opens (it also focuses, so toggling here would shut it straight away); Escape,
      // moving away or focus leaving closes it.
      button: { onClick: () => setOpenId(id), 'aria-expanded': openId === id },
    };
  };
}

// useLayoutEffect warns on the server; there the row is simply not measured yet.
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// Desktop (1024px and wider): one row of sections with hover/focus mega-menus. The row measures
// itself, and the sections that do not fit (narrower screens, long German or Polish labels) move
// under "More" at the end, so nothing overlaps or is cut off in any language. Until it has been
// measured (server render, first paint) the row is clipped sideways so nothing spills over the page.
export function DesktopNav({ locale, soonLabel }: { locale: Locale; soonLabel: string }) {
  const row = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLUListElement>(null);
  const [fit, setFit] = useState<number | null>(null);
  const dropdown = useDropdowns(row);
  const text = MENU_TEXT[locale];

  useBrowserLayoutEffect(() => {
    const container = row.current;
    const measure = ruler.current;
    if (!container || !measure) return;
    function update() {
      if (!container || !measure) return;
      const available = container.clientWidth;
      if (available === 0) return;
      const widths = Array.from(measure.children).map((el) => el.getBoundingClientRect().width);
      const more = widths.pop() ?? 0;
      let used = 0;
      let count = 0;
      for (let i = 0; i < widths.length; i++) {
        const next = used + (i > 0 ? GAP : 0) + widths[i];
        const needsMore = i < widths.length - 1;
        if (next + (needsMore ? GAP + more : 0) > available) break;
        used = next;
        count = i + 1;
      }
      setFit(count);
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    document.fonts?.ready.then(update).catch(() => {});
    return () => observer.disconnect();
  }, [locale]);

  const shown = fit ?? MENU.length;

  return (
    <div ref={row} className={`relative ${fit === null ? 'overflow-x-clip' : ''}`}>
      <ul className="flex items-center gap-0.5 whitespace-nowrap">
        {MENU.slice(0, shown).map((section, index) => (
          <SectionMenu
            key={section.slug}
            section={section}
            locale={locale}
            soonLabel={soonLabel}
            // Menus in the left half open to the right, the others to the left, so none leaves the page.
            align={index < (shown + 1) / 2 ? 'left' : 'right'}
            dropdown={dropdown(section.slug)}
          />
        ))}
        {shown < MENU.length && (
          <MoreMenu sections={MENU.slice(shown)} locale={locale} soonLabel={soonLabel} label={text.more} dropdown={dropdown('more')} />
        )}
      </ul>

      {/* Invisible copy of every trigger plus "More", only to measure their widths. The zero-size
          box around it keeps it from widening the page. */}
      <div aria-hidden className="pointer-events-none invisible absolute left-0 top-0 size-0 overflow-hidden">
        <ul ref={ruler} className="flex w-max gap-0.5 whitespace-nowrap">
          {MENU.map((section) => (
            <li key={section.slug} className={TRIGGER}>
              {section.items.length === 1 && <Icon name={section.icon} className="size-4" />}
              {section.label[locale]}
              {section.items.length > 1 && <ChevronDown className="size-4" />}
            </li>
          ))}
          <li className={TRIGGER}>
            {text.more}
            <ChevronDown className="size-4" />
          </li>
        </ul>
      </div>
    </div>
  );
}

function SectionMenu({ section, locale, soonLabel, align, dropdown }: { section: MenuSection; locale: Locale; soonLabel: string; align: 'left' | 'right'; dropdown: Dropdown }) {
  if (section.items.length === 1)
    return (
      <li>
        <Link href={itemHref(locale, section, section.items[0])} className={TRIGGER}>
          <Icon name={section.icon} className="size-4 text-leaf-dark" />
          {section.label[locale]}
        </Link>
      </li>
    );
  // Wide menus hang from the whole row (its left edge), so they never run off the page wherever
  // their section sits; narrow ones hang from their own button.
  const wide = section.items.length > 6;
  return (
    <li className={wide ? undefined : 'relative'} {...dropdown.item}>
      <button type="button" className={`${TRIGGER} gap-1 ${dropdown.open ? 'bg-sand text-charcoal' : ''}`} aria-haspopup="true" {...dropdown.button}>
        {section.label[locale]}
        <ChevronDown className={`size-4 transition ${dropdown.open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <div className={`${panelClass(dropdown.open)} ${wide ? 'left-0 w-[min(42rem,100%)]' : `${align === 'left' ? 'left-0' : 'right-0'} w-[22rem]`}`}>
        <div className={PANEL}>
          <p className="bg-night px-5 py-3 text-xs font-semibold text-white">{section.tagline[locale]}</p>
          <ul className={`p-2 ${wide ? 'grid grid-cols-2' : ''}`}>
            {section.items.map((item) => (
              <li key={item.slug}>
                <Link href={itemHref(locale, section, item)} className="flex items-start gap-3 rounded-[5px] p-3 transition hover:bg-sand focus-visible:bg-sand">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[5px] bg-leaf shadow-sm">
                    <Icon name={item.icon} className="size-5 text-white" />
                  </span>
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                      {item.label[locale]}
                      {item.status !== 'live' && <span className="rounded-[5px] bg-mint px-2 py-0.5 text-[11px] font-bold text-forest">{soonLabel}</span>}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{item.blurb[locale]}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}

// The sections that did not fit, each with its own links, in one panel that scrolls when long.
function MoreMenu({ sections, locale, soonLabel, label, dropdown }: { sections: MenuSection[]; locale: Locale; soonLabel: string; label: string; dropdown: Dropdown }) {
  return (
    <li className="relative" {...dropdown.item}>
      <button type="button" className={`${TRIGGER} gap-1 ${dropdown.open ? 'bg-sand text-charcoal' : ''}`} aria-haspopup="true" {...dropdown.button}>
        {label}
        <ChevronDown className={`size-4 transition ${dropdown.open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <div className={`${panelClass(dropdown.open)} right-0 w-[min(24rem,calc(100vw-2rem))]`}>
        <div className={`${PANEL} max-h-[calc(100vh-9rem)] overflow-y-auto p-2`}>
          {sections.map((section) => (
            <div key={section.slug} className="border-b border-line py-1 last:border-b-0">
              <p className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-charcoal">
                <span className="flex size-6 items-center justify-center rounded-[5px] bg-leaf">
                  <Icon name={section.icon} className="size-3.5 text-white" />
                </span>
                {section.label[locale]}
              </p>
              <ul>
                {section.items.map((item) => (
                  <li key={item.slug}>
                    <Link
                      href={itemHref(locale, section, item)}
                      className="flex items-center gap-2 rounded-[5px] py-2 pl-11 pr-3 text-sm text-charcoal/90 transition hover:bg-sand focus-visible:bg-sand"
                    >
                      {item.label[locale]}
                      {item.status !== 'live' && <span className="rounded-[5px] bg-mint px-2 py-0.5 text-[11px] font-bold text-forest">{soonLabel}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </li>
  );
}
