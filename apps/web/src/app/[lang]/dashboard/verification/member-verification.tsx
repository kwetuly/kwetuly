'use client';

import { createContext, use, useActionState, useId, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, FileText, Loader2, ShieldCheck } from 'lucide-react';
import {
  VERIFICATION_NOTICE_VERSION,
  datedDocumentKinds,
  documentSlots,
  fillText,
  personDocumentPath,
  slotStatus,
  verificationText,
  type DocumentSlot,
  type MemberCheck,
  type MemberDocument,
  type PersonDocumentKind,
  type VerificationText,
} from '@kwetuly/shared';
import { createClient } from '@/lib/supabase/client';
import { cleanImage, needsCleaning } from '@/lib/clean-image';
import { saveIdentifier, type IdentifierResult } from './actions';
import { formatDay } from './format';

export type OwnDocument = MemberDocument & { path: string };
export type OwnIdentifiers = { nida_last3: string | null; passport_last3: string | null; passport_country: string | null; passport_valid_until: string | null };

type Props = {
  userId: string;
  locale: string;
  today: string;
  guide: boolean;
  business: boolean;
  providers: { id: string; name: string }[];
  documents: OwnDocument[];
  checks: MemberCheck[];
  identifiers: OwnIdentifiers | null;
  businessTins: Record<string, string>;
};

const MAX_MB = 15; // the verification bucket's limit
const MAX_SIDE = 2000; // px; enough to read a card or certificate, small enough for mobile data
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const ConsentContext = createContext(false);


// Uploads go straight from the browser to the private `verification` bucket ({user}/{document}.{ext}),
// then the row is inserted with the browser client (owner insert, column grants). Order matters: the
// database refuses a row whose file is not there yet. Photos are redrawn first, so no location data leaves.
export function MemberVerification(props: Props) {
  const v = verificationText(props.locale);
  const [consent, setConsent] = useState(false);
  // Non-Tanzanian business owners give a passport number instead of a NIDA card (decision 2026-11-21, 6).
  const [tanzanian, setTanzanian] = useState(props.guide || !props.identifiers?.passport_last3);
  const slots = documentSlots({ guide: props.guide, business: props.business, tanzanian });

  return (
    <ConsentContext value={consent}>
      <section aria-labelledby="privacy-title" className="card space-y-3">
        <h2 id="privacy-title" className="flex items-center gap-2 text-lg font-bold">
          <ShieldCheck className="size-5 text-leaf-dark" aria-hidden /> {v.noticeTitle}
        </h2>
        <p className="text-sm text-muted">{v.noticeBody}</p>
        <Link href={`/${props.locale}/privacy`} className="text-sm font-semibold text-forest underline">{v.noticeLink}</Link>
        <label className="flex items-start gap-3 rounded-[5px] bg-surface p-3 font-semibold">
          <input type="checkbox" className="mt-1 size-5 accent-[#1D951A]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>{v.noticeAgree}</span>
        </label>
      </section>

      {!props.guide && props.business && (
        <fieldset className="card">
          <legend className="sr-only">{v.citizenQuestion}</legend>
          <p className="font-bold" aria-hidden>{v.citizenQuestion}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {[true, false].map((value) => (
              <label key={String(value)} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-[5px] border px-4 ${tanzanian === value ? 'border-leaf bg-mint text-forest' : 'border-line bg-white'}`}>
                <input type="radio" name="citizen" className="accent-[#1D951A]" checked={tanzanian === value} onChange={() => setTanzanian(value)} />
                <span className="font-semibold">{value ? v.citizenYes : v.citizenNo}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="space-y-4">
        {slots.flatMap((slot) => {
          const isBusinessKind = slot.kind === 'business_licence' || slot.kind === 'tin_certificate' || slot.kind === 'operator_licence';
          if (!isBusinessKind) return [<DocumentCard key={slot.kind} slot={slot} providerId={null} providerName={null} {...props} v={v} />];
          if (props.providers.length === 0) return [<NoBusinessCard key={slot.kind} slot={slot} v={v} />];
          return props.providers.map((p) => (
            <DocumentCard key={`${slot.kind}-${p.id}`} slot={slot} providerId={p.id} providerName={props.providers.length > 1 ? p.name : null} {...props} v={v} />
          ));
        })}
      </div>

      <IdentityNumbers {...props} tanzanian={tanzanian} v={v} />
    </ConsentContext>
  );
}

function SlotHeader({ slot, v, providerName }: { slot: DocumentSlot; v: VerificationText; providerName: string | null }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 font-bold">
          <FileText className="size-5 shrink-0 text-leaf-dark" aria-hidden /> {v.kinds[slot.kind]}
        </h3>
        {providerName && <p className="text-sm font-semibold text-muted">{providerName}</p>}
        <p className="mt-1 text-sm text-muted">{v.kindHints[slot.kind]}</p>
      </div>
      <span className={`rounded-[5px] px-2 py-0.5 text-xs font-bold ${slot.required ? 'bg-sand text-charcoal' : 'bg-surface text-muted'}`}>{slot.required ? v.required : v.optional}</span>
    </div>
  );
}

function NoBusinessCard({ slot, v }: { slot: DocumentSlot; v: VerificationText }) {
  return (
    <article className="card space-y-3">
      <SlotHeader slot={slot} v={v} providerName={null} />
      <p className="rounded-[5px] bg-sand p-3 text-sm">{v.errors.noBusiness}</p>
    </article>
  );
}

function DocumentCard({ slot, providerId, providerName, v, ...props }: Props & { slot: DocumentSlot; providerId: string | null; providerName: string | null; v: VerificationText }) {
  const { latest, all, check } = slotStatus(slot.kind, providerId, props.documents, props.checks);
  const other = slot.kind === 'other';
  const waiting = !other && latest?.review_state === 'waiting';
  return (
    <article className="card space-y-3">
      <SlotHeader slot={slot} v={v} providerName={providerName} />
      {!other && check && (
        <p className="flex flex-wrap items-center gap-x-2 rounded-[5px] bg-mint p-3 text-sm font-semibold text-forest" suppressHydrationWarning>
          <CheckCircle2 className="size-4" aria-hidden />
          <span>{fillText(v.checkedOn, { date: formatDay(check.checked_at, props.locale) })}</span>
          {check.valid_until && <span>· {fillText(v.validUntil, { date: formatDay(check.valid_until, props.locale) })}</span>}
        </p>
      )}
      {(other ? all : latest ? [latest] : []).map((doc) => (
        <DocumentLine key={doc.id} doc={doc as OwnDocument} v={v} locale={props.locale} />
      ))}
      {!waiting && <UploadForm slot={slot} providerId={providerId} again={Boolean(latest) && !other} v={v} {...props} />}
    </article>
  );
}

function DocumentLine({ doc, v, locale }: { doc: OwnDocument; v: VerificationText; locale: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tone = doc.review_state === 'accepted' ? 'bg-mint text-forest' : doc.review_state === 'rejected' ? 'bg-red-50 text-red-800' : 'bg-surface';

  async function withdraw() {
    if (!window.confirm(v.withdrawConfirm)) return;
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('withdraw_my_document', { p_document: doc.id });
    if (rpcError) {
      setBusy(false);
      return setError(v.errors.generic);
    }
    // The file of a withdrawn document may be deleted by its owner (M1); the sweep does it otherwise.
    await supabase.storage.from('verification').remove([doc.path]).catch(() => undefined);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className={`space-y-1 rounded-[5px] p-3 text-sm ${tone}`}>
      {doc.title && <p className="font-bold">{doc.title}</p>}
      <p className="font-semibold">{v.states[doc.review_state]}</p>
      <p suppressHydrationWarning>
        {fillText(v.sentOn, { date: formatDay(doc.uploaded_at, locale) })}
        {doc.stated_valid_until && ` · ${fillText(v.validUntil, { date: formatDay(doc.stated_valid_until, locale) })}`}
      </p>
      {doc.review_state === 'rejected' && doc.review_reason && <p>{v.reasons[doc.review_reason]}</p>}
      {doc.review_state === 'waiting' && (
        <button type="button" onClick={withdraw} disabled={busy} className="mt-1 font-semibold text-forest underline disabled:opacity-60">
          {busy ? <Loader2 className="inline size-4 animate-spin" aria-label={v.withdraw} /> : v.withdraw}
        </button>
      )}
      {error && <p role="alert" className="text-red-800">{error}</p>}
    </div>
  );
}

function UploadForm({ slot, providerId, again, v, userId, today }: Props & { slot: DocumentSlot; providerId: string | null; again: boolean; v: VerificationText }) {
  const router = useRouter();
  const consent = use(ConsentContext);
  const id = useId();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');
  const dated = (datedDocumentKinds as readonly PersonDocumentKind[]).includes(slot.kind);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get('file');
    const validUntil = String(data.get('valid_until') ?? '').trim();
    const title = String(data.get('title') ?? '').trim();
    setError('');
    if (!consent) return setError(v.errors.consent);
    if (!(file instanceof File) || file.size === 0) return setError(v.errors.file);
    if (!TYPES[file.type] && !needsCleaning(file)) return setError(v.errors.fileType);
    if (slot.kind === 'other' && (title.length < 2 || title.length > 80)) return setError(v.errors.title);
    if (dated && !DATE.test(validUntil)) return setError(v.errors.date);
    if (dated && validUntil < today) return setError(v.errors.datePast);
    setState('busy');

    let body: Blob = file;
    if (needsCleaning(file)) {
      try {
        body = await cleanImage(file, { maxSide: MAX_SIDE });
      } catch {
        setState('idle');
        return setError(v.errors.fileType);
      }
    }
    const ext = TYPES[body.type];
    if (!ext) {
      setState('idle');
      return setError(v.errors.fileType);
    }
    if (body.size > MAX_MB * 1024 * 1024) {
      setState('idle');
      return setError(v.errors.fileSize);
    }
    const documentId = crypto.randomUUID();
    const path = personDocumentPath(userId, documentId, ext)!;
    const supabase = createClient();
    const upload = await supabase.storage.from('verification').upload(path, body, { contentType: body.type, upsert: false });
    if (upload.error) {
      setState('idle');
      return setError(v.errors.upload);
    }
    const { error: insertError } = await supabase.from('person_documents').insert({
      id: documentId,
      user_id: userId,
      provider_id: providerId,
      kind: slot.kind,
      title: slot.kind === 'other' ? title : null,
      path,
      stated_valid_until: dated ? validUntil : null,
      notice_version: VERIFICATION_NOTICE_VERSION,
    });
    if (insertError) {
      // No row uses the file, so its owner may delete it again.
      await supabase.storage.from('verification').remove([path]).catch(() => undefined);
      setState('idle');
      const message = insertError.message ?? '';
      return setError(message.includes('Too many') ? v.errors.tooMany : insertError.code === '42501' ? v.errors.notOnboarded : v.errors.generic);
    }
    form.reset();
    setState('done');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-line pt-3" noValidate>
      <div>
        <label htmlFor={`${id}-file`} className="label">{v.file}</label>
        <input id={`${id}-file`} name="file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="field" />
      </div>
      {slot.kind === 'other' && (
        <div>
          <label htmlFor={`${id}-title`} className="label">{v.titleLabel}</label>
          <input id={`${id}-title`} name="title" className="field" maxLength={80} placeholder={v.titleHint} />
        </div>
      )}
      {dated && (
        <div>
          <label htmlFor={`${id}-date`} className="label">{v.validUntilLabel}</label>
          <input id={`${id}-date`} name="valid_until" type="date" min={today} className="field" aria-describedby={`${id}-date-hint`} />
          <p id={`${id}-date-hint`} className="mt-1 text-xs text-muted">{v.dateHint}</p>
        </div>
      )}
      {error && <p role="alert" className="rounded-[5px] bg-red-50 p-2 text-sm text-red-800">{error}</p>}
      {state === 'done' && (
        <p role="status" className="flex items-center gap-1.5 text-sm font-semibold text-forest"><CheckCircle2 className="size-4" aria-hidden /> {v.sent}</p>
      )}
      <button type="submit" className="btn-outline w-full sm:w-auto" disabled={state === 'busy'}>
        {state === 'busy' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {again ? v.sendAgain : v.send}
      </button>
    </form>
  );
}

function IdentityNumbers({ v, identifiers, providers, businessTins, business, tanzanian, locale }: Props & { v: VerificationText; tanzanian: boolean }) {
  return (
    <section aria-labelledby="ids-title" className="card space-y-4">
      <div>
        <h2 id="ids-title" className="text-lg font-bold">{v.idTitle}</h2>
        <p className="mt-1 text-sm text-muted">{v.idBody}</p>
      </div>
      {tanzanian ? (
        <NumberForm field="nida" v={v} label={v.nida} hint={v.nidaHint} last3={identifiers?.nida_last3 ?? null} inputMode="numeric" />
      ) : (
        <NumberForm field="passport" v={v} label={v.passport} last3={identifiers?.passport_last3 ?? null}>
          {(fieldId) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${fieldId}-country`} className="label">{v.passportCountry}</label>
                <input id={`${fieldId}-country`} name="country" className="field uppercase" maxLength={2} autoComplete="off" defaultValue={identifiers?.passport_country ?? ''} aria-describedby={`${fieldId}-country-hint`} />
                <p id={`${fieldId}-country-hint`} className="mt-1 text-xs text-muted">{v.passportCountryHint}</p>
              </div>
              <div>
                <label htmlFor={`${fieldId}-expiry`} className="label">{v.passportExpiry}</label>
                <input id={`${fieldId}-expiry`} name="valid_until" type="date" className="field" defaultValue={identifiers?.passport_valid_until ?? ''} />
                {identifiers?.passport_valid_until && <p className="mt-1 text-xs text-muted" suppressHydrationWarning>{fillText(v.validUntil, { date: formatDay(identifiers.passport_valid_until, locale) })}</p>}
              </div>
            </div>
          )}
        </NumberForm>
      )}
      {business &&
        providers.map((p) => (
          <NumberForm key={p.id} field="business_tin" providerId={p.id} v={v} label={fillText(v.tin, { business: p.name })} hint={v.tinHint} last3={businessTins[p.id] ?? null} inputMode="numeric" />
        ))}
    </section>
  );
}

function NumberForm({
  field,
  providerId,
  v,
  label,
  hint,
  last3,
  inputMode,
  children,
}: {
  field: 'nida' | 'passport' | 'business_tin';
  providerId?: string;
  v: VerificationText;
  label: string;
  hint?: string;
  last3: string | null;
  inputMode?: 'numeric';
  children?: (fieldId: string) => ReactNode;
}) {
  const consent = use(ConsentContext);
  const id = useId();
  const [result, action, pending] = useActionState<IdentifierResult, FormData>(saveIdentifier, null);
  const saved = result?.ok ? (result.cleared ? null : (result.last3 ?? last3)) : last3;
  const errorText = (code: string) =>
    code === 'consent' ? v.errors.consent : (v.numberErrors as Record<string, string>)[code] ?? v.errors.generic;

  return (
    <form action={action} className="space-y-3 border-t border-line pt-4 first-of-type:border-0 first-of-type:pt-0">
      <input type="hidden" name="field" value={field} />
      {providerId && <input type="hidden" name="provider_id" value={providerId} />}
      <input type="hidden" name="consent" value={consent ? 'yes' : 'no'} />
      <div>
        <label htmlFor={`${id}-value`} className="label">{label}</label>
        {/* Never prefilled and never autocompleted: the number is sent once and not kept in the page. */}
        <input id={`${id}-value`} name="value" className="field" autoComplete="off" inputMode={inputMode} maxLength={40} aria-describedby={hint ? `${id}-hint` : undefined} />
        {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      {children?.(id)}
      {saved && <p className="text-sm font-semibold text-forest">{fillText(v.savedEnding, { last3: saved })}</p>}
      {result?.ok && <p role="status" className="text-sm font-semibold text-forest">{result.cleared ? v.numberRemoved : v.numberSaved}</p>}
      {result && !result.ok && result.error === 'not_configured' && <p role="status" className="rounded-[5px] bg-sand p-3 text-sm font-semibold">{v.numbersSoon}</p>}
      {result && !result.ok && result.error !== 'not_configured' && <p role="alert" className="rounded-[5px] bg-red-50 p-2 text-sm text-red-800">{errorText(result.error)}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="set" className="btn-outline" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} {v.save}
        </button>
        {saved && (
          <button type="submit" name="intent" value="clear" className="min-h-12 px-2 font-semibold text-forest underline" disabled={pending}>
            {v.remove}
          </button>
        )}
      </div>
    </form>
  );
}
