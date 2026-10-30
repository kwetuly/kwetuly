'use client';

import type { ComponentProps } from 'react';
import { SubmitButton } from '@/components/submit-button';

// A submit button that asks once ("Remove Google? ...") before the form is sent.
export function ConfirmSubmitButton({ confirmText, ...props }: ComponentProps<typeof SubmitButton> & { confirmText: string }) {
  return (
    <SubmitButton
      {...props}
      onClick={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
    />
  );
}
