import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { datedDocumentKinds, documentRejectReasons, maskIdentifier, verificationText, type PersonDocumentKind } from '@kwetuly/shared';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { adminDate, adminDateTime, darToday, waitedFor } from '@/lib/admin-format';
import { SubmitButton } from '@/components/submit-button';
import { AdminMenu } from '../admin-menu';
import { endCheck, openDocument, reviewDocument } from './actions';

export const metadata: Metadata = { title: 'Documents', robots: { index: false } };

type WaitingDoc = {
  id: string;
  user_id: string;
  provider_id: string | null;
  kind: PersonDocumentKind;
  title: string | null;
  stated_valid_until: string | null;
  uploaded_at: string;
  profiles: { full_name: string | null; role: string } | null;
  providers: { business_name: string } | null;
};
type CurrentCheck = {
  id: string;
  user_id: string;
  kind: PersonDocumentKind;
  title: string | null;
  method: string | null;
  checked_at: string;
  valid_until: string | null;
  profiles: { full_name: string | null } | null;
  providers: { business_name: string } | null;
};
type Masked = { nida_last3: string | null; nida_duplicate: boolean; passport_last3: string | null; passport_country: string | null; passport_valid_until: string | null; passport_duplicate: boolean };

const REASONS: Record<(typeof documentRejectReasons)[number], string> = {
  unreadable: 'Unreadable',
  name_mismatch: 'Name does not match the profile',
  expired: 'Document has ended',
  wrong_document: 'Wrong document',
  not_complete: 'Not complete',
  other: 'Other (explain in the note)',
};

// Admin texts are English only (docs/design/admin-dashboard-layout.md). One card per waiting document:
// open the file (logged first, 60-second link), compare the name with the profile, then accept with the
// valid-until date or reject with a reason. Never "approve all". No AI or OCR reads these files.
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <div className="min-w-0">
          <Link href={`/${locale}/admin`} className="text-sm font-semibold text-forest underline">Admin</Link>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Documents to check</h1>
          <p className="mt-1 text-muted">Guides and business owners, one document at a time. Opening a file is recorded.</p>
          <Suspense fallback={<div aria-busy="true" className="mt-6 h-96 animate-pulse rounded-[5px] bg-line" />}>
            <Content locale={locale} searchParams={searchParams} />
          </Suspense>
        </div>
        <div className="lg:order-first lg:border-r lg:border-line lg:pr-6">
          <AdminMenu locale={locale} current={`/${locale}/admin/documents`} />
        </div>
      </div>
    </div>
  );
}

async function Content({ locale, searchParams }: { locale: Locale; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdmin(locale);
  const params = await searchParams;
  const ok = typeof params.ok === 'string' ? params.ok.slice(0, 200) : '';
  const error = typeof params.error === 'string' ? params.error.slice(0, 200) : '';
  const supabase = await createClient();
  const [waiting, checks] = await Promise.all([
    supabase
      .from('person_documents')
      .select('id, user_id, provider_id, kind, title, stated_valid_until, uploaded_at, profiles(full_name, role), providers(business_name)')
      .eq('review_state', 'waiting')
      .order('uploaded_at')
      .limit(50)
      .returns<WaitingDoc[]>(),
    supabase
      .from('person_document_checks')
      .select('id, user_id, kind, title, method, checked_at, valid_until, profiles(full_name), providers(business_name)')
      .is('ended_at', null)
      .order('checked_at', { ascending: false })
      .limit(50)
      .returns<CurrentCheck[]>(),
  ]);
  if (waiting.error || checks.error) {
    return (
      <div role="alert" className="card mt-6 space-y-3">
        <p>The documents could not be loaded. Please try again.</p>
        <Link href={`/${locale}/admin/documents`} className="btn-outline">Try again</Link>
      </div>
    );
  }
  const docs = waiting.data ?? [];
  // Masked numbers (last 3 characters, duplicate flag) for the people on this page. Full numbers are
  // read only through the identifiers Edge Function, which is not switched on yet.
  const people = [...new Set(docs.map((d) => d.user_id))];
  const masked = new Map<string, Masked | null>();
  await Promise.all(
    people.map(async (id) => {
      const { data } = await supabase.rpc('admin_identifiers_masked', { p_user: id });
      masked.set(id, ((data ?? []) as Masked[])[0] ?? null);
    }),
  );
  const providerIds = [...new Set(docs.map((d) => d.provider_id).filter((p): p is string => Boolean(p)))];
  const tins = new Map<string, string | null>();
  await Promise.all(
    providerIds.map(async (id) => {
      const { data } = await supabase.rpc('admin_business_identifiers_masked', { p_provider: id });
      tins.set(id, ((data ?? []) as { tin_last3: string }[])[0]?.tin_last3 ?? null);
    }),
  );
  const v = verificationText('en');
  const today = darToday();
  const now = new Date();

  return (
    <div className="mt-6 space-y-8">
      {ok && <p role="status" className="rounded-[5px] bg-mint p-3 font-semibold text-forest">{ok}</p>}
      {error && <p role="alert" className="rounded-[5px] bg-red-50 p-3 font-semibold text-red-800">{error}</p>}

      <section aria-labelledby="queue-title" className="space-y-4">
        <h2 id="queue-title" className="text-xl font-bold">Waiting ({docs.length})</h2>
        {docs.length === 0 && <p className="card text-muted">Nothing is waiting. Thank you.</p>}
        {docs.map((d) => {
          const dated = (datedDocumentKinds as readonly string[]).includes(d.kind);
          const late = now.getTime() - new Date(d.uploaded_at).getTime() > 30 * 86_400_000;
          const own = d.user_id === admin.id;
          const ids = masked.get(d.user_id);
          return (
            <article key={d.id} id={`doc-${d.id}`} className="card scroll-mt-28 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold">{d.title ? `${v.kinds[d.kind]}: ${d.title}` : v.kinds[d.kind]}</h3>
                  <p className="font-semibold">{d.profiles?.full_name ?? 'No name on the profile'} <span className="font-normal text-muted">({d.profiles?.role ?? 'unknown role'})</span></p>
                  {d.providers && <p className="text-sm text-muted">Business: {d.providers.business_name}{d.provider_id && tins.get(d.provider_id) ? `, TIN ${maskIdentifier(tins.get(d.provider_id))}` : ''}</p>}
                </div>
                <p className={`rounded-[5px] px-2 py-1 text-sm font-bold ${late ? 'bg-red-50 text-red-800' : 'bg-sand'}`}>Waiting {waitedFor(d.uploaded_at, now)}</p>
              </div>
              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div><dt className="inline text-muted">Sent: </dt><dd className="inline">{adminDateTime(d.uploaded_at)}</dd></div>
                <div><dt className="inline text-muted">Valid until (stated): </dt><dd className="inline">{d.stated_valid_until ? adminDate(`${d.stated_valid_until}T12:00:00Z`) : 'not given'}</dd></div>
                <div>
                  <dt className="inline text-muted">NIDA number: </dt>
                  <dd className="inline">{ids?.nida_last3 ? `${maskIdentifier(ids.nida_last3)}${ids.nida_duplicate ? ' (also on another account)' : ''}` : 'not saved'}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Passport: </dt>
                  <dd className="inline">{ids?.passport_last3 ? `${maskIdentifier(ids.passport_last3)}, ${ids.passport_country}, until ${ids.passport_valid_until}${ids.passport_duplicate ? ' (also on another account)' : ''}` : 'not saved'}</dd>
                </div>
              </dl>

              <form action={openDocument}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="document_id" value={d.id} />
                <SubmitButton className="btn-outline">Open the file (60 seconds)</SubmitButton>
              </form>

              {own ? (
                <p className="rounded-[5px] bg-sand p-3 text-sm">This is your own document. Another admin must review it.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <form action={reviewDocument} className="space-y-3 rounded-[5px] bg-mint/50 p-3">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="document_id" value={d.id} />
                    <input type="hidden" name="kind" value={d.kind} />
                    <input type="hidden" name="decision" value="accept" />
                    <input type="hidden" name="dated" value={dated ? '1' : '0'} />
                    {dated && (
                      <div>
                        <label htmlFor={`until-${d.id}`} className="label">Valid until, as printed</label>
                        <input id={`until-${d.id}`} name="valid_until" type="date" required min={today} defaultValue={d.stated_valid_until ?? ''} className="field" />
                      </div>
                    )}
                    {d.kind === 'identity' && <p className="text-sm text-muted">Method: NIDA card image seen.</p>}
                    <div>
                      <label htmlFor={`anote-${d.id}`} className="label">Note (optional, no numbers)</label>
                      <input id={`anote-${d.id}`} name="note" maxLength={300} className="field" />
                    </div>
                    <SubmitButton className="btn w-full">Accept</SubmitButton>
                  </form>
                  <form action={reviewDocument} className="space-y-3 rounded-[5px] bg-surface p-3">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="document_id" value={d.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <div>
                      <label htmlFor={`reason-${d.id}`} className="label">Reason</label>
                      <select id={`reason-${d.id}`} name="reason" required defaultValue="" className="field">
                        <option value="" disabled>Choose a reason</option>
                        {documentRejectReasons.map((r) => (
                          <option key={r} value={r}>{REASONS[r]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`rnote-${d.id}`} className="label">Note (optional, no numbers)</label>
                      <input id={`rnote-${d.id}`} name="note" maxLength={300} className="field" />
                    </div>
                    <SubmitButton className="btn-outline w-full">Reject</SubmitButton>
                  </form>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <section id="checks" aria-labelledby="checks-title" className="scroll-mt-28 space-y-4">
        <h2 id="checks-title" className="text-xl font-bold">Current checks ({checks.data?.length ?? 0})</h2>
        <p className="text-sm text-muted">End a check only when something is wrong with it (for example a licence was withdrawn). The person is not told the reason.</p>
        {(checks.data ?? []).length === 0 && <p className="card text-muted">No current checks yet.</p>}
        {(checks.data ?? []).map((c) => (
          <article key={c.id} className="card space-y-3">
            <div>
              <h3 className="font-bold">{c.title ? `${v.kinds[c.kind]}: ${c.title}` : v.kinds[c.kind]}</h3>
              <p className="text-sm">{c.profiles?.full_name ?? 'No name'}{c.providers ? `, ${c.providers.business_name}` : ''}</p>
              <p className="text-sm text-muted">
                Checked {adminDate(c.checked_at)}{c.valid_until ? `, valid until ${adminDate(`${c.valid_until}T12:00:00Z`)}` : ''}{c.method === 'nida_card' ? ', NIDA card seen' : ''}
              </p>
            </div>
            <form action={endCheck} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="check_id" value={c.id} />
              <div className="min-w-0 flex-1">
                <label htmlFor={`end-${c.id}`} className="label">Reason for ending (5 to 300 characters)</label>
                <input id={`end-${c.id}`} name="reason" required minLength={5} maxLength={300} className="field" />
              </div>
              <SubmitButton className="btn-outline">End check</SubmitButton>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
