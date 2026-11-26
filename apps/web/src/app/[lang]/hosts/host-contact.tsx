'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { askHostContact, type HostContactState } from './actions';

export type HostContactLabels = { notGuide: string; askContact: string; sent: string; missing: string; openAccount: string; error: string };

// The next step for a signed-in traveller or business account on /hosts. After "sent" the button goes,
// so the same visit cannot send twice.
export function HostContact({ locale, accountHref, t }: { locale: string; accountHref: string; t: HostContactLabels }) {
  const [state, action] = useActionState<HostContactState, FormData>(askHostContact, null);
  return (
    <div className="card mt-6 space-y-3">
      <p>{t.notGuide}</p>
      {state === 'sent' ? (
        <p role="status" className="rounded-[5px] bg-mint p-4 font-semibold text-forest">{t.sent}</p>
      ) : state === 'missing' ? (
        <>
          <p role="alert" className="rounded-[5px] bg-red-50 p-4 text-red-800">{t.missing}</p>
          <Link href={accountHref} className="btn-outline inline-flex">{t.openAccount}</Link>
        </>
      ) : (
        <form action={action} className="space-y-3">
          {state === 'error' && <p role="alert" className="rounded-[5px] bg-red-50 p-4 text-red-800">{t.error}</p>}
          <input type="hidden" name="locale" value={locale} />
          <SubmitButton className="btn w-full sm:w-auto">{t.askContact}</SubmitButton>
        </form>
      )}
    </div>
  );
}
