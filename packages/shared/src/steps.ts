// Guide sign-up steps and the "You have finished 3 of 6" progress line.
// Shared by the website and the app so both count the steps the same way.

/** The six guide sign-up steps, in order (R14, Walter 2026-11-24). The ids are also the website's ?step= values. */
export const GUIDE_STEP_IDS = ['basics', 'work', 'documents', 'trips', 'story', 'calls'] as const;
export type GuideStepId = (typeof GUIDE_STEP_IDS)[number];

/** Steps 1-4 are required; "your page" and "calls and booking link" are optional. */
export const GUIDE_REQUIRED_STEPS = 4;

export const isGuideStepId = (value: unknown): value is GuideStepId => (GUIDE_STEP_IDS as readonly unknown[]).includes(value);

export type StepProgress = {
  /** One entry per step, in order. */
  steps: { done: boolean; optional: boolean }[];
  finished: number;
  total: number;
  /** Steps not finished yet, optional ones included. */
  left: number;
  /** Required steps not finished yet. */
  requiredLeft: number;
};

/** Counts finished steps. The first `required` steps are required, the rest optional. */
export function stepProgress(done: boolean[], required: number = done.length): StepProgress {
  const steps = done.map((d, i) => ({ done: d, optional: i >= required }));
  const finished = done.filter(Boolean).length;
  return {
    steps,
    finished,
    total: done.length,
    left: done.length - finished,
    requiredLeft: steps.filter((s) => !s.optional && !s.done).length,
  };
}

/** What the six steps are counted from. Only fields that exist today. */
export type GuideStepInput = {
  guide: {
    display_name?: string | null;
    base_region?: string | null;
    languages?: string[] | null;
    photo_url?: string | null;
    headline?: string | null;
    specialties?: string[] | null;
    bio?: string | null;
    call_enabled?: boolean | null;
  } | null;
  idDocument: boolean;
  licenceDocument: boolean;
  /** Packages sent for review or approved. */
  tripCount: number;
};

/** Which of the six guide steps are finished, in GUIDE_STEP_IDS order. */
export function guideStepsDone({ guide, idDocument, licenceDocument, tripCount }: GuideStepInput): Record<GuideStepId, boolean> {
  return {
    // About you: name, region, languages and a photo.
    basics: !!guide?.display_name?.trim() && !!guide.base_region && (guide.languages?.length ?? 0) > 0 && !!guide.photo_url,
    // What you do: a headline and at least one specialty (the rule used before the six steps).
    work: !!guide?.headline?.trim() && (guide.specialties?.length ?? 0) > 0,
    documents: idDocument && licenceDocument,
    // TODO(RP7, library_picks): count trips picked from the trip library too, once those picks exist.
    // Today a "trip" is a guide package that was sent for review or approved.
    trips: tripCount > 0,
    // Your page: the bio is what counts. TODO(S4/S6 cover_gallery, S5 profile_links): cover photo,
    // gallery and the new links are optional extras and never block this step.
    story: !!guide?.bio?.trim(),
    // Calls and booking link: the booking link needs nothing from the guide, so prep calls decide it.
    calls: !!guide?.call_enabled,
  };
}

/** The six steps' progress for a guide (steps 1-4 required). */
export function guideStepProgress(input: GuideStepInput): StepProgress {
  const done = guideStepsDone(input);
  return stepProgress(GUIDE_STEP_IDS.map((id) => done[id]), GUIDE_REQUIRED_STEPS);
}
