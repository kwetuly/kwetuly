import { useQuery } from '@tanstack/react-query';
import { getMyGuide } from '@/lib/api-more';
import { useProfile, useSession } from '@/lib/auth';

/** Verified guides and business accounts may see open trip requests and send offers. */
export function useCanOffer() {
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile();
  const guide = useQuery({ queryKey: ['my-guide', userId], queryFn: () => getMyGuide(userId!), enabled: !!userId });
  const role = profile.data?.role;
  const approvedGuide = guide.data?.guide?.verification_status === 'approved' ? guide.data.guide : null;
  return {
    canOffer: role === 'provider' || role === 'admin' || !!approvedGuide,
    guideId: approvedGuide?.id ?? null,
    loading: profile.isLoading || guide.isLoading,
  };
}
