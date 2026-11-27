'use client';

import { Printer } from 'lucide-react';

// Prints the booking link page with its QR code (buttons are hidden on paper).
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-outline px-4 py-2 text-sm print:hidden">
      <Printer className="size-4" aria-hidden /> {label}
    </button>
  );
}
