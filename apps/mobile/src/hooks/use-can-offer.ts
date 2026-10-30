import { useQuery } from '@tanstack/react-query';
import { getMyGuide } from '@/lib/api-more';
import { hasApprovedBusiness } from '@/lib/businesses';
import { useProfile, useSession } from '@/lib/auth';

/**
 * Verified guides and owners of an approved listing may see open trip requests, send offers and run
 * group trips, whatever account type they picked at sign-up (the database checks the same).
 * A business account waits until Kwetuly approves its listing.
 */
export function useCanOffer() {
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile();
  const role = profile.data?.role;
  const guide = useQuery({ queryKey: ['my-guide', userId], queryFn: () => getMyGuide(userId!), enabled: !!userId });
  const business = useQuery({ queryKey: ['approved-business', userId], queryFn: () => hasApprovedBusiness(userId!), enabled: !!userId });
  const approvedGuide = guide.data?.guide?.verification_status === 'approved' ? guide.data.guide : null;
  const approvedBusiness = business.data === true;
  return {
    canOffer: approvedBusiness || role === 'admin' || !!approvedGuide,
    /** Business account whose listing Kwetuly has not approved yet. */
    businessWaiting: role === 'provider' && !approvedBusiness && !approvedGuide && !business.isLoading,
    approvedBusiness,
    guideId: approvedGuide?.id ?? null,
    loading: profile.isLoading || guide.isLoading || business.isLoading,
  };
}
