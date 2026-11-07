'use client';

import { useMemo, useState } from 'react';
import { BILLING_PATTERN, billingCountries, type PayMethod } from '@kwetuly/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { useKeepForm } from './keep-form';

type Props = {
  methods: PayMethod[];
  p: Dictionary['payments'];
  locale: Locale;
  dark?: boolean;
};

// The choice between mobile money and card (only the ways the Edge Function offers right now, same
// amount for both), and for card the billing address Selcom needs. Kwetuly does not store the address:
// it is not put in localStorage, the URL, analytics or logs, and is sent once with the checkout. The
// browser's own autofill may still offer to save it, because the fields carry autocomplete attributes.
export function PayMethodFields({ methods, p, locale, dark }: Props) {
  const { result } = useKeepForm();
  const [method, setMethod] = useState<PayMethod>(methods.includes('mobile_money') ? 'mobile_money' : methods[0] ?? 'mobile_money');
  const countries = useMemo(() => billingCountries(locale), [locale]);
  const choice = methods.length > 1;
  const cardOn = method === 'card';
  const billingError = result?.error === 'billing_required' || result?.error === 'billing_chars';

  const tile = (value: PayMethod, label: string) => {
    const on = method === value;
    return (
      <label
        className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[5px] border-2 px-4 py-3 font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 ${
          on ? 'border-forest bg-mint text-forest' : dark ? 'border-white/40 text-white hover:border-white' : 'border-line bg-white text-charcoal hover:border-forest'
        } ${dark ? 'has-[:focus-visible]:outline-white' : 'has-[:focus-visible]:outline-leaf-dark'}`}
      >
        <input type="radio" name="method" value={value} checked={on} onChange={() => setMethod(value)} className="size-4 accent-forest" />
        {label}
      </label>
    );
  };

  const field = (name: string, label: string, max: number, opts: { required?: boolean; autoComplete?: string } = {}) => (
    <label className="block">
      <span className="label">{label}</span>
      <input
        name={`billing_${name}`}
        className="field text-charcoal"
        maxLength={max}
        required={opts.required ?? true}
        autoComplete={opts.autoComplete}
        pattern={BILLING_PATTERN}
        title={p.billingChars}
        aria-invalid={billingError || undefined}
      />
    </label>
  );

  return (
    <>
      {choice ? (
        <fieldset className="space-y-2">
          <legend className="label">{p.method}</legend>
          <div className="grid grid-cols-2 gap-2">
            {tile('mobile_money', p.mobileMoney)}
            {tile('card', p.card)}
          </div>
          <p className="text-xs opacity-80">{p.sameAmount}</p>
        </fieldset>
      ) : (
        <input type="hidden" name="method" value={method} />
      )}

      {cardOn && (
        <fieldset className="space-y-3">
          <legend className="font-bold">{p.billingTitle}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {field('firstname', p.firstName, 60, { autoComplete: 'billing given-name' })}
            {field('lastname', p.lastName, 60, { autoComplete: 'billing family-name' })}
          </div>
          {field('address_1', p.address1, 100, { autoComplete: 'billing address-line1' })}
          {field('address_2', p.address2, 100, { required: false, autoComplete: 'billing address-line2' })}
          <div className="grid gap-3 sm:grid-cols-2">
            {field('city', p.city, 60, { autoComplete: 'billing address-level2' })}
            {field('state_or_region', p.region, 60, { autoComplete: 'billing address-level1' })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field('postcode_or_pobox', p.postcode, 20, { autoComplete: 'billing postal-code' })}
            <label className="block">
              <span className="label">{p.country}</span>
              <select name="billing_country" className="field text-charcoal" required defaultValue="" autoComplete="billing country">
                <option value="" disabled>
                  {p.chooseCountry}
                </option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-sm opacity-80">{p.cardNote}</p>
        </fieldset>
      )}
    </>
  );
}
