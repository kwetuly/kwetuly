'use client';

import { useEffect, useRef, useState } from 'react';
import { normaliseProfileLink, profileLinkCheckMessage, profileLinkErrorCode, profileLinkFieldLabel, profileLinkHint, type ProfileLinkKind } from '@kwetuly/shared';
import { useKeepForm } from '@/components/keep-form';

// One link field on the links page. It checks itself when it is left, with the same shared rules the
// server and the database use, so a wrong link is fixed before saving. The saved value shown unchanged
// is never blocked (it already passed the database check). The server checks everything again.
export function LinkField({
  kind,
  name,
  formId,
  locale,
  defaultValue,
  disabled,
}: {
  kind: ProfileLinkKind;
  name: string;
  formId: string;
  locale: string;
  defaultValue?: string | null;
  disabled?: boolean;
}) {
  const start = defaultValue ?? '';
  const [value, setValue] = useState(start);
  const [checked, setChecked] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { result } = useKeepForm();
  const id = `${formId}-${kind}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const trimmed = value.trim();
  const parsed = trimmed && trimmed !== start.trim() ? normaliseProfileLink(kind, trimmed) : null;
  const ok = !parsed || parsed.ok;
  const message = profileLinkCheckMessage(kind, parsed && !parsed.ok ? parsed.reason : null, locale);
  // The server refused this field (its error code came back): mark it too.
  const refused = !!result && (result.error === `pl_${kind}` || (kind === 'website' && result.error === profileLinkErrorCode('website', 'blocked')));
  const showError = (checked && !ok) || refused;

  // The browser's own form check stops a link we already know the server would refuse.
  useEffect(() => {
    input.current?.setCustomValidity(ok ? '' : message);
  }, [ok, message]);

  return (
    <div>
      <label htmlFor={id} className="label">{profileLinkFieldLabel(kind, locale)}</label>
      <input
        ref={input}
        className="field"
        id={id}
        name={name}
        type="text"
        inputMode="url"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        maxLength={kind === 'google' ? 2000 : 300}
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => setChecked(true)}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? `${hintId} ${errorId}` : hintId}
      />
      <p id={hintId} className="mt-1 text-xs text-muted">{profileLinkHint(kind, locale)}</p>
      {checked && !ok && (
        <p id={errorId} role="alert" className="mt-1 text-sm font-semibold text-red-800">{message}</p>
      )}
    </div>
  );
}
