import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';

export type Role = 'traveler' | 'guide' | 'provider' | 'investor' | 'admin';

export type CurrentUser = {
  id: string;
  email: string | null;
  role: Role;
  fullName: string | null;
  phone: string | null;
  /** False until a social sign-up has picked an account type and added a phone number. */
  onboarded: boolean;
  guide: { id: string; slug: string; status: 'pending' | 'approved' | 'rejected' } | null;
  /** Approved guides and admins may enter the Guide Hub. */
  canUseHub: boolean;
};

// Returns the signed-in user with their Rafrika role and guide status, or null.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: guide }] = await Promise.all([
    supabase.from('profiles').select('role, full_name, phone, onboarded_at').eq('id', user.id).single(),
    supabase.from('guides').select('id, slug, verification_status').eq('owner_id', user.id).maybeSingle(),
  ]);

  const role = (profile?.role ?? 'traveler') as Role;
  const guideInfo = guide ? { id: guide.id, slug: guide.slug, status: guide.verification_status } : null;

  return {
    id: user.id,
    email: user.email ?? null,
    role,
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    onboarded: Boolean(profile?.onboarded_at),
    guide: guideInfo,
    canUseHub: role === 'admin' || guideInfo?.status === 'approved',
  };
}

/** True when the account has two-step sign-in on but this session has not entered the code yet. */
export async function needsSecondStep(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
}

export async function requireUser(locale: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (await needsSecondStep()) redirect(`/${locale}/login/verify`);
  if (!user.onboarded) redirect(`/${locale}/welcome`);
  return user;
}

// Guide Hub pages: verified guides and admins only. Everyone else goes to their dashboard.
export async function requireHubAccess(locale: string): Promise<CurrentUser> {
  const user = await requireUser(locale);
  if (!user.canUseHub) redirect(`/${locale}/dashboard`);
  return user;
}
