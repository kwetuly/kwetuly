'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// A confirmation such as "Request sent" that scrolls itself into view and takes focus when it
// appears, so people on a phone see it even when the form was far down the page.
export function InViewNote({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.focus({ preventScroll: true });
  }, []);
  return (
    <p ref={ref} tabIndex={-1} role="status" className={`outline-none ${className ?? ''}`}>
      {children}
    </p>
  );
}
