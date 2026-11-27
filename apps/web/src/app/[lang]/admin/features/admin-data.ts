import 'server-only';

// Admin-only feature data (the advocate's questions, board references, page texts). Deep imports, not
// the @kwetuly/shared barrel, and server-only, so none of it reaches a public bundle (security review M3).
export { FEATURE_ADMIN, type FeatureAdminRow, type FeatureLegal } from '@kwetuly/shared/src/admin/features-admin';
export { featuresText, type FeaturesText } from '@kwetuly/shared/src/admin/features-text';
