'use server';

import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { SOCIAL_PROVIDERS, type SocialProvider } from '@/lib/auth-providers';
import { inviteCodeAccepted } from '@/lib/invite';
import { normalizePhone } from '@/lib/phone';
import { safeLocalPath } from '@/lib/safe-next';
import { SITE_URL } from '@/lib/site';

function localeFrom(formData: FormData) {
  const value = String(formData.get('locale') ?? '');
  return hasLocale(value) ? value : defaultLocale;
}

const SIGNUP_ROLES = ['traveler', 'guide', 'provider'] as const;

export async function signUp(formData: FormData) {
  const locale = localeFrom(formData);
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();
  const roleValue = String(formData.get('role') ?? '');
  const role = (SIGNUP_ROLES as readonly string[]).includes(roleValue) ? roleValue : 'traveler';
  const phone = normalizePhone(String(formData.get('phone') ?? ''));

  // Invite-only soft launch: a valid code is needed while SIGNUP_INVITE_CODES is set.
  if (!inviteCodeAccepted(formData.get('invite_code'))) redirect(`/${locale}/join?role=${role}&error=invite`);
  if (!phone) redirect(`/${locale}/join?role=${role}&error=phone`);
  if (!email || password.length < 8 || !fullName) redirect(`/${locale}/join?role=${role}&error=1`);

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role, phone, preferred_language: locale },
      emailRedirectTo: `${SITE_URL}/auth/confirm?next=/${locale}/dashboard`,
    },
  });

  if (error) redirect(`/${locale}/join?role=${role}&error=1`);
  redirect(`/${locale}/join?role=${role}&sent=1`);
}

// "Continue with Google / Facebook / Apple". After the provider sends people back, new accounts
// land on the welcome step to pick their account type and add a phone number.
export async function signInWithProvider(formData: FormData) {
  const locale = localeFrom(formData);
  const providerValue = String(formData.get('provider') ?? '');
  if (!(SOCIAL_PROVIDERS as readonly string[]).includes(providerValue)) redirect(`/${locale}/login?error=1`);
  const roleValue = String(formData.get('role') ?? '');
  const role = (SIGNUP_ROLES as readonly string[]).includes(roleValue) ? roleValue : '';

  const next = `/${locale}/welcome${role ? `?role=${role}` : ''}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: providerValue as SocialProvider,
    options: { redirectTo: `${SITE_URL}/auth/confirm?next=${encodeURIComponent(next)}` },
  });

  if (error || !data.url) redirect(`/${locale}/login?error=1`);
  redirect(data.url);
}

// The welcome step for social sign-ups: account type, name and phone number.
export async function completeOnboarding(formData: FormData) {
  const locale = localeFrom(formData);
  const roleValue = String(formData.get('role') ?? '');
  const role = (SIGNUP_ROLES as readonly string[]).includes(roleValue) ? roleValue : 'traveler';
  const phone = normalizePhone(String(formData.get('phone') ?? ''));
  // New social accounts land here before they can use Rafrika (requireUser sends them back until
  // onboarding is done), so the invite code is checked here too. Existing accounts never see this step.
  if (!inviteCodeAccepted(formData.get('invite_code'))) redirect(`/${locale}/welcome?role=${role}&error=invite`);
  if (!phone) redirect(`/${locale}/welcome?role=${role}&error=phone`);

  const supabase = await createClient();
  const { error } = await supabase.rpc('complete_onboarding', {
    p_role: role,
    p_phone: phone,
    p_full_name: String(formData.get('full_name') ?? '').trim().slice(0, 120),
  });
  if (error) redirect(`/${locale}/welcome?role=${role}&error=1`);

  // New guides go straight to their profile editor.
  redirect(`/${locale}/dashboard${role === 'guide' ? '?as=guide' : ''}`);
}

export async function signIn(formData: FormData) {
  const locale = localeFrom(formData);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  });

  if (error) redirect(`/${locale}/login?error=1`);
  // Return to where the person was going (e.g. a group chat invite), but only within this site.
  const next = safeNext(locale, formData.get('next'));
  // Accounts with two-step sign-in still need their authenticator code.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') redirect(`/${locale}/login/verify?next=${encodeURIComponent(next)}`);
  redirect(next);
}

function safeNext(locale: string, value: FormDataEntryValue | null) {
  const next = safeLocalPath(value, `/${locale}/dashboard`);
  return next.startsWith(`/${locale}/`) ? next : `/${locale}/dashboard`;
}

// Second sign-in step: the 6-digit code from the person's authenticator app.
export async function verifySignInCode(formData: FormData) {
  const locale = localeFrom(formData);
  const next = safeNext(locale, formData.get('next'));
  const code = String(formData.get('code') ?? '').replace(/\s/g, '');
  const back = `/${locale}/login/verify?next=${encodeURIComponent(next)}`;
  if (!/^\d{6}$/.test(code)) redirect(`${back}&error=1`);

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === 'verified');
  if (!factor) redirect(next);
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) redirect(`${back}&error=1`);
  redirect(next);
}

export async function signOut(formData: FormData) {
  const locale = localeFrom(formData);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}

// "Forgot password?": email a reset link. The reply is the same whether or not an account exists,
// so the form cannot be used to find out who has an account.
export async function requestPasswordReset(formData: FormData) {
  const locale = localeFrom(formData);
  const email = String(formData.get('email') ?? '').trim().slice(0, 320);
  const back = `/${locale}/forgot-password`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect(`${back}?error=email`);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/auth/confirm?next=${encodeURIComponent(`/${locale}/reset-password`)}`,
  });
  // Too many requests is the only error worth telling people about; it does not reveal accounts.
  if (error?.status === 429) redirect(`${back}?error=wait`);
  if (error && error.status !== 400 && error.status !== 404 && error.status !== 422) redirect(`${back}?error=1`);
  redirect(`${back}?sent=1`);
}

// "Set a new password", reached from the reset email (the link signs the person in first).
export async function updatePassword(formData: FormData) {
  const locale = localeFrom(formData);
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const back = `/${locale}/reset-password`;
  if (password.length < 8 || password.length > 72) redirect(`${back}?error=short`);
  if (password !== confirm) redirect(`${back}?error=match`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/forgot-password?error=link`);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`${back}?error=${error.code === 'same_password' ? 'same' : error.code === 'weak_password' ? 'weak' : '1'}`);
  redirect(`${back}?done=1`);
}
