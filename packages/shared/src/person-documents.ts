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

export const documentReviewStates = ['waiting', 'accepted', 'rejected', 'withdrawn'] as const;
export type DocumentReviewState = (typeof documentReviewStates)[number];

export const documentRejectReasons = ['unreadable', 'name_mismatch', 'expired', 'wrong_document', 'not_complete', 'other'] as const;
export type DocumentRejectReason = (typeof documentRejectReasons)[number];

export const documentFileExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'] as const;

/** Storage object name in the private `verification` bucket: {user_id}/{document_id}.{ext} */
export function personDocumentPath(userId: string, documentId: string, ext: string): string | null {
  const e = ext.toLowerCase().replace(/^\./, '');
  return (documentFileExtensions as readonly string[]).includes(e) ? `${userId}/${documentId}.${e}` : null;
}
