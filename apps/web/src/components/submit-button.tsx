'use client';

import { useParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import type { ComponentProps } from 'react';
import { UX_TEXT } from '@kwetuly/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { useKeepForm } from './keep-form';

// A form's submit button that turns into a disabled "Sending…" while the server action runs, so
// people on a slow connection see that their tap worked and do not send the form twice. The button
// keeps its width while sending (the label is laid over the hidden normal text), so nothing jumps.
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  className,
  ...props
}: ComponentProps<'button'> & { pendingLabel?: string }) {
  const status = useFormStatus();
  const keep = useKeepForm();
  const pending = status.pending || keep.pending;
  const { lang } = useParams<{ lang?: string }>();
  const locale = lang && hasLocale(lang) ? lang : defaultLocale;
  return (
    <button type="submit" {...props} className={`relative ${className ?? ''}`} disabled={disabled || pending} aria-disabled={disabled || pending}>
      {/* inline-flex (not display: contents) so the label always gives the button its accessible name. */}
      <span className={`inline-flex items-center justify-center gap-2 ${pending ? 'invisible' : ''}`} aria-hidden={pending || undefined}>
        {children}
      </span>
      {pending && <span className="absolute inset-0 flex items-center justify-center whitespace-nowrap">{pendingLabel ?? UX_TEXT[locale].sending}</span>}
    </button>
  );
}
