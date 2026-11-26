import { useQuery } from '@tanstack/react-query';
import { isFeatureOn, isFeatureVisible, parseFeatureRows, type FeatureMap } from '@kwetuly/shared';
import { supabase } from '@/lib/supabase';

// Feature switches (site_settings feature.<id>), the same rule as the website and the database: a
// missing or broken row reads as off. Switches change rarely, so the answer is kept for 5 minutes and
// the last one is kept while the phone is offline. Screens hide with this; the database still refuses
// writes behind a switch that is off. There is no admin screen in the app: switches change on the web.

export async function getFeatures(): Promise<FeatureMap> {
  const { data, error } = await supabase.from('site_settings').select('key, value').like('key', 'feature.%').limit(500);
  if (error) throw new Error(error.message);
  return parseFeatureRows(data as { key: string; value: unknown }[]);
}

export function useFeatures() {
  return useQuery({
    queryKey: ['features'],
    queryFn: getFeatures,
    staleTime: 5 * 60_000,
    gcTime: 24 * 60 * 60_000,
    networkMode: 'offlineFirst',
  });
}

/** False while loading or on error (fail closed). */
export function useFeatureOn(id: string): boolean {
  const { data } = useFeatures();
  return !!data && isFeatureOn(data, id);
}

/** On for everyone, or a team-only preview for admins (the database decides admin rights on writes). */
export function useFeatureVisible(id: string, isAdmin: boolean): boolean {
  const { data } = useFeatures();
  return !!data && isFeatureVisible(data, id, isAdmin);
}
