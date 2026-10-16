import type { Dictionary } from '@/i18n/dictionaries';

// Invite code input for the invite-only soft launch. Shown only while the invite_only site setting is on;
// the code itself is checked by the database (handle_new_user and complete_onboarding).
export function InviteCodeField({ t, invalid }: { t: Dictionary; invalid: boolean }) {
  return (
    <div>
      <label className="label" htmlFor="invite_code">{t.auth.inviteCode}</label>
      <input
        className="field"
        id="invite_code"
        name="invite_code"
        required
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={200}
        aria-describedby={invalid ? 'invite_code-error invite_code-hint' : 'invite_code-hint'}
        aria-invalid={invalid || undefined}
        autoFocus={invalid}
      />
      {invalid && <p id="invite_code-error" role="alert" className="mt-1 text-sm font-semibold text-red-800">{t.auth.inviteError}</p>}
      <p id="invite_code-hint" className="mt-1 text-xs text-muted">{t.auth.inviteHint}</p>
    </div>
  );
}
