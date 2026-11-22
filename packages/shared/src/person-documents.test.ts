import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tanzaniaToday } from './group-trip-rules';
import { addDaysIso, businessDocumentKinds, detectDocumentFileType, datedDocumentKinds, documentRejectReasons, documentReviewStates, documentSlots, personDocumentKinds, personDocumentPath, slotStatus, uploadableDocumentKinds, verificationSummary, type MemberCheck, type MemberDocument } from './person-documents';

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

const doc = (over: Partial<MemberDocument>): MemberDocument => ({
  id: 'd1', kind: 'identity', title: null, provider_id: null, review_state: 'waiting', review_reason: null,
  stated_valid_until: null, uploaded_at: '2026-11-01T10:00:00Z', reviewed_at: null, ...over,
});
const chk = (over: Partial<MemberCheck>): MemberCheck => ({
  id: 'c1', kind: 'identity', title: null, provider_id: null, checked_at: '2026-11-02T10:00:00Z', valid_until: null, ended_at: null, ...over,
});

describe('documentSlots', () => {
  it('guides send NIDA, licence, first aid or WFR, optional driving licence', () => {
    const kinds = documentSlots({ guide: true, business: false, tanzanian: true }).map((s) => s.kind);
    expect(kinds).toEqual(['identity', 'guide_licence', 'first_aid', 'wfr', 'driving_licence', 'other']);
  });
  it('non-Tanzanian business owners send no NIDA and never a passport image', () => {
    const kinds = documentSlots({ guide: false, business: true, tanzanian: false }).map((s) => s.kind);
    expect(kinds).toEqual(['business_licence', 'tin_certificate', 'operator_licence', 'other']);
    expect(kinds.every((k) => uploadableDocumentKinds.includes(k))).toBe(true);
  });
});

describe('verificationSummary', () => {
  const today = '2026-11-22';
  it('nothing sent', () => {
    expect(verificationSummary([], [], today).state).toBe('none');
  });
  it('waiting', () => {
    expect(verificationSummary([doc({})], [], today)).toMatchObject({ state: 'waiting', waiting: 1 });
  });
  it('checked, active until the earliest end date', () => {
    const s = verificationSummary([doc({ review_state: 'accepted' })], [chk({}), chk({ id: 'c2', kind: 'guide_licence', valid_until: '2027-06-01' })], today);
    expect(s).toMatchObject({ state: 'checked', activeUntil: '2027-06-01' });
  });
  it('ending soon and expired', () => {
    expect(verificationSummary([], [chk({ valid_until: '2026-12-10' })], today).state).toBe('expiring');
    expect(verificationSummary([], [chk({ valid_until: '2026-11-21' })], today).state).toBe('expired');
  });
  it('rejected until a new upload of the same paper', () => {
    const rejected = doc({ review_state: 'rejected', review_reason: 'unreadable', reviewed_at: '2026-11-03T00:00:00Z' });
    expect(verificationSummary([rejected], [], today).state).toBe('rejected');
    const again = doc({ id: 'd2', uploaded_at: '2026-11-05T00:00:00Z' });
    expect(verificationSummary([rejected, again], [], today).state).toBe('waiting');
  });
});

describe('slotStatus and dates', () => {
  it('finds the newest upload and the current check of a paper', () => {
    const s = slotStatus('identity', null, [doc({}), doc({ id: 'd2', uploaded_at: '2026-11-09T00:00:00Z' })], [chk({ ended_at: '2026-11-03T00:00:00Z' })]);
    expect(s.latest?.id).toBe('d2');
    expect(s.check).toBeNull();
  });
  it('adds days and knows the Tanzanian date', () => {
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(tanzaniaToday(new Date('2026-11-22T22:30:00Z'))).toBe('2026-11-23');
  });
});

describe('detectDocumentFileType (security review L3)', () => {
  const b = (...v: number[]) => new Uint8Array(v);
  const text = (s: string) => new TextEncoder().encode(s);
  it('knows JPEG, PNG, WebP and PDF by their first bytes', () => {
    expect(detectDocumentFileType(b(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))?.contentType).toBe('image/jpeg');
    expect(detectDocumentFileType(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))?.contentType).toBe('image/png');
    expect(detectDocumentFileType(text('RIFF\x24\x00\x00\x00WEBPVP8 '))?.contentType).toBe('image/webp');
    expect(detectDocumentFileType(text('%PDF-1.7\n'))?.ext).toBe('pdf');
  });
  it('refuses anything else, including look-alikes', () => {
    expect(detectDocumentFileType(text('<!doctype html><html>'))).toBeNull();
    expect(detectDocumentFileType(text('RIFF\x24\x00\x00\x00WAVEfmt '))).toBeNull();
    expect(detectDocumentFileType(text('%PDF'))).toBeNull();
    expect(detectDocumentFileType(b(0x89, 0x50, 0x4e, 0x47))).toBeNull();
    expect(detectDocumentFileType(b(0xff, 0xd8))).toBeNull();
    expect(detectDocumentFileType(new Uint8Array())).toBeNull();
    expect(detectDocumentFileType(text(' %PDF-1.7'))).toBeNull();
  });
});
