import { GUIDE_STEP_IDS, guideStepFrom, type GuideStepId } from '@kwetuly/shared';

/** The six guide sign-up steps, in order (shared with the app). Each step's form saves only its own fields. */
export const GUIDE_STEPS = GUIDE_STEP_IDS;
export type GuideStep = GuideStepId;

/** A step from ?step= (or a form field), or null. The old name 'story' opens step 5 "Your page". */
export const guideStep = (value: unknown): GuideStep | null => guideStepFrom(value);
export const isGuideStep = (value: unknown) => guideStep(value) !== null;

/**
 * Where a page reached from sign-up returns to: ?next=trips, ?next=page or ?next=calls on the
 * packages, photos and links pages. Only these step names are accepted (never an address), so the
 * value cannot send anyone to another site. The old ?next=story still returns to "Your page".
 */
export type SignupReturn = 'trips' | 'page' | 'calls';
export const signupReturn = (value: unknown): SignupReturn | null => {
  const step = guideStepFrom(value);
  return step === 'trips' || step === 'page' || step === 'calls' ? step : null;
};
export const signupReturnHref = (locale: string, step: SignupReturn) => `/${locale}/dashboard?step=${step}`;
