import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { businessDocumentKinds, datedDocumentKinds, documentRejectReasons, documentReviewStates, personDocumentKinds, personDocumentPath, uploadableDocumentKinds } from './person-documents';

const sql = readFileSync(new URL('../../../supabase/migrations/20261122000000_person_documents_identifiers.sql', import.meta.url), 'utf8');
const quoted = (block: string) => [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

describe('person documents match migration A', () => {
  it('kinds', () => {
    const block = sql.match(/create type public\.person_document_kind as enum \(([\s\S]*?)\);/)![1];
    expect(quoted(block)).toEqual([...personDocumentKinds]);
  });
  it('review states', () => {
    const block = sql.match(/create type public\.document_review_state as enum \(([^)]*)\)/)![1];
    expect(quoted(block)).toEqual([...documentReviewStates]);
  });
  it('reject reasons', () => {
    const block = sql.match(/review_reason text check \(review_reason in\s*\(([^)]*)\)/)![1];
    expect(quoted(block)).toEqual([...documentRejectReasons]);
  });
  it('business and dated kinds', () => {
    const business = sql.match(/person_documents_business_subject check \(\s*\(kind in \(([^)]*)\)/)![1];
    expect(quoted(business)).toEqual([...businessDocumentKinds]);
    const dated = sql.match(/person_checks_dated check \(\s*kind not in \(([^)]*)\)/)![1];
    expect(quoted(dated)).toEqual([...datedDocumentKinds]);
  });
  it('no passport images yet', () => {
    expect(sql).toContain("constraint person_documents_no_passport_image check (kind <> 'passport')");
    expect(uploadableDocumentKinds).not.toContain('passport');
  });
});

describe('personDocumentPath', () => {
  it('builds {user}/{id}.{ext} for allowed types only', () => {
    expect(personDocumentPath('u', 'd', '.JPG')).toBe('u/d.jpg');
    expect(personDocumentPath('u', 'd', 'pdf')).toBe('u/d.pdf');
    expect(personDocumentPath('u', 'd', 'heic')).toBeNull();
  });
});
