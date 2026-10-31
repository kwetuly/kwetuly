import { KeyRound, Mail } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { enabledSocialProviders, LINKING_ON, SOCIAL_PROVIDERS, type SocialProvider } from '@/lib/auth-providers';
import { SIGN_INS_TEXT } from '@kwetuly/shared';
import { createClient } from '@/lib/supabase/server';
import { linkSignIn, unlinkSignIn } from '@/app/[lang]/security/actions';
import { PROVIDER_NAMES, ProviderMark } from '@/components/social-sign-in';
import { SubmitButton } from '@/components/submit-button';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';

/** Sign-ins people may connect themselves (Apple comes later). */
const LINKABLE: SocialProvider[] = ['google', 'facebook'];
const REMOVABLE = ['google', 'facebook', 'apple'];
// Admin area texts are English only, like the rest of /admin.
const ADMIN_NOTE = 'Admin accounts change sign-ins only in a session that has passed two-step sign-in. Turn it on above, then sign in again.';

type Status = Record<string, string | string[] | undefined>;

function isSocial(value: unknown): value is SocialProvider {
  return typeof value === 'string' && (SOCIAL_PROVIDERS as readonly string[]).includes(value);
}

function providerName(provider: string, t: Dictionary): string {
  if (provider === 'email') return t.ux.signInEmail;
  if (provider === 'phone') return t.ux.signInPhone;
  if (isSocial(provider)) return PROVIDER_NAMES[provider];
  return provider === 'x' || provider === 'twitter' ? 'X' : provider.charAt(0).toUpperCase() + provider.slice(1);
}

// "Connected sign-ins" on the security page: the ways into this account, connect Google or Facebook,
// and remove one while another way in remains. Results come back as ?signin=... from the actions.
export async function ConnectedSignIns({
  t,
  locale,
  status,
  locked,
  recentChange,
}: {
  t: Dictionary;
  locale: Locale;
  status: Status;
  locked: boolean;
  /** The change this account just asked for, proven by the signed cookie from linkSignIn / unlinkSignIn (lib/signin-notice.ts). */
  recentChange: { change: 'linked' | 'removed'; provider: string } | null;
}) {
  const u = t.ux;
  const supabase = await createClient();
  const [{ data, error }, enabled] = await Promise.all([supabase.auth.getUserIdentities(), enabledSocialProviders()]);
  const identities = data?.identities ?? [];
  const connected = new Set(identities.map((i) => i.provider));
  const canConnect = LINKABLE.filter((p) => enabled.includes(p) && !connected.has(p));
  const canRemove = identities.length > 1;

  // Success notes only while linking is on, when this account just asked for the change (signed
  // cookie) and the account really shows it, so an old or hand-made link never claims anything.
  const asked = isSocial(status.provider) ? status.provider : null;
  const named = (text: string) => text.replace('{provider}', asked ? PROVIDER_NAMES[asked] : '');
  const proven = (change: 'linked' | 'removed') => LINKING_ON && !error && asked !== null && recentChange?.change === change && recentChange.provider === asked;
  const linkedOk = proven('linked') && asked !== null && connected.has(asked);
  const removedOk = proven('removed') && asked !== null && !connected.has(asked);
  // "Taken" and "error" also only follow a real attempt from this account.
  const attempted = LINKING_ON && recentChange !== null;
  // While linking is off, the line under the list already says so; no second "not available" note.
  const offShownBelow = !locked && !LINKING_ON;
  const notice =
    status.signin === 'linked' && linkedOk ? { ok: true, text: named(u.signInLinked) }
    : status.signin === 'removed' && removedOk ? { ok: true, text: named(u.signInRemoved) }
    : status.signin === 'taken' && asked && proven('linked') ? { ok: false, text: named(u.signInTaken) }
    : status.signin === 'off' && !offShownBelow ? { ok: false, text: u.signInLinkingOff }
    : status.signin === 'only' && LINKING_ON ? { ok: false, text: u.signInOnlyOne }
    : status.signin === 'admin' && locked ? { ok: false, text: ADMIN_NOTE }
    : status.signin === 'error' && attempted ? { ok: false, text: u.signInChangeError }
    : null;

  return (
    <section id="sign-ins" className="card scroll-mt-28 space-y-4" aria-labelledby="sign-ins-title">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[5px] bg-mint text-forest">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id="sign-ins-title" className="text-lg font-bold">{u.signInsTitle}</h2>
          {/* "Connect another one" only while connecting is switched on. */}
          <p className="mt-1 text-sm text-muted">{LINKING_ON ? u.signInsBody : SIGN_INS_TEXT[locale].bodyNoLinking}</p>
        </div>
      </div>

      {notice && (
        <p role={notice.ok ? 'status' : 'alert'} className={`rounded-[5px] p-3 text-sm ${notice.ok ? 'bg-mint font-semibold text-forest' : 'bg-red-50 text-red-800'}`}>
          {notice.text}
        </p>
      )}

      {error ? (
        <p role="alert" className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{u.signInLoadError}</p>
      ) : (
        <ul className="divide-y divide-line rounded-[5px] border border-line">
          {identities.map((identity) => {
            const name = providerName(identity.provider, t);
            const removable = REMOVABLE.includes(identity.provider);
            return (
              <li key={identity.identity_id} className="flex flex-wrap items-center gap-3 p-3">
                {isSocial(identity.provider) ? <ProviderMark provider={identity.provider} /> : <Mail className="size-5 text-muted" aria-hidden />}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{name}</span>
                  {typeof identity.identity_data?.email === 'string' && <span className="block truncate text-sm text-muted">{identity.identity_data.email}</span>}
                </span>
                <span className="badge">{u.signInConnected}</span>
                {removable && canRemove && !locked && LINKING_ON && (
                  <form action={unlinkSignIn}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="identity_id" value={identity.identity_id} />
                    <ConfirmSubmitButton confirmText={u.signInRemoveConfirm.replace('{provider}', name)} className="btn-outline px-4 py-2 text-sm">
                      {u.signInRemove.replace('{provider}', name)}
                    </ConfirmSubmitButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* "Connect another one first" only makes sense while connecting is possible. */}
      {!error && LINKING_ON && !canRemove && identities.length === 1 && <p className="text-sm text-muted">{u.signInOnlyOne}</p>}

      {!error && (locked ? (
        status.signin !== 'admin' && <p className="text-sm text-muted">{ADMIN_NOTE}</p>
      ) : !LINKING_ON ? (
        // Manual linking is switched off in Supabase until NEXT_PUBLIC_LINKING_ON=1 is set.
        <p className="text-sm text-muted">{u.signInLinkingOff}</p>
      ) : canConnect.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {canConnect.map((provider) => (
            <form key={provider} action={linkSignIn}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="provider" value={provider} />
              <SubmitButton className="inline-flex items-center gap-2 rounded-[5px] border-2 border-line bg-white px-4 py-2.5 font-semibold text-charcoal transition hover:border-charcoal">
                <ProviderMark provider={provider} /> {u.signInConnect.replace('{provider}', PROVIDER_NAMES[provider])}
              </SubmitButton>
            </form>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">{u.signInNoMore}</p>
      ))}
    </section>
  );
}
