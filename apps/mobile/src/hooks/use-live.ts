import { useEffect } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Refetches a query whenever rows change in a table (Supabase Realtime; only rows the user may see arrive).
export function useLive(table: string, filter: string, queryKey: QueryKey) {
  const queryClient = useQueryClient();
  const key = JSON.stringify(queryKey);

  useEffect(() => {
    const channel = supabase
      .channel(`${table}:${filter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => {
        queryClient.invalidateQueries({ queryKey: JSON.parse(key) });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, key, queryClient]);
}
