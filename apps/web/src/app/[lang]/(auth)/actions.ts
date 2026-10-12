'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';

function localeFrom(formData: FormData) {
  const value = String(formData.get('locale') ?? '');
  return hasLocale(value) ? value : defaultLocale;
}

export async function signUpGuide(formData: FormData) {
  const locale = localeFrom(formData);
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();

  if (!email || password.length < 8 || !fullName) redirect(`/${locale}/join?error=1`);

  const origin = (await headers()).get('origin') ?? '';
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role: 'guide', preferred_language: locale },
      emailRedirectTo: `${origin}/auth/confirm?next=/${locale}/dashboard`,
    },
  });

  if (error) redirect(`/${locale}/join?error=1`);
  redirect(`/${locale}/join?sent=1`);
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
