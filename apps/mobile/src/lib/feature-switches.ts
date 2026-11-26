import { useQuery } from '@tanstack/react-query';
import { featuresFromSettings } from '@kwetuly/shared';
import { supabase } from './supabase';

// Admin on/off switches: site_settings rows "feature.<id>" with {"on": true|false}, the same rows the
// website and the database (private.feature_on) read. A missing row, or a read that fails, is off.

async function getFeaturesOn(): Promise<string[]> {
  const { data, error } = await supabase.from('site_settings').select('key, value').like('key', 'feature.%');
  if (error) throw error;
  return featuresFromSettings(data);
}

/** The switched-on feature ids in `on`; empty (everything behind a switch hidden) while loading or offline. */
export function useFeatures() {
  const query = useQuery({ queryKey: ['features'], queryFn: getFeaturesOn, staleTime: 5 * 60_000 });
  return { ...query, on: query.data ?? [] };
}
