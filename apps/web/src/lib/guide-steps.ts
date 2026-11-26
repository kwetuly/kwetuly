import { GUIDE_STEP_IDS, isGuideStepId, type GuideStepId } from '@kwetuly/shared';

/** The six guide sign-up steps, in order (shared with the app). Each step's form saves only its own fields. */
export const GUIDE_STEPS = GUIDE_STEP_IDS;
export type GuideStep = GuideStepId;

export const isGuideStep = isGuideStepId;

/**
 * Where "Add a trip" in sign-up returns to: ?next=trips or ?next=story on the packages page. Only these
 * two step names are accepted (never an address), so the value cannot send anyone to another site.
 */
export type SignupReturn = 'trips' | 'story';
export const signupReturn = (value: unknown): SignupReturn | null => (value === 'trips' || value === 'story' ? value : null);
export const signupReturnHref = (locale: string, step: SignupReturn) => `/${locale}/dashboard?step=${step}`;
