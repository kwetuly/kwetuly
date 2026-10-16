'use client';

import { useParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import type { ComponentProps } from 'react';
import { UX_TEXT } from '@rafrika/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';

// A form's submit button that turns into a disabled "Sending…" while the server action runs, so
// people on a slow connection see that their tap worked and do not send the form twice.
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: ComponentProps<'button'> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  const { lang } = useParams<{ lang?: string }>();
  const locale = lang && hasLocale(lang) ? lang : defaultLocale;
  return (
    <button type="submit" {...props} disabled={disabled || pending} aria-disabled={disabled || pending}>
      {pending ? (pendingLabel ?? UX_TEXT[locale].sending) : children}
    </button>
  );
}
