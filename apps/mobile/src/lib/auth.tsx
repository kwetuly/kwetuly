import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type Profile = { role: 'traveler' | 'guide' | 'provider' | 'investor' | 'admin'; full_name: string | null; phone: string | null; onboarded_at: string | null };

type Auth = { session: Session | null; ready: boolean };

const AuthContext = createContext<Auth>({ session: null, ready: false });

/**
 * True when the account has two-step sign-in on but this session has not entered the code yet.
 * Read from the session itself (the token's `aal` claim), so it needs no network call.
 */
export function needsSecondStep(session: Session | null): boolean {
  if (!session?.user.factors?.some((f) => f.status === 'verified')) return false;
  try {
    const payload = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))).aal !== 'aal2';
  } catch {
    return true;
  }
}

// Keeps the Supabase session in React state and follows sign-in / sign-out / token refresh.
// A session still waiting for its two-step code counts as signed out everywhere in the app.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Auth>({ session: null, ready: false });

  useEffect(() => {
    const accept = (session: Session | null) => setState({ session: needsSecondStep(session) ? null : session, ready: true });
    supabase.auth.getSession().then(({ data }) => accept(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => accept(session));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useSession() {
  return use(AuthContext);
}

/** The signed-in user's Kwetuly profile (role, name, phone), or null when signed out. */
export function useProfile() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('role, full_name, phone, onboarded_at').eq('id', userId!).single<Profile>();
      if (error) throw error;
      return data;
    },
  });
}
