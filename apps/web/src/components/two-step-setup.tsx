'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import type { UX_TEXT } from '@rafrika/shared';
import { createClient } from '@/lib/supabase/client';

type Labels = (typeof UX_TEXT)['en'];
type Setup = { factorId: string; qr: string; secret: string };

/** Turns two-step sign-in (authenticator app codes, Supabase TOTP) on or off for this account. */
export function TwoStepSetup({ enabled, labels }: { enabled: boolean; labels: Labels }) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function start() {
    setBusy(true);
    setError('');
    const supabase = createClient();
    // Remove half-finished setups first, so a new code can be created.
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const f of factors?.all ?? []) {
      if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Rafrika' });
    setBusy(false);
    if (enrollError || !data) return setError(labels.errorBody);
    setSetup({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!setup) return;
    setBusy(true);
    setError('');
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId: setup.factorId, code: code.replace(/\s/g, '') });
    setBusy(false);
    if (verifyError) return setError(labels.codeError);
    setSetup(null);
    router.refresh();
  }

  async function turnOff() {
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const f of factors?.totp ?? []) {
      const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: f.id });
      if (removeError) {
        setBusy(false);
        return setError(labels.turnOffNote);
      }
    }
    // Drop the now-unneeded second-step level from the session.
    await supabase.auth.refreshSession();
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="card space-y-4" aria-labelledby="two-step-title">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[5px] bg-leaf text-white">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id="two-step-title" className="text-lg font-bold">{labels.twoStepTitle}</h2>
          <p className="mt-1 text-sm text-muted">{labels.twoStepBody}</p>
        </div>
      </div>

      <p className={`rounded-[5px] p-3 text-sm font-semibold ${enabled ? 'bg-mint text-forest' : 'bg-surface text-charcoal'}`}>
        {enabled ? `✓ ${labels.twoStepOn}` : labels.twoStepOff}
      </p>

      {error && <p role="alert" className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {enabled ? (
        <button type="button" onClick={turnOff} disabled={busy} className="btn-outline">{labels.turnOff}</button>
      ) : setup ? (
        <form onSubmit={confirm} className="space-y-4">
          <p className="text-sm">{labels.scanQr}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns the QR code as an SVG data URL */}
          <img src={setup.qr} alt="" width={180} height={180} className="rounded-[5px] border border-line bg-white p-2" />
          <p className="text-sm">
            <span className="font-semibold">{labels.setupKey}: </span>
            <code className="break-all rounded-[5px] bg-surface px-2 py-1 font-mono text-xs">{setup.secret}</code>
          </p>
          <div>
            <label className="label" htmlFor="totp-code">{labels.code}</label>
            <input
              id="totp-code"
              className="field max-w-48 text-center text-xl tracking-[0.3em] tabular-nums"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              maxLength={7}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn" disabled={busy}>{labels.confirmCode}</button>
            <button type="button" className="btn-outline" onClick={() => setSetup(null)}>{labels.cancel}</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={start} disabled={busy} className="btn">{labels.turnOn}</button>
      )}
    </section>
  );
}
