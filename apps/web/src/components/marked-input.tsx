'use client';

import { useState, type ComponentProps } from 'react';
import { useKeepForm } from './keep-form';

// A text input inside a KeepForm that marks itself, with its own message under it, when the server
// refused the form with `errorCode` (for example a profile link that is already taken). The mark
// goes away as soon as the value is edited.
export function MarkedInput({ errorCode, message, id, onChange, ...props }: ComponentProps<'input'> & { id: string; errorCode: string; message: string }) {
  const { result } = useKeepForm();
  const [seen, setSeen] = useState(result);
  const [edited, setEdited] = useState(false);
  if (result !== seen) {
    setSeen(result);
    setEdited(false);
  }
  const marked = result?.error === errorCode && !edited;
  const errorId = `${id}-error`;
  return (
    <>
      <input
        {...props}
        id={id}
        onChange={(event) => {
          setEdited(true);
          onChange?.(event);
        }}
        aria-invalid={marked || undefined}
        aria-describedby={marked ? errorId : undefined}
      />
      {marked && <span id={errorId} className="mt-1 block text-sm font-semibold text-red-800">{message}</span>}
    </>
  );
}
