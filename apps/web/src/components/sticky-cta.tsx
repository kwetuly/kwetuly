'use client';

import { useEffect, useState } from 'react';

/**
 * Phones only: keeps the page's main action at the bottom of the screen, and hides it while
 * the form it points to is already on screen.
 */
export function StickyCta({ target, label, track }: { target: string; label: string; track: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const el = document.getElementById(target);
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div
      data-sticky-cta
      aria-hidden={hidden}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 backdrop-blur transition-transform lg:hidden ${hidden ? 'translate-y-full' : ''}`}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <a href={`#${target}`} data-track={track} tabIndex={hidden ? -1 : undefined} className="btn w-full">
        {label}
      </a>
    </div>
  );
}
