'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

// Copies a short value (payment code, Lipa number). Safe to fail: older browsers just do nothing.
export function CopyButton({ value, label, done }: { value: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-[5px] border border-line bg-white px-2 py-1 text-sm font-semibold text-forest hover:bg-mint"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked: the value stays on screen to copy by hand.
        }
      }}
      aria-label={`${label}: ${value}`}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  );
}
