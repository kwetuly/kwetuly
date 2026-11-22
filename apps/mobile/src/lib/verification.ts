import { VERIFICATION_NOTICE_VERSION, personDocumentPath, type MemberCheck, type MemberDocument, type PersonDocumentKind } from '@kwetuly/shared';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

// Member verification, the same tables and rules as the website's /dashboard/verification.
// Files go to the private `verification` bucket as {user}/{document}.{ext} BEFORE the row is inserted
// (the database refuses a row without its file). Identity numbers go only through the `identifiers`
// Edge Function with the person's own token; the app never keeps or shows a full number.

export type OwnDocument = MemberDocument & { path: string };
export type OwnIdentifiers = { nida_last3: string | null; passport_last3: string | null; passport_country: string | null; passport_valid_until: string | null };

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function bytesOf(uri: string) {
  return (await fetch(uri)).arrayBuffer();
}

export async function loadMyVerification(userId: string) {
  const [documents, checks, providers, ids, tins] = await Promise.all([
    supabase
      .from('person_documents')
      .select('id, kind, title, provider_id, path, review_state, review_reason, stated_valid_until, uploaded_at, reviewed_at')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })
      .limit(100),
    supabase.from('person_document_checks').select('id, kind, title, provider_id, checked_at, valid_until, ended_at').eq('user_id', userId).is('ended_at', null),
    supabase.from('providers').select('id, business_name').eq('owner_id', userId).order('created_at'),
    supabase.rpc('my_identifiers'),
    // Not applied yet (supabase/migrations/20261122000100_my_business_identifiers.sql): an error means "nothing saved".
    supabase.rpc('my_business_identifiers'),
  ]);
  check(documents.error);
  check(checks.error);
  check(providers.error);
  return {
    documents: (documents.data ?? []) as OwnDocument[],
    checks: (checks.data ?? []) as MemberCheck[],
    providers: ((providers.data ?? []) as { id: string; business_name: string }[]).map((p) => ({ id: p.id, name: p.business_name })),
    identifiers: ((ids.data ?? []) as OwnIdentifiers[])[0] ?? null,
    businessTins: Object.fromEntries(((tins.error ? [] : (tins.data ?? [])) as { provider_id: string; tin_last3: string }[]).map((r) => [r.provider_id, r.tin_last3])) as Record<string, string>,
  };
}

/** Error codes the screen turns into polite texts. */
export type UploadError = 'too_many' | 'not_onboarded' | 'upload' | 'generic';

export async function uploadDocument(input: {
  userId: string;
  kind: PersonDocumentKind;
  providerId: string | null;
  title: string | null;
  validUntil: string | null;
  file: { uri: string; mimeType: 'image/jpeg' };
}): Promise<UploadError | null> {
  const id = Crypto.randomUUID();
  const path = personDocumentPath(input.userId, id, 'jpg')!;
  const upload = await supabase.storage.from('verification').upload(path, await bytesOf(input.file.uri), { contentType: input.file.mimeType, upsert: false });
  if (upload.error) return 'upload';
  const { error } = await supabase.from('person_documents').insert({
    id,
    user_id: input.userId,
    provider_id: input.providerId,
    kind: input.kind,
    title: input.title,
    path,
    stated_valid_until: input.validUntil,
    notice_version: VERIFICATION_NOTICE_VERSION,
  });
  if (error) {
    // No row uses the file, so its owner may delete it again.
    await supabase.storage.from('verification').remove([path]).catch(() => undefined);
    return error.message.includes('Too many') ? 'too_many' : error.code === '42501' ? 'not_onboarded' : 'generic';
  }
  return null;
}

export async function withdrawDocument(doc: { id: string; path: string }) {
  const { error } = await supabase.rpc('withdraw_my_document', { p_document: doc.id });
  check(error);
  // The file of a withdrawn document may be deleted by its owner; the sweep does it otherwise.
  await supabase.storage.from('verification').remove([doc.path]).catch(() => undefined);
}

export type IdentifierField = 'nida' | 'passport' | 'business_tin';

/**
 * Saves or removes one number. Returns { last3 } or { error }; 'not_configured' while the function's
 * keys are not set (the screen then says "Number saving opens soon").
 */
export async function setIdentifier(
  action: 'set' | 'clear',
  field: IdentifierField,
  input: { value?: string; country?: string; validUntil?: string; providerId?: string | null },
): Promise<{ last3?: string; error?: string }> {
  const body =
    action === 'clear'
      ? { action, field, provider_id: input.providerId ?? null }
      : {
          action,
          field,
          provider_id: input.providerId ?? null,
          value: (input.value ?? '').slice(0, 40),
          country: field === 'passport' ? (input.country ?? '').slice(0, 2) : null,
          valid_until: field === 'passport' ? (input.validUntil ?? '').slice(0, 10) : null,
          notice_version: VERIFICATION_NOTICE_VERSION,
        };
  const { data, error } = await supabase.functions.invoke('identifiers', { body });
  if (!error) {
    const result = (data ?? {}) as { ok?: boolean; last3?: string; error?: string };
    return result.ok ? { last3: result.last3 } : { error: result.error ?? 'failed' };
  }
  const response = 'context' in error ? (error.context as Response | undefined) : undefined;
  const status = response?.status ?? 0;
  const code = ((await response?.json?.().catch(() => ({}))) ?? {}) as { error?: string };
  if (status === 503 || code.error === 'not_configured' || (status === 404 && !code.error)) return { error: 'not_configured' };
  return { error: code.error ?? 'failed' };
}

