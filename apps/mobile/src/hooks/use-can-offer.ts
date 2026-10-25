import { useQuery } from '@tanstack/react-query';
import { getMyGuide } from '@/lib/api-more';
import { getMyBusiness } from '@/lib/businesses';
import { useProfile, useSession } from '@/lib/auth';

/**
 * Verified guides and approved business accounts may see open trip requests, send offers and run
 * group trips. A business waits until Kwetuly approves its listing (the database checks the same).
 */
export function useCanOffer() {
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile();
  const role = profile.data?.role;
  const guide = useQuery({ queryKey: ['my-guide', userId], queryFn: () => getMyGuide(userId!), enabled: !!userId });
  const business = useQuery({ queryKey: ['my-business', userId], queryFn: () => getMyBusiness(userId!), enabled: !!userId && role === 'provider' });
  const approvedGuide = guide.data?.guide?.verification_status === 'approved' ? guide.data.guide : null;
  const approvedBusiness = role === 'provider' && business.data?.verification_status === 'approved' && !business.data.is_sample;
  return {
    canOffer: approvedBusiness || role === 'admin' || !!approvedGuide,
    /** Business account whose listing Kwetuly has not approved yet. */
    businessWaiting: role === 'provider' && !approvedBusiness && !approvedGuide && !business.isLoading,
    approvedBusiness,
    guideId: approvedGuide?.id ?? null,
    loading: profile.isLoading || guide.isLoading || (role === 'provider' && business.isLoading),
  };
}
