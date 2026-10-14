'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';

// Guides and trips this visitor opened lately, kept only in their own browser (nothing is sent
// anywhere). The home page shows them so people can pick up where they left off.

export type RecentItem = { href: string; title: string; subtitle?: string; image?: string | null };

const KEY = 'rafrika:recent';
const MAX = 6;
const listeners = new Set<() => void>();

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

function write(items: RecentItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Private mode or storage blocked: the feature just stays empty.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener('storage', notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener('storage', notify);
  };
}

function parse(raw: string): RecentItem[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((i) => typeof i?.href === 'string' && typeof i?.title === 'string') : [];
  } catch {
    return [];
  }
}

/** Put on a guide or trip page to remember the visit. Renders nothing. */
export function TrackView({ item }: { item: RecentItem }) {
  useEffect(() => {
    const items = parse(read()).filter((i) => i.href !== item.href);
    write([item, ...items].slice(0, MAX));
  }, [item]);
  return null;
}

/** "Pick up where you left off": hidden until the visitor has opened something. */
export function RecentlyViewed({ title, clearLabel }: { title: string; clearLabel: string }) {
  const raw = useSyncExternalStore(subscribe, read, () => '[]');
  const items = useMemo(() => parse(raw), [raw]);
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-12">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
        <button type="button" onClick={() => write([])} className="text-sm font-semibold text-muted hover:text-charcoal">
          {clearLabel}
        </button>
      </div>
      <ul className="mt-5 flex snap-x gap-4 overflow-x-auto pb-2">
        {items.map((item) => (
          <li key={item.href} className="w-64 shrink-0 snap-start">
            <Link href={item.href} className="group flex items-center gap-3 rounded-[5px] border border-line bg-white p-3 transition hover:border-leaf">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt="" className="size-14 shrink-0 rounded-[5px] object-cover" />
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded-[5px] bg-mint text-xl font-bold text-forest" aria-hidden>
                  {item.title.charAt(0)}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate font-bold group-hover:text-leaf">{item.title}</span>
                {item.subtitle && <span className="block truncate text-sm text-muted">{item.subtitle}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
