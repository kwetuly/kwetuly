// What Rafrika checked about a guide, and how complete their profile is.
// Shared by the website and the app so both show exactly the same thing.

export type GuideCheckId = 'identity' | 'licence' | 'firstAid';

export type GuideCheckFields = {
  identity_checked_at: string | null;
  licence_checked_at: string | null;
  first_aid_checked_at: string | null;
  first_aid_valid_until: string | null; // yyyy-mm-dd
};

export type GuideCheck = { id: GuideCheckId; checkedAt: string; validUntil: string | null };

function isExpired(validUntil: string | null, today: Date) {
  return !!validUntil && validUntil < today.toISOString().slice(0, 10);
}

/** The checks an admin has done, in display order. An expired first-aid check is left out. */
export function guideChecks(guide: GuideCheckFields, today = new Date()): GuideCheck[] {
  const checks: GuideCheck[] = [];
  if (guide.identity_checked_at) checks.push({ id: 'identity', checkedAt: guide.identity_checked_at, validUntil: null });
  if (guide.licence_checked_at) checks.push({ id: 'licence', checkedAt: guide.licence_checked_at, validUntil: null });
  if (guide.first_aid_checked_at && !isExpired(guide.first_aid_valid_until, today)) {
    checks.push({ id: 'firstAid', checkedAt: guide.first_aid_checked_at, validUntil: guide.first_aid_valid_until });
  }
  return checks;
}

export type DocumentStatus = 'checked' | 'waiting' | 'missing' | 'expired';

/** Where one private document stands, for the guide's own dashboard. */
export function documentStatus(uploaded: boolean, checkedAt: string | null, validUntil: string | null = null, today = new Date()): DocumentStatus {
  if (checkedAt && isExpired(validUntil, today)) return 'expired';
  if (checkedAt) return 'checked';
  return uploaded ? 'waiting' : 'missing';
}

export type CompletionItemId =
  | 'photo'
  | 'headline'
  | 'bio'
  | 'specialties'
  | 'languages'
  | 'regions'
  | 'years'
  | 'phone'
  | 'idDocument'
  | 'licenceDocument'
  | 'firstAidDocument';

export type CompletionInput = {
  photo_url?: string | null;
  headline?: string | null;
  bio?: string | null;
  specialties?: string[];
  languages?: string[];
  regions?: string[];
  years_experience?: number | null;
  phone?: string | null;
  id_document_path?: string | null;
  license_document_path?: string | null;
  first_aid_document_path?: string | null;
};

/** Profile strength: required items count towards the percentage; first aid is optional. */
export function profileCompletion(p: CompletionInput) {
  const items: { id: CompletionItemId; done: boolean; optional: boolean }[] = [
    { id: 'photo', done: !!p.photo_url, optional: false },
    { id: 'headline', done: !!p.headline?.trim(), optional: false },
    { id: 'bio', done: !!p.bio?.trim(), optional: false },
    { id: 'specialties', done: (p.specialties?.length ?? 0) > 0, optional: false },
    { id: 'languages', done: (p.languages?.length ?? 0) > 0, optional: false },
    { id: 'regions', done: (p.regions?.length ?? 0) > 0, optional: false },
    { id: 'years', done: p.years_experience != null, optional: false },
    { id: 'phone', done: !!p.phone?.trim(), optional: false },
    { id: 'idDocument', done: !!p.id_document_path, optional: false },
    { id: 'licenceDocument', done: !!p.license_document_path, optional: false },
    { id: 'firstAidDocument', done: !!p.first_aid_document_path, optional: true },
  ];
  const required = items.filter((i) => !i.optional);
  const percent = Math.round((required.filter((i) => i.done).length / required.length) * 100);
  return { items, percent };
}
