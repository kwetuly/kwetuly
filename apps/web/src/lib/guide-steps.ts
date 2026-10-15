/** The guide sign-up steps, in order. Each step's form saves only its own fields. */
export const GUIDE_STEPS = ['basics', 'work', 'documents', 'story', 'calls'] as const;
export type GuideStep = (typeof GUIDE_STEPS)[number];

export const isGuideStep = (value: unknown): value is GuideStep => (GUIDE_STEPS as readonly unknown[]).includes(value);
