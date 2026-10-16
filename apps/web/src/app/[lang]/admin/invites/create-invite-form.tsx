'use client';

import { useActionState } from 'react';
import { createInviteCode, type CreateInviteState } from './actions';

// Add a code. The code appears here once; after leaving the page only its label and uses are shown.
export function CreateInviteForm({ locale }: { locale: string }) {
  const [state, action, pending] = useActionState<CreateInviteState, FormData>(createInviteCode, null);
  return (
    <div className="card mt-6 space-y-4">
      <h2 className="text-xl font-bold">Add a code</h2>
      {state?.code && (
        <div role="status" className="rounded-[5px] bg-mint p-4 text-forest">
          <p className="text-sm font-semibold">New code{state.label ? ` for ${state.label}` : ''}. Copy it now: it will not be shown again.</p>
          <p className="mt-2 select-all font-mono text-2xl font-bold tracking-wider">{state.code}</p>
        </div>
      )}
      {state?.error && <p role="alert" className="rounded-[5px] bg-red-50 p-4 text-red-800">{state.error}</p>}
      <form action={action} className="grid gap-4 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-end">
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label className="label" htmlFor="invite-label">Who it is for</label>
          <input id="invite-label" name="label" className="field" maxLength={80} placeholder="e.g. Arusha guides, first group" />
        </div>
        <div>
          <label className="label" htmlFor="invite-max">Uses</label>
          <input id="invite-max" name="max_uses" className="field" inputMode="numeric" pattern="[0-9]*" placeholder="No limit" />
        </div>
        <div>
          <label className="label" htmlFor="invite-code">Own code (optional)</label>
          <input id="invite-code" name="code" className="field" minLength={10} maxLength={64} autoComplete="off" spellCheck={false} placeholder="Empty = random code" />
        </div>
        <button className="btn px-4 py-2" disabled={pending}>Add code</button>
      </form>
    </div>
  );
}
