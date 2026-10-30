'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import {
  normalizePhone,
  phoneCountries,
  phoneCountryOrDefault,
  phoneExample,
  searchPhoneCountries,
  splitPhone,
  type Dictionary,
} from '@kwetuly/shared';

type PhoneText = Dictionary['phone'];

// Phone number with a searchable country picker (Tanzania first). People type the number the way
// they know it, with or without the first 0; the server turns `phone` + `phone_country` into one
// international number with the same shared normalizePhone, so browser and server agree.
export function PhoneField({
  id,
  label,
  locale,
  t,
  defaultValue,
  defaultCountry,
  name = 'phone',
  countryName = 'phone_country',
  required = false,
  invalid = false,
  maxLength = 40,
}: {
  id: string;
  label: string;
  locale: string;
  t: PhoneText;
  /** A saved international number (+255…) or what was typed before. */
  defaultValue?: string | null;
  /** Used when the saved number does not say its country (geo hint, then Tanzania). */
  defaultCountry?: string | null;
  name?: string;
  countryName?: string;
  required?: boolean;
  /** The server refused the number. */
  invalid?: boolean;
  maxLength?: number;
}) {
  const start = useMemo(() => splitPhone(defaultValue, phoneCountryOrDefault(defaultCountry)), [defaultValue, defaultCountry]);
  const [country, setCountry] = useState<string>(start.country);
  const [value, setValue] = useState(start.national);
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const uid = useId();
  const listId = `${uid}-list`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const countries = useMemo(() => phoneCountries(locale), [locale]);
  const matches = useMemo(() => searchPhoneCountries(countries, query), [countries, query]);
  const current = countries.find((c) => c.code === country) ?? countries[0];
  const example = phoneExample(country);

  // A saved number shown unchanged is never flagged or blocked: the server keeps it as it was.
  const unchanged = country === start.country && value.trim() === start.national.trim();
  const wrong = !unchanged && value.trim() !== '' && normalizePhone(value, country) === null;
  // Checked on leaving the field (and again while correcting it), never while typing the first time.
  const looksWrong = checked && wrong;
  const showError = looksWrong || (invalid && !checked);
  const message = looksWrong ? t.invalid.replace('{country}', current.name) : t.invalidGeneric;

  // The browser's own form check stops a number we already know is wrong.
  useEffect(() => {
    input.current?.setCustomValidity(wrong ? t.invalid.replace('{country}', current.name) : '');
  }, [wrong, current.name, t.invalid]);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    function onPointer(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function openPicker() {
    setQuery('');
    setActive(Math.max(0, countries.findIndex((c) => c.code === country)));
    setOpen(true);
  }

  function choose(code: string) {
    setCountry(code);
    setOpen(false);
    input.current?.focus();
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(matches.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (matches[active]) choose(matches[active].code);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      button.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapper} className="relative">
      <label className="label" htmlFor={id}>{label}</label>
      <input type="hidden" name={countryName} value={country} />
      <div className="flex gap-2">
        <button
          ref={button}
          type="button"
          onClick={() => (open ? setOpen(false) : openPicker())}
          className="flex shrink-0 items-center gap-1.5 rounded-[5px] border border-line bg-white px-3 py-3 text-base font-semibold transition hover:bg-sand"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={t.chooseCountry.replace('{country}', `${current.name} ${current.dial}`)}
        >
          <span aria-hidden>{current.flag}</span>
          <span>{current.dial}</span>
          <ChevronDown className={`size-4 text-muted transition ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        <input
          ref={input}
          className="field min-w-0 flex-1"
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
          maxLength={maxLength}
          placeholder={example}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => setChecked(true)}
          aria-describedby={showError ? `${errorId} ${hintId}` : hintId}
          aria-invalid={showError || undefined}
        />
      </div>
      {showError && (
        <p id={errorId} role="alert" className="mt-1 text-sm font-semibold text-red-800">{message}</p>
      )}
      <p id={hintId} className="mt-1 text-xs text-muted">
        {current.name} {current.dial}. {example && t.example.replace('{example}', example)}
      </p>

      {open && (
        <div className="absolute inset-x-0 z-40 mt-1 overflow-hidden rounded-[5px] border border-line bg-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.25)]">
          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              ref={search}
              type="search"
              className="field"
              // .field sets its own padding; room on the left for the search icon.
              style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem', paddingLeft: '2.25rem' }}
              role="combobox"
              aria-label={t.search}
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={matches[active] ? `${uid}-${matches[active].code}` : undefined}
              placeholder={t.search}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onSearchKey}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <ul ref={list} id={listId} role="listbox" aria-label={t.country} className="max-h-72 overflow-y-auto p-1">
            {matches.length === 0 && <li className="px-3 py-3 text-sm text-muted">{t.noMatch}</li>}
            {matches.map((c, index) => (
              <li
                key={c.code}
                id={`${uid}-${c.code}`}
                data-index={index}
                role="option"
                aria-selected={c.code === country}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(c.code)}
                onMouseMove={() => setActive(index)}
                className={`flex cursor-pointer items-center gap-3 rounded-[5px] px-3 py-2.5 text-sm ${index === active ? 'bg-sand outline outline-2 outline-leaf-dark' : ''} ${c.code === country ? 'font-semibold text-forest' : ''}`}
              >
                <span aria-hidden className="text-lg leading-none">{c.flag}</span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="shrink-0 text-muted">{c.dial}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
