'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { adminSecondStep, requireUser, type CurrentUser } from '@/lib/auth';
import { enabledSocialProviders, LINKING_ON } from '@/lib/auth-providers';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/site';
import { SIGNIN_NOTICE_COOKIE, signInNoticeCookieOptions, signSignInNotice, type SignInChange } from '@/lib/signin-notice';

/** Sign-ins people may connect themselves. Apple comes later, with the Apple Developer account. */
const LINKABLE = ['google', 'facebook'] as const;
/** Sign-ins people may remove. Email and phone stay: they are the account's own address and number. */
const REMOVABLE = ['google', 'facebook', 'apple'];

// Proof for the security page that this account just asked for this change (lib/signin-notice.ts).
async function rememberChange(userId: string, change: SignInChange, provider: string) {
  const value = signSignInNotice(userId, change, provider);
  if (value) (await cookies()).set(SIGNIN_NOTICE_COOKIE, value, signInNoticeCookieOptions);
}

function securityPath(locale: string, query: string) {
  return `/${locale}/security?${query}#sign-ins`;
}

// Admin accounts change their sign-ins only in a session that has passed two-step sign-in.
async function guardAdmin(user: CurrentUser, locale: string) {
  if (user.role === 'admin' && (await adminSecondStep()) !== 'ok') redirect(securityPath(locale, 'signin=admin'));
}

// "Connect Google / Facebook": adds that sign-in to the signed-in account (Supabase manual linking).
export async function linkSignIn(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await requireUser(locale);
  await guardAdmin(user, locale);
  if (!LINKING_ON) redirect(securityPath(locale, 'signin=off'));
  const provider = LINKABLE.find((p) => p === formData.get('provider'));
  if (!provider || !(await enabledSocialProviders()).includes(provider)) redirect(securityPath(locale, 'signin=error'));

  // From here on the page may report the result (connected, taken or an error).
  await rememberChange(user.id, 'linked', provider);
  const supabase = await createClient();
  // Back to this page through /auth/confirm, which finishes the link and shows "connected".
  const next = `/${locale}/security?signin=linked&provider=${provider}`;
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo: `${SITE_URL}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error?.code === 'manual_linking_disabled') redirect(securityPath(locale, 'signin=off'));
  if (error || !data.url) redirect(securityPath(locale, 'signin=error'));
  redirect(data.url);
}

// "Remove Google / Facebook": only while at least one other way to sign in remains.
export async function unlinkSignIn(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await requireUser(locale);
  await guardAdmin(user, locale);
  if (!LINKING_ON) redirect(securityPath(locale, 'signin=off'));
  const identityId = String(formData.get('identity_id') ?? '');

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error || !data) redirect(securityPath(locale, 'signin=error'));
  const identity = data.identities.find((i) => i.identity_id === identityId);
  if (!identity || !REMOVABLE.includes(identity.provider)) redirect(securityPath(locale, 'signin=error'));
  // From here on the page may report the result (removed, only one left or an error).
  await rememberChange(user.id, 'removed', identity.provider);
  if (data.identities.length < 2) redirect(securityPath(locale, 'signin=only'));

  const { error: unlinkError } = await supabase.auth.unlinkIdentity(identity);
  if (unlinkError?.code === 'manual_linking_disabled') redirect(securityPath(locale, 'signin=off'));
  if (unlinkError?.code === 'single_identity_not_deletable') redirect(securityPath(locale, 'signin=only'));
  if (unlinkError) redirect(securityPath(locale, 'signin=error'));
  // The session still lists the removed sign-in until it is refreshed.
  await supabase.auth.refreshSession();
  redirect(securityPath(locale, `signin=removed&provider=${identity.provider}`));
}

// Permanently deletes the signed-in person's account after they type their email address.
// Their uploaded files are removed first; the database then removes everything else.
export async function deleteAccount(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await requireUser(locale);
  const typed = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!user.email || typed !== user.email.toLowerCase()) redirect(`/${locale}/security?deleteError=1#delete`);

  const supabase = await createClient();
  const { data: files } = await supabase.rpc('my_uploaded_files');
  const byBucket = new Map<string, string[]>();
  for (const f of (files ?? []) as { bucket_id: string; name: string }[]) {
    byBucket.set(f.bucket_id, [...(byBucket.get(f.bucket_id) ?? []), f.name]);
  }
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += 100) await supabase.storage.from(bucket).remove(names.slice(i, i + 100));
  }

  const { error } = await supabase.rpc('delete_my_account');
  if (error) redirect(`/${locale}/security?deleteError=2#delete`);
  await supabase.auth.signOut();
  redirect(`/${locale}/login?deleted=1`);
}
