'use client';

import Link from 'next/link';
import { useActionState, type ReactNode } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { signIn } from '../actions';

type Labels = { email: string; password: string; signIn: string; forgot: string; wrong: string; error: string };

// Email and password sign-in. A wrong password keeps the email that was typed.
// `notice` is the note from the link that brought people here (an expired email link, a deleted
// account); it gives way to the form's own error once they try to sign in.
export function LoginForm({ locale, labels, next, notice }: { locale: string; labels: Labels; next?: ReactNode; notice?: ReactNode }) {
  const [state, action] = useActionState(signIn, null);

  return (
    <form action={action} className="space-y-4">
      {!state && notice}
      {state && (
        <p role="alert" className="rounded-[5px] bg-red-50 p-4 text-red-800">
          {state.error === 'credentials' ? labels.wrong : labels.error}
        </p>
      )}
      <input type="hidden" name="locale" value={locale} />
      {next}
      <div>
        <label className="label" htmlFor="email">{labels.email}</label>
        <input
          className="field"
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          // React resets the form after the action; the default brings back the email that was typed.
          defaultValue={state?.email ?? ''}
          aria-invalid={state?.error === 'credentials' || undefined}
        />
      </div>
      <div>
        <label className="label" htmlFor="password">{labels.password}</label>
        <input
          className="field"
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={state?.error === 'credentials' || undefined}
        />
      </div>
      <SubmitButton className="btn w-full">{labels.signIn}</SubmitButton>
      <p className="text-sm">
        <Link href={`/${locale}/forgot-password`} className="font-semibold text-forest">{labels.forgot}</Link>
      </p>
    </form>
  );
}
