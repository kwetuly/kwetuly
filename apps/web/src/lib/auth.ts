import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';

export type CurrentUser = { id: string; email: string | null; role: string; fullName: string | null };

// Returns the signed-in user with their Rafrika role, or null.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? null,
    role: profile?.role ?? 'traveler',
    fullName: profile?.full_name ?? null,
  };
}

export async function requireUser(locale: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return user;
}
