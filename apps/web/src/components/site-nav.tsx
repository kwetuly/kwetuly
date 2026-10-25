'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { MENU, UX_TEXT } from '@kwetuly/shared';
import type { Locale } from '@/i18n/config';
import { itemHref } from '@/lib/menu';
import { Icon } from './icon';
import { Logo } from './logo';

// Desktop: hover/focus mega-menus. Mobile: full-screen drawer with expandable sections.
// `account` (mobile only) holds the sign-in / account links that do not fit in the phone header.
export function SiteNav({ locale, soonLabel, account }: { locale: Locale; soonLabel: string; account?: ReactNode }) {
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
      <ul className="hidden items-center gap-0.5 whitespace-nowrap xl:flex">
        {MENU.map((section) =>
          section.items.length === 1 ? (
            <li key={section.slug}>
              <Link
                href={itemHref(locale, section, section.items[0])}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-[5px] px-3 py-2 text-sm font-semibold text-charcoal/80 transition hover:bg-sand hover:text-charcoal"
              >
                <Icon name={section.icon} className="size-4 text-leaf-dark" />
                {section.label[locale]}
              </Link>
            </li>
          ) : (
          <li key={section.slug} className="group relative">
            <button
              type="button"
              className="flex items-center gap-1 whitespace-nowrap rounded-[5px] px-3 py-2 text-sm font-semibold text-charcoal/80 transition hover:bg-sand hover:text-charcoal group-focus-within:bg-sand"
              aria-haspopup="true"
            >
              {section.label[locale]}
              <ChevronDown className="size-4 transition group-hover:rotate-180" aria-hidden />
            </button>
            <div className={`invisible absolute top-full z-30 ${section.items.length > 6 ? 'left-0 w-[42rem]' : 'left-1/2 w-[22rem] -translate-x-1/2'} translate-y-2 pt-3 opacity-0 transition duration-200 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100`}>
              <div className="overflow-hidden rounded-[5px] border border-line bg-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.25)]">
                <p className="bg-night px-5 py-3 text-xs font-semibold text-white">
                  {section.tagline[locale]}
                </p>
                <ul className={`p-2 ${section.items.length > 6 ? 'grid grid-cols-2' : ''}`}>
                  {section.items.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={itemHref(locale, section, item)}
                        className="flex items-start gap-3 rounded-[5px] p-3 transition hover:bg-sand focus-visible:bg-sand"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-[5px] bg-leaf shadow-sm">
                          <Icon name={item.icon} className="size-5 text-white" />
                        </span>
                        <span>
                          <span className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                            {item.label[locale]}
                            {item.status !== 'live' && (
                              <span className="rounded-[5px] bg-mint px-2 py-0.5 text-[11px] font-bold text-forest">
                                {soonLabel}
                              </span>
                            )}
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
          ),
        )}
      </ul>

      <button
        ref={menuButton}
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-10 shrink-0 items-center justify-center rounded-[5px] border border-line xl:hidden"
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
          className="fixed inset-0 z-50 flex flex-col bg-night text-white xl:hidden"
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
