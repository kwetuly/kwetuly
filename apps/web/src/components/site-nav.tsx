'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { MENU } from '@rafrika/shared';
import type { Locale } from '@/i18n/config';
import { itemHref } from '@/lib/menu';
import { Icon } from './icon';

// Desktop: hover/focus mega-menus. Mobile: full-screen drawer with expandable sections.
export function SiteNav({ locale, soonLabel }: { locale: Locale; soonLabel: string }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <ul className="hidden items-center gap-1 lg:flex">
        {MENU.map((section) => (
          <li key={section.slug} className="group relative">
            <button
              type="button"
              className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-charcoal/80 transition hover:bg-sand hover:text-charcoal group-focus-within:bg-sand"
              aria-haspopup="true"
            >
              {section.label[locale]}
              <ChevronDown className="size-4 transition group-hover:rotate-180" aria-hidden />
            </button>
            <div className="invisible absolute left-1/2 top-full z-30 w-[22rem] -translate-x-1/2 translate-y-2 pt-3 opacity-0 transition duration-200 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
              <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-[0_24px_60px_-12px_rgba(10,31,23,0.25)]">
                <p className="bg-gradient-to-r from-night to-forest px-5 py-3 text-xs font-medium text-mint">
                  {section.tagline[locale]}
                </p>
                <ul className="p-2">
                  {section.items.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={itemHref(locale, section, item)}
                        className="flex items-start gap-3 rounded-2xl p-3 transition hover:bg-sand focus-visible:bg-sand"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sunset to-gold text-white shadow-sm">
                          <Icon name={item.icon} className="size-5" />
                        </span>
                        <span>
                          <span className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                            {item.label[locale]}
                            {item.status !== 'live' && (
                              <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-forest">
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
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-10 items-center justify-center rounded-full border border-line lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      {/* Portal to <body>: the header's backdrop blur would otherwise trap a fixed overlay inside it. */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 flex flex-col bg-night text-white lg:hidden" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-xl font-extrabold">Rafrika</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-10 items-center justify-center rounded-full bg-white/10"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 pb-10">
            {MENU.map((section) => {
              const isOpen = expanded === section.slug;
              return (
                <div key={section.slug} className="border-b border-white/10">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : section.slug)}
                    className="flex w-full items-center gap-3 py-4 text-left text-lg font-semibold"
                    aria-expanded={isOpen}
                  >
                    <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sunset to-gold">
                      <Icon name={section.icon} className="size-5" />
                    </span>
                    {section.label[locale]}
                    <ChevronDown className={`ml-auto size-5 transition ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                  </button>
                  {isOpen && (
                    <ul className="pb-4 pl-12">
                      {section.items.map((item) => (
                        <li key={item.slug}>
                          <Link
                            href={itemHref(locale, section, item)}
                            onClick={() => setOpen(false)}
                            className="block rounded-xl px-3 py-2.5 text-white/85 hover:bg-white/10"
                          >
                            {item.label[locale]}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>
        </div>,
          document.body,
        )}
    </>
  );
}
