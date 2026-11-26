import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { guideProgressText } from '@kwetuly/shared';
import { GLYPHS } from '@/components/glyph';
import { ListGroup, ListRow } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

// The feature.booking_link switch, read like the other site settings (a public site_settings row).
// A missing row or anything but {"on": true} means off. Wave 1 keeps this read here; when
// apps/mobile/src/lib/features.ts (S1) lands, use its featureOn('booking_link') instead.
async function getBookingLinkOn(): Promise<boolean> {
  const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'feature.booking_link').maybeSingle<{ value: { on?: unknown } }>();
  if (error) throw new Error(error.message);
  return data?.value?.on === true;
}

export function useBookingLinkOn() {
  return useQuery({ queryKey: ['feature', 'booking_link'], queryFn: getBookingLinkOn, staleTime: 5 * 60_000 });
}

/** "My booking link" on the guide's profile overview. Hidden while the switch is off or unknown. */
export function BookingLinkEntry() {
  const { locale } = useI18n();
  const on = useBookingLinkOn();
  if (on.data !== true) return null;
  const g = guideProgressText(locale);
  return (
    <ListGroup>
      <ListRow icon={GLYPHS.link} title={g.linkTitle} subtitle={g.linkMenuHint} onPress={() => router.push('/booking-link')} />
    </ListGroup>
  );
}
