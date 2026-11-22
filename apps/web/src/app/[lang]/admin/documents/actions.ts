'use server';

import { redirect } from 'next/navigation';
import { documentRejectReasons } from '@kwetuly/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Admin document review (person_documents). Every call runs with the admin's own two-step session; the
// database functions check private.is_admin() (aal2) again and do the work in one transaction.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function adminOnly(formData: FormData) {
  const value = String(formData.get('locale') ?? '');
  const locale = hasLocale(value) ? value : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  return { locale, back: `/${locale}/admin/documents` };
}

function done(back: string, params: Record<string, string>, anchor = ''): never {
  redirect(`${back}?${new URLSearchParams(params)}${anchor}`);
}

/** Short database message for the admin (English); never contains a number (notes are masked). */
const short = (message: string | undefined) => (message ?? 'failed').slice(0, 120);

/**
 * Opens one file: records "document opened" FIRST (admin_log_document_opened returns the path), then
 * signs that path for 60 seconds with the admin's own session (the storage policy and its aal2 check
 * decide). The link is never stored or shown on the page; the browser goes straight to it.
 */
export async function openDocument(formData: FormData) {
  const { back } = await adminOnly(formData);
  const id = String(formData.get('document_id') ?? '');
  if (!UUID.test(id)) done(back, { error: 'Unknown document' });
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc('admin_log_document_opened', { p_document: id });
  if (error || typeof path !== 'string') done(back, { error: short(error?.message) });
  const { data: signed } = await supabase.storage.from('verification').createSignedUrl(path, 60);
  if (!signed?.signedUrl) done(back, { error: 'The file could not be opened. If it is missing, reject it as unreadable.' }, `#doc-${id}`);
  redirect(signed.signedUrl);
}

export async function reviewDocument(formData: FormData) {
  const { back } = await adminOnly(formData);
  const id = String(formData.get('document_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  if (!UUID.test(id) || (decision !== 'accept' && decision !== 'reject')) done(back, { error: 'Unknown document' });
  const kind = String(formData.get('kind') ?? '');
  const dated = formData.get('dated') === '1';
  const validUntil = String(formData.get('valid_until') ?? '').trim();
  const reason = String(formData.get('reason') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 300) || null;
  if (decision === 'accept' && dated && !DATE.test(validUntil)) done(back, { error: 'Please enter the valid-until date printed on the document.' }, `#doc-${id}`);
  if (decision === 'reject' && !(documentRejectReasons as readonly string[]).includes(reason)) done(back, { error: 'Please choose a reason.' }, `#doc-${id}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_review_document', {
    p_document: id,
    p_decision: decision,
    p_valid_until: decision === 'accept' && DATE.test(validUntil) ? validUntil : null,
    // A NIDA card image is the only identity check method for uploads (M11); the other kinds have none.
    p_method: decision === 'accept' && kind === 'identity' ? 'nida_card' : null,
    p_reason: decision === 'reject' ? reason : null,
    p_note: note,
  });
  if (error) done(back, { error: short(error.message) }, `#doc-${id}`);
  done(back, { ok: decision === 'accept' ? 'Accepted. The check is recorded.' : 'Rejected. The person sees the reason.' });
}

export async function endCheck(formData: FormData) {
  const { back } = await adminOnly(formData);
  const id = String(formData.get('check_id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!UUID.test(id)) done(back, { error: 'Unknown check' }, '#checks');
  if (reason.length < 5 || reason.length > 300) done(back, { error: 'Please give a reason (5 to 300 characters).' }, '#checks');
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_end_check', { p_check: id, p_reason: reason });
  if (error) done(back, { error: short(error.message) }, '#checks');
  done(back, { ok: 'The check was ended.' }, '#checks');
}
