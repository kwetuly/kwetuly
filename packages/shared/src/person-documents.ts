// Person documents (paid verification, migration A). Mirrors the enums and check constraints in
// supabase/migrations/20261122000000_person_documents_identifiers.sql; person-documents.test.ts
// fails if they drift apart.

export const personDocumentKinds = [
  'identity',
  'passport',
  'guide_licence',
  'first_aid',
  'wfr',
  'driving_licence',
  'business_licence',
  'tin_certificate',
  'operator_licence',
  'other',
] as const;
export type PersonDocumentKind = (typeof personDocumentKinds)[number];

/** Papers of a business: they carry provider_id as well as the owner's user_id. */
export const businessDocumentKinds: readonly PersonDocumentKind[] = ['business_licence', 'tin_certificate', 'operator_licence'];

/** Kinds whose check needs a valid-until date. */
export const datedDocumentKinds: readonly PersonDocumentKind[] = [
  'passport',
  'guide_licence',
  'first_aid',
  'wfr',
  'driving_licence',
  'business_licence',
  'operator_licence',
];

/** Kinds a person may upload an image of today. Passport photo pages wait for legal and Walter. */
export const uploadableDocumentKinds: readonly PersonDocumentKind[] = personDocumentKinds.filter((k) => k !== 'passport');

/** 'expired': nobody reviewed it in time (set by the sweep); the person can upload again. */
export const documentReviewStates = ['waiting', 'accepted', 'rejected', 'withdrawn', 'expired'] as const;
export type DocumentReviewState = (typeof documentReviewStates)[number];

export const documentRejectReasons = ['unreadable', 'name_mismatch', 'expired', 'wrong_document', 'not_complete', 'other'] as const;
export type DocumentRejectReason = (typeof documentRejectReasons)[number];

export const documentFileExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'] as const;

/** Storage object name in the private `verification` bucket: {user_id}/{document_id}.{ext} */
export function personDocumentPath(userId: string, documentId: string, ext: string): string | null {
  const e = ext.toLowerCase().replace(/^\./, '');
  return (documentFileExtensions as readonly string[]).includes(e) ? `${userId}/${documentId}.${e}` : null;
}

export type DocumentFileType = { contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'; ext: 'jpg' | 'png' | 'webp' | 'pdf' };

/**
 * The real type of a verification file, read from its first bytes (security review L3): JPEG, PNG,
 * WebP or PDF, otherwise null. The uploader's declared type and the file name are never trusted.
 */
export function detectDocumentFileType(bytes: Uint8Array): DocumentFileType | null {
  const starts = (sig: readonly number[], at = 0) => bytes.length >= at + sig.length && sig.every((b, i) => bytes[at + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return { contentType: 'image/jpeg', ext: 'jpg' };
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { contentType: 'image/png', ext: 'png' };
  // "RIFF", four size bytes, "WEBP"
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return { contentType: 'image/webp', ext: 'webp' };
  // "%PDF-"
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return { contentType: 'application/pdf', ext: 'pdf' };
  return null;
}

// ---------------------------------------------------------------------------
// Member "Verification" screen (website and app): which papers a role sends, and the status card.
// ---------------------------------------------------------------------------

/**
 * Version of the short privacy notice a person agrees to before uploading or typing a number. Change it
 * whenever noticeBody changes, so each upload records the text that was shown.
 * privacy-2026-11-b: says photos are cleaned of hidden details but PDFs are kept as sent (security review L4).
 */
export const VERIFICATION_NOTICE_VERSION = 'privacy-2026-11-b';

/** Days before a check ends when the screen starts saying "ends soon". */
export const EXPIRING_SOON_DAYS = 30;

/** Who is asking: a guide, a business owner, or both (a guide who also owns a listing). */
export type VerificationAudience = { guide: boolean; business: boolean; tanzanian: boolean };

export type DocumentSlot = {
  kind: PersonDocumentKind;
  /** Needed for the check (legal confirms each item before it is really required; plan 3.1). */
  required: boolean;
  /** Only one of a group is needed (first aid or WFR). */
  group?: 'first_aid';
};

/**
 * The upload cards a person sees (plan 3.1). NIDA card image for Tanzanians; non-Tanzanian business
 * owners give a passport number only (no passport images, M11). "Other" is always offered.
 */
export function documentSlots({ guide, business, tanzanian }: VerificationAudience): DocumentSlot[] {
  const slots: DocumentSlot[] = [];
  if (tanzanian || guide) slots.push({ kind: 'identity', required: true });
  if (guide) {
    slots.push({ kind: 'guide_licence', required: true });
    slots.push({ kind: 'first_aid', required: true, group: 'first_aid' });
    slots.push({ kind: 'wfr', required: true, group: 'first_aid' });
    slots.push({ kind: 'driving_licence', required: false });
  }
  if (business) {
    slots.push({ kind: 'business_licence', required: true });
    slots.push({ kind: 'tin_certificate', required: true });
    slots.push({ kind: 'operator_licence', required: false });
  }
  slots.push({ kind: 'other', required: false });
  return slots;
}

export type MemberDocument = {
  id: string;
  kind: PersonDocumentKind;
  title: string | null;
  provider_id: string | null;
  review_state: DocumentReviewState;
  review_reason: DocumentRejectReason | null;
  stated_valid_until: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
};

export type MemberCheck = {
  id: string;
  kind: PersonDocumentKind;
  title: string | null;
  provider_id: string | null;
  checked_at: string;
  valid_until: string | null;
  ended_at: string | null;
};

export type VerificationState = 'none' | 'waiting' | 'checked' | 'rejected' | 'expiring' | 'expired';

export type VerificationSummary = {
  state: VerificationState;
  /** Earliest end date among the current checks that have one. */
  activeUntil: string | null;
  /** Latest date Kwetuly checked something. */
  lastChecked: string | null;
  waiting: number;
  /** The newest rejection that has not been followed by a new upload of the same paper. */
  rejected: MemberDocument | null;
};

const sameSubject = (a: { kind: string; title: string | null; provider_id: string | null }, b: { kind: string; title: string | null; provider_id: string | null }) =>
  a.kind === b.kind && (a.provider_id ?? '') === (b.provider_id ?? '') && (a.kind !== 'other' || (a.title ?? '').toLowerCase() === (b.title ?? '').toLowerCase());

/** Adds days to a YYYY-MM-DD date. */
export function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The status card, worked out from the person's own rows (nothing is stored).
 * Order: rejected (something to fix) > expired > ending soon > waiting > checked > nothing sent.
 */
export function verificationSummary(documents: MemberDocument[], checks: MemberCheck[], today: string): VerificationSummary {
  const current = checks.filter((c) => !c.ended_at);
  const dated = current.map((c) => c.valid_until).filter((d): d is string => Boolean(d)).sort();
  const activeUntil = dated[0] ?? null;
  const lastChecked = current.map((c) => c.checked_at).sort().at(-1) ?? null;
  const waiting = documents.filter((d) => d.review_state === 'waiting').length;
  const rejected =
    documents
      .filter((d) => d.review_state === 'rejected')
      .filter((d) => !documents.some((o) => o.id !== d.id && sameSubject(o, d) && o.uploaded_at > d.uploaded_at && (o.review_state === 'waiting' || o.review_state === 'accepted')))
      .sort((a, b) => (a.reviewed_at ?? '').localeCompare(b.reviewed_at ?? ''))
      .at(-1) ?? null;

  let state: VerificationState = 'none';
  if (rejected) state = 'rejected';
  else if (activeUntil && activeUntil < today) state = 'expired';
  else if (activeUntil && activeUntil <= addDaysIso(today, EXPIRING_SOON_DAYS)) state = 'expiring';
  else if (waiting > 0) state = 'waiting';
  else if (current.length > 0) state = 'checked';
  return { state, activeUntil, lastChecked, waiting, rejected };
}

/** For one upload card: the newest upload and the current check of that paper. */
export function slotStatus(kind: PersonDocumentKind, providerId: string | null, documents: MemberDocument[], checks: MemberCheck[]) {
  const subject = { kind, title: null, provider_id: providerId };
  const mine = (row: { kind: string; provider_id: string | null }) => row.kind === kind && (kind === 'other' || (row.provider_id ?? '') === (providerId ?? ''));
  const latest = documents.filter(mine).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
  const check = checks.find((c) => !c.ended_at && (kind === 'other' ? c.kind === 'other' : sameSubject(c, subject))) ?? null;
  return { latest: latest[0] ?? null, all: latest, check };
}
