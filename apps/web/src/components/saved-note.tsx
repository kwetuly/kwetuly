'use client';

import { useEffect, useState, type ReactNode } from 'react';

// A "Saved" note that fades out as soon as anything on the page is edited again, so an old
// confirmation never sits next to changes that are not saved yet. It keeps its space while hidden,
// so the form below does not jump.
export function SavedNote({ children, className }: { children: ReactNode; className?: string }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    if (!shown) return;
    const hide = () => setShown(false);
    document.addEventListener('input', hide, { once: true });
    document.addEventListener('change', hide, { once: true });
    return () => {
      document.removeEventListener('input', hide);
      document.removeEventListener('change', hide);
    };
  }, [shown]);
  return (
    <p role="status" aria-hidden={!shown || undefined} className={`${className ?? ''} transition-[opacity,visibility] duration-300 ${shown ? 'opacity-100' : 'invisible opacity-0'}`}>
      {children}
    </p>
  );
}
