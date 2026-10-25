'use client';

import { useEffect, useRef, type ComponentProps } from 'react';
import { isReservedDisplayName } from '@kwetuly/shared';

// A name field that refuses names kept for the Kwetuly team in the browser, so the form is not sent
// and nothing typed is lost. The database checks the same rule again (error 'display_name_reserved').
// `allowReserved` is for admins, who may use such names.
export function NameInput({
  reservedMessage,
  allowReserved = false,
  onInput,
  ...props
}: ComponentProps<'input'> & { reservedMessage: string; allowReserved?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const check = (input: HTMLInputElement) =>
    input.setCustomValidity(!allowReserved && isReservedDisplayName(input.value) ? reservedMessage : '');

  // A name filled in before (e.g. from the profile) is checked too, not only what is typed.
  useEffect(() => {
    if (ref.current) check(ref.current);
  });

  return (
    <input
      {...props}
      ref={ref}
      onInput={(event) => {
        check(event.currentTarget);
        onInput?.(event);
      }}
    />
  );
}
