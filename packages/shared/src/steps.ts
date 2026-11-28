// Guide sign-up steps and the "You have finished 3 of 6" progress line.
// Shared by the website and the app so both count the steps the same way.

/**
 * The six guide sign-up steps, in order (R14, Walter 2026-11-24; slice S8): about you, what you do,
 * documents, your trips, your page, calls and booking link. The ids are also the website's ?step= values.
 */
export const GUIDE_STEP_IDS = ['basics', 'work', 'documents', 'trips', 'page', 'calls'] as const;
export type GuideStepId = (typeof GUIDE_STEP_IDS)[number];

/** Steps 1-4 are required; "your page" and "calls and booking link" are optional. */
export const GUIDE_REQUIRED_STEPS = 4;

export const isGuideStepId = (value: unknown): value is GuideStepId => (GUIDE_STEP_IDS as readonly unknown[]).includes(value);

/**
 * A step id from a link (?step= or ?next=), or null. Step 5 was called 'story' before slice S8, so
 * saved links and bookmarks with 'story' still open "Your page".
 */
export function guideStepFrom(value: unknown): GuideStepId | null {
  const id = value === 'story' ? 'page' : value;
  return isGuideStepId(id) ? id : null;
}

/** The guide can send the profile for checking once the required steps (1-4) are finished. */
export const canSendForChecking = (progress: StepProgress) => progress.requiredLeft === 0;

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
    // Your page: the bio is what counts. The cover photo, gallery and profile links on the same step
    // are optional extras and never block it.
    page: !!guide?.bio?.trim(),
    // Calls and booking link: the booking link needs nothing from the guide, so prep calls decide it.
    // The "Offer VIP hosting" switch on the same step is optional.
    calls: !!guide?.call_enabled,
  };
}

/** The six steps' progress for a guide (steps 1-4 required). */
export function guideStepProgress(input: GuideStepInput): StepProgress {
  const done = guideStepsDone(input);
  return stepProgress(GUIDE_STEP_IDS.map((id) => done[id]), GUIDE_REQUIRED_STEPS);
}

/** The fields of a guide package that the "Offer VIP hosting" switch looks at. */
export type VipPackage = { id: string; kind: string; status: 'draft' | 'pending' | 'approved' | 'rejected' };

/**
 * Where the guide's VIP hosting stands (the existing personal_host package kind, design 4.1).
 * on: a personal_host package is sent for checking or approved. draftId: a personal_host package kept
 * as a draft (for example one switched off before), which switching on sends for checking again.
 */
export function vipHosting(packages: readonly VipPackage[]): { on: boolean; liveIds: string[]; draftId: string | null } {
  const host = packages.filter((p) => p.kind === 'personal_host');
  const liveIds = host.filter((p) => p.status === 'pending' || p.status === 'approved').map((p) => p.id);
  return { on: liveIds.length > 0, liveIds, draftId: host.find((p) => p.status === 'draft')?.id ?? null };
}

/**
 * What saving the switch does: nothing; hide the live VIP hosting packages (as drafts, nothing is
 * deleted); send a hidden one for checking again; or ask the guide to describe a new one.
 */
export type VipChange = { kind: 'none' } | { kind: 'hide'; ids: string[] } | { kind: 'resend'; id: string } | { kind: 'create' };

export function vipChange(packages: readonly VipPackage[], wanted: boolean): VipChange {
  const state = vipHosting(packages);
  if (wanted === state.on) return { kind: 'none' };
  if (!wanted) return { kind: 'hide', ids: state.liveIds };
  return state.draftId ? { kind: 'resend', id: state.draftId } : { kind: 'create' };
}
