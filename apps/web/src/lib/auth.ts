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

/**
 * The welcome step for accounts that have not finished it (e.g. no invite code yet). `next` is the
 * page they wanted, so the welcome step can send them back there afterwards.
 */
export function welcomePath(locale: string, next?: string): string {
  return `/${locale}/welcome${next ? `?next=${encodeURIComponent(next)}` : ''}`;
}

/** `next`: the page to come back to after the welcome step. */
export async function requireUser(locale: string, next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (await needsSecondStep()) redirect(`/${locale}/login/verify`);
  if (!user.onboarded) redirect(welcomePath(locale, next));
  return user;
}

/**
 * For server actions that create content. The database refuses content from accounts that have not
 * finished the welcome step, so send them there first instead of showing an error; they come back to `back`.
 */
export async function requireOnboarded(userId: string, locale: string, back: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('onboarded_at').eq('id', userId).maybeSingle();
  if (!data?.onboarded_at) redirect(welcomePath(locale, back));
}

// Guide Hub pages: verified guides and admins only. Everyone else goes to their dashboard.
export async function requireHubAccess(locale: string): Promise<CurrentUser> {
  const user = await requireUser(locale);
  if (!user.canUseHub) redirect(`/${locale}/dashboard`);
  return user;
}

/**
 * Admins must use two-step sign-in. 'setup' when the account has no authenticator yet,
 * 'verify' when it has one but this session has not entered the code, 'ok' when the session is aal2.
 * The database checks the same thing (private.is_admin() needs an aal2 session).
 */
export async function adminSecondStep(): Promise<'ok' | 'setup' | 'verify'> {
  if (await needsSecondStep()) return 'verify';
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === 'aal2') return 'ok';
  return data?.nextLevel === 'aal2' ? 'verify' : 'setup';
}

/** For admin server actions: an admin account whose session has passed two-step sign-in. */
export async function isAdminSession(user: CurrentUser | null): Promise<boolean> {
  if (user?.role !== 'admin') return false;
  return (await adminSecondStep()) === 'ok';
}

/** Admin pages: everyone else goes home; admins without two-step go to set it up or enter the code. */
export async function requireAdmin(locale: string): Promise<CurrentUser> {
  const user = await requireUser(locale);
  if (user.role !== 'admin') redirect(`/${locale}`);
  const step = await adminSecondStep();
  if (step === 'verify') redirect(`/${locale}/login/verify?next=${encodeURIComponent(`/${locale}/admin`)}`);
  if (step === 'setup') redirect(`/${locale}/security?admin=two-step`);
  return user;
}

/**
 * Business accounts may make offers and run group trips only once Rafrika has approved one of
 * their listings (the database checks the same). 'none' for accounts that are not businesses.
 */
export async function businessApproval(user: CurrentUser | null): Promise<'approved' | 'waiting' | 'none'> {
  if (user?.role !== 'provider') return 'none';
  const supabase = await createClient();
  const { data } = await supabase.from('providers').select('id').eq('owner_id', user.id).eq('verification_status', 'approved').eq('is_sample', false).limit(1);
  return data && data.length > 0 ? 'approved' : 'waiting';
}
