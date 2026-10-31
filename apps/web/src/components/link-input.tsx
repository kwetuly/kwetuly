'use client';

import { useEffect, useRef, useState } from 'react';
import { SOCIAL_EXAMPLES, SOCIAL_NAMES, linkCheckText, normaliseSocial, normaliseWebsite, type SocialPlatform } from '@kwetuly/shared';

// A saved social profile is shown as @handle (easier to read and check), but only when that
// @handle cleans back to exactly the saved link; anything else is shown as saved.
function shownValue(kind: SocialPlatform | 'website', saved: string | null | undefined): string {
  const value = saved ?? '';
  if (!value || kind === 'website') return value;
  const parsed = normaliseSocial(kind, value);
  if (!parsed.ok || !parsed.handle) return value;
  const handle = `@${parsed.handle}`;
  const back = normaliseSocial(kind, handle);
  return back.ok && back.url === parsed.url ? handle : value;
}

// A profile link or website field that checks itself when it is left, with the same shared rules
// the server uses, so a wrong link is fixed before saving instead of after. The saved value shown
// unchanged is never blocked (it already passed the database check).
export function LinkInput({
  id,
  name,
  kind,
  locale,
  defaultValue,
  placeholder,
}: {
  id: string;
  name: string;
  kind: SocialPlatform | 'website';
  locale: string;
  defaultValue?: string | null;
  placeholder?: string;
}) {
  const start = shownValue(kind, defaultValue);
  const [value, setValue] = useState(start);
  const [checked, setChecked] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const text = linkCheckText(locale);
  const trimmed = value.trim();
  const ok = !trimmed || trimmed === start.trim() || (kind === 'website' ? normaliseWebsite(trimmed) : normaliseSocial(kind, trimmed)).ok;
  const message =
    kind === 'website' ? text.websiteCheck : text.socialCheck.replace('{platform}', SOCIAL_NAMES[kind]).replace('{example}', SOCIAL_EXAMPLES[kind]);
  const errorId = `${id}-error`;

  // The browser's own form check stops a link we already know the server would refuse.
  useEffect(() => {
    input.current?.setCustomValidity(ok ? '' : message);
  }, [ok, message]);

  return (
    <>
      <input
        ref={input}
        className="field"
        id={id}
        name={name}
        inputMode="url"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={300}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => setChecked(true)}
        aria-invalid={(checked && !ok) || undefined}
        aria-describedby={checked && !ok ? errorId : undefined}
      />
      {checked && !ok && (
        <span id={errorId} role="alert" className="mt-1 block text-sm font-semibold text-red-800">{message}</span>
      )}
    </>
  );
}
