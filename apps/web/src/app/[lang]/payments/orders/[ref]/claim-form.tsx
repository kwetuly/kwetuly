'use client';

import { useActionState, useState } from 'react';
import { LIPA_NETWORKS, type LipaNetwork, type LipaPayText } from '@kwetuly/shared';
import { SubmitButton } from '@/components/submit-button';
import { submitClaimState, type ClaimState } from '../../lipa-actions';

// "I have paid": keeps what was typed after a refusal (QA 7). The phone is required for mobile
// networks and optional for a bank payment; it starts with the profile phone when there is one.
export function ClaimForm({ locale, reference, t, networkNames, defaultNetwork, profilePhone }: {
  locale: string;
  reference: string;
  t: LipaPayText;
  networkNames: Record<LipaNetwork, string>;
  defaultNetwork: LipaNetwork;
  profilePhone: string;
}) {
  const [state, action] = useActionState<ClaimState, FormData>(submitClaimState, { error: null, network: defaultNetwork, tx: '', phone: profilePhone });
  const [network, setNetwork] = useState<LipaNetwork>(state.network);
  const error = state.error ? (Object.hasOwn(t.errors, state.error) ? t.errors[state.error] : t.errors.failed) : '';
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="reference" value={reference} />
      {error && <p role="alert" className="rounded-[5px] bg-red-50 p-3 font-semibold text-red-800">{error}</p>}
      <label className="block">
        <span className="mb-1 block font-semibold">{t.network}</span>
        <select name="network" required className="field" value={network} onChange={(e) => setNetwork(e.target.value as LipaNetwork)}>
          {LIPA_NETWORKS.map((n) => <option key={n} value={n}>{networkNames[n]}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block font-semibold">{t.transactionId}</span>
        <input name="transaction_id" required minLength={6} maxLength={40} defaultValue={state.tx} autoComplete="off" autoCapitalize="characters" spellCheck={false} className="field font-mono" aria-describedby="tx-hint" />
        <span id="tx-hint" className="mt-1 block text-sm text-muted">{t.transactionHint}</span>
      </label>
      <label className="block">
        <span className="mb-1 block font-semibold">{t.phone}</span>
        <input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} required={network !== 'bank'} defaultValue={state.phone} className="field" aria-describedby="phone-hint" />
        <span id="phone-hint" className="mt-1 block text-sm text-muted">{t.phoneHint}</span>
      </label>
      <SubmitButton className="btn w-full">{t.submit}</SubmitButton>
    </form>
  );
}
