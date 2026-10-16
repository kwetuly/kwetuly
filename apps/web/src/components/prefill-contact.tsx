'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Put inside an enquiry form: when the visitor is signed in, fills the empty "name" and "contact"
 * fields from their profile so they don't type them again. Pages stay cacheable because this runs
 * in the browser.
 */
export function PrefillContact() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = marker.current?.closest('form');
    if (!form) return;
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle();
      const fill = (name: string, value: string | null | undefined) => {
        const input = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
        if (input && !input.value && value) input.value = value;
      };
      fill('name', data?.full_name);
      fill('contact', data?.phone ?? user.email);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return <span ref={marker} hidden />;
}
