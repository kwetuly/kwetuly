'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { SOCIAL_PROVIDERS, type SocialProvider } from '@/lib/auth-providers';
import { normalizePhone } from '@/lib/phone';

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

  if (!phone) redirect(`/${locale}/join?role=${role}&error=phone`);
  if (!email || password.length < 8 || !fullName) redirect(`/${locale}/join?role=${role}&error=1`);

  const origin = (await headers()).get('origin') ?? '';
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role, phone, preferred_language: locale },
      emailRedirectTo: `${origin}/auth/confirm?next=/${locale}/dashboard`,
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

  const origin = (await headers()).get('origin') ?? '';
  const next = `/${locale}/welcome${role ? `?role=${role}` : ''}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: providerValue as SocialProvider,
    options: { redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` },
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
  redirect(`/${locale}/dashboard`);
}

export async function signOut(formData: FormData) {
  const locale = localeFrom(formData);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}
