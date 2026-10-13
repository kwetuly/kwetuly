import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type Profile = { role: 'traveler' | 'guide' | 'provider' | 'investor' | 'admin'; full_name: string | null; phone: string | null; onboarded_at: string | null };

type Auth = { session: Session | null; ready: boolean };

const AuthContext = createContext<Auth>({ session: null, ready: false });

// Keeps the Supabase session in React state and follows sign-in / sign-out / token refresh.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Auth>({ session: null, ready: false });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, ready: true }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, ready: true }));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useSession() {
  return use(AuthContext);
}

/** The signed-in user's Rafrika profile (role, name, phone), or null when signed out. */
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
