import { GUIDE_STEP_IDS, isGuideStepId, type GuideStepId } from '@kwetuly/shared';

/** The six guide sign-up steps, in order (shared with the app). Each step's form saves only its own fields. */
export const GUIDE_STEPS = GUIDE_STEP_IDS;
export type GuideStep = GuideStepId;

export const isGuideStep = isGuideStepId;
