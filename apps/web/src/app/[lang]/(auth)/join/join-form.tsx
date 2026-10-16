'use client';

import { useActionState } from 'react';
import { Briefcase, Compass, Plane } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import { InviteCodeField } from '@/components/invite-code-field';
import { SubmitButton } from '@/components/submit-button';
import { signUp } from '../actions';

const roles = [
  { id: 'traveler', Icon: Plane },
  { id: 'guide', Icon: Compass },
  { id: 'provider', Icon: Briefcase },
] as const;

export type JoinLabels = {
  auth: Pick<
    Dictionary['auth'],
    'welcomeRole' | 'fullName' | 'phone' | 'phoneHint' | 'email' | 'password' | 'createAccount' | 'error' | 'phoneError' | 'inviteCode' | 'inviteError' | 'inviteHint'
  >;
  join: Pick<Dictionary['join'], 'traveler' | 'guide' | 'provider'>;
};

// Email sign-up. A refused sign-up (wrong invite code, bad phone number) keeps the account type,
// name, phone and email that were typed; the password and invite code are typed again.
export function JoinForm({
  locale,
  selected,
  invite,
  initialError,
  t,
}: {
  locale: string;
  selected: string;
  invite: boolean;
  initialError: string | null;
  t: JoinLabels;
}) {
  const [state, action] = useActionState(signUp, null);
  const error = state?.error ?? initialError;
  const role = state?.role ?? selected;

  return (
    <form action={action} className="space-y-5">
      {error && error !== 'invite' && (
        <p role="alert" className="rounded-[5px] bg-red-50 p-4 text-red-800">{error === 'phone' ? t.auth.phoneError : t.auth.error}</p>
      )}
      <input type="hidden" name="locale" value={locale} />
      {invite && <InviteCodeField key={state ? 'retry' : 'first'} t={t} invalid={error === 'invite'} />}
      <fieldset>
        <legend className="label">{t.auth.welcomeRole}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {roles.map(({ id, Icon }) => (
            <label key={id} className="cursor-pointer">
              <input
                type="radio"
                name="role"
                value={id}
                defaultChecked={role === id}
                className="peer sr-only"
                aria-labelledby={`role-${id}-title`}
                aria-describedby={`role-${id}-body`}
              />
              <span className="flex h-full flex-col gap-2 rounded-[5px] border-2 border-line p-4 transition peer-checked:border-leaf peer-checked:bg-sand peer-focus-visible:ring-4 peer-focus-visible:ring-forest">
                <Icon className="size-6 text-leaf-dark" aria-hidden />
                <span id={`role-${id}-title`} className="font-bold">{t.join[id].title}</span>
                <span id={`role-${id}-body`} className="text-xs text-muted">{t.join[id].body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="full_name">{t.auth.fullName}</label>
        {/* React resets the form after the action; the defaults bring back what was typed. */}
        <input className="field" id="full_name" name="full_name" required autoComplete="name" defaultValue={state?.fullName ?? ''} />
      </div>
      <div>
        <label className="label" htmlFor="phone">{t.auth.phone}</label>
        <input
          className="field"
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          inputMode="tel"
          placeholder="+255 712 345 678"
          aria-describedby="phone-hint"
          aria-invalid={error === 'phone' || undefined}
          defaultValue={state?.phone ?? ''}
        />
        <p id="phone-hint" className="mt-1 text-xs text-muted">{t.auth.phoneHint}</p>
      </div>
      <div>
        <label className="label" htmlFor="email">{t.auth.email}</label>
        <input className="field" id="email" name="email" type="email" required autoComplete="email" defaultValue={state?.email ?? ''} />
      </div>
      <div>
        <label className="label" htmlFor="password">{t.auth.password}</label>
        <input className="field" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      <SubmitButton className="btn w-full">{t.auth.createAccount}</SubmitButton>
    </form>
  );
}
