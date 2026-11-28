'use client';

// One photo field (slice S4, design section 9.2): avatar (1, square crop), cover (1, wide crop),
// gallery (up to 12) or product (up to 10). Pick with the button, drag and drop, or paste. Each file
// is shrunk and saved as WebP in the browser (location data removed), then uploaded with its own
// progress bar; "Try again" per file. Order by dragging, or with "Move earlier", "Move later" and
// "Make main photo" (no arrows). Photos keep their width and height, so the page does not jump.
import Image from 'next/image';
import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import {
  UPLOAD_SPECS,
  acceptAttribute,
  checkPickedFile,
  fillText,
  makeMain,
  mediaPublicUrl,
  moveItem,
  remainingSlots,
  uploadsText,
  type CropRect,
  type MediaField as Field,
  type MediaItem,
  type MediaSubjectKind,
} from '@kwetuly/shared';
import { removeMedia, reorderMedia } from '@/lib/media';
import { CropDialog } from './crop-dialog';
import { useUploadQueue } from './use-upload-queue';

type Props = {
  field: Field;
  subjectKind: MediaSubjectKind;
  subjectId: string;
  initial: MediaItem[];
  locale: string;
  supabaseUrl: string;
  /** Heading level id, for pages with several fields. */
  id?: string;
  /** Outline "Choose" button, for screens whose one main action is another button (sign-up step 5). */
  outline?: boolean;
};

type Message = { tone: 'ok' | 'error'; text: string } | null;

export function MediaField({ field, subjectKind, subjectId, initial, locale, supabaseUrl, id = `media-${field}`, outline = false }: Props) {
  const t = uploadsText(locale);
  const spec = UPLOAD_SPECS[field];
  const single = spec.maxCount === 1;
  const [items, setItems] = useState<MediaItem[]>(() => [...initial].sort((a, b) => a.sort - b.sort));
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [cropping, setCropping] = useState<File | null>(null);
  const [dropping, setDropping] = useState(false);
  const [saving, setSaving] = useState(false);
  const dragFrom = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const queue = useUploadQueue({
    field,
    subjectKind,
    subjectId,
    onDone: (item, replaced) => {
      setItems((list) => [...list.filter((i) => i.id !== item.id && !replaced.includes(i.path)), item].sort((a, b) => a.sort - b.sort));
      setMessage({ tone: 'ok', text: t.uploaded });
    },
  });

  const used = items.length + (single ? 0 : queue.items.length);
  const left = single ? 1 : remainingSlots(field, used);

  function accept(files: File[]) {
    setMessage(null);
    if (!files.length) return;
    if (spec.needsConsent && !consent) return setMessage({ tone: 'error', text: t.consentNeeded });
    if (!single && left <= 0) return setMessage({ tone: 'error', text: fillText(t.full, { max: spec.maxCount }) });
    const picked = single ? files.slice(0, 1) : files.slice(0, left);
    for (const file of picked) {
      const problem = checkPickedFile(file, field);
      if (problem) return setMessage({ tone: 'error', text: t.picked[problem] });
    }
    if (spec.cropFixed && spec.cropAspect) return setCropping(picked[0]);
    queue.add(picked.map((file) => ({ file })), consent);
  }

  async function saveOrder(next: MediaItem[]) {
    const before = items;
    setItems(next);
    setSaving(true);
    const result = await reorderMedia({ subjectKind, subjectId, field, ids: next.map((i) => i.id) }).catch(() => ({ ok: false as const, error: 'network' as const }));
    setSaving(false);
    if (!result.ok) {
      setItems(before);
      return setMessage({ tone: 'error', text: t.errors[result.error] });
    }
    setItems(next.map((i, index) => ({ ...i, sort: index, is_main: index === 0 })));
    setMessage({ tone: 'ok', text: t.orderSaved });
  }

  async function remove(item: MediaItem) {
    if (!window.confirm(t.removeConfirm)) return;
    setMessage(null);
    const result = await removeMedia(item.id).catch(() => ({ ok: false as const, error: 'network' as const }));
    if (!result.ok) return setMessage({ tone: 'error', text: t.errors[result.error] });
    setItems((list) => list.filter((i) => i.id !== item.id).map((i, index) => ({ ...i, is_main: index === 0 })));
    setMessage({ tone: 'ok', text: t.removed });
  }

  const fieldText = t.fields[field];
  const aspect = spec.cropAspect && spec.cropFixed ? spec.cropAspect : 4 / 3;
  const describedBy = `${id}-hint`;

  return (
    <section aria-labelledby={`${id}-title`} className="card space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-title`} className="text-xl font-bold">{fieldText.title}</h2>
        {!single && <p className="text-sm text-muted">{fillText(t.count, { n: items.length, max: spec.maxCount })}</p>}
      </div>
      <p id={describedBy} className="text-sm text-muted">{fillText(fieldText.hint, { max: spec.maxCount })}</p>

      {items.length === 0 && queue.items.length === 0 && <p className="rounded-[5px] bg-surface p-4 text-sm text-muted">{t.empty}</p>}

      {items.length > 0 && (
        <>
          {!single && items.length > 1 && <p className="text-sm text-muted">{t.dragHint}</p>}
          <ul className={single ? '' : 'grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3'} aria-busy={saving}>
            {items.map((item, index) => (
              <li
                key={item.id}
                draggable={!single && !saving}
                onDragStart={(event) => {
                  dragFrom.current = index;
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(event) => {
                  if (dragFrom.current !== null) event.preventDefault();
                }}
                onDrop={(event) => {
                  if (dragFrom.current === null) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const from = dragFrom.current;
                  dragFrom.current = null;
                  if (from !== index) void saveOrder(moveItem(items, from, index));
                }}
                onDragEnd={() => (dragFrom.current = null)}
                className="space-y-2"
              >
                <div className="relative overflow-hidden rounded-[5px] border border-line" style={{ aspectRatio: `${aspect}`, backgroundColor: item.placeholder ?? '#eeece7' }}>
                  {spec.bucket === 'media' && (
                    <Image
                      src={mediaPublicUrl(supabaseUrl, single ? item.path : (item.thumb_path ?? item.path))}
                      alt={field === 'cover' ? t.coverAlt : field === 'avatar' ? t.avatarAlt : fillText(t.photoAlt, { n: index + 1 })}
                      width={item.width ?? 1600}
                      height={item.height ?? 1200}
                      unoptimized
                      sizes={single ? '(max-width: 768px) 100vw, 720px' : '(max-width: 640px) 50vw, 240px'}
                      className="size-full object-cover"
                    />
                  )}
                  {!single && item.is_main && <span className="absolute left-2 top-2 rounded-[5px] bg-gold px-2 py-0.5 text-xs font-semibold text-charcoal">{t.mainPhoto}</span>}
                </div>
                <p className="text-xs text-muted">{item.state === 'checked' ? t.stateChecked : item.state === 'pending' ? t.statePending : t.stateLive}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  {!single && index > 0 && (
                    <button type="button" className="font-semibold text-forest underline disabled:opacity-60" disabled={saving} onClick={() => saveOrder(moveItem(items, index, index - 1))}>{t.moveEarlier}</button>
                  )}
                  {!single && index < items.length - 1 && (
                    <button type="button" className="font-semibold text-forest underline disabled:opacity-60" disabled={saving} onClick={() => saveOrder(moveItem(items, index, index + 1))}>{t.moveLater}</button>
                  )}
                  {!single && index > 0 && (
                    <button type="button" className="font-semibold text-forest underline disabled:opacity-60" disabled={saving} onClick={() => saveOrder(makeMain(items, item.id))}>{t.makeMain}</button>
                  )}
                  <button type="button" className="font-semibold text-red-700 underline" onClick={() => remove(item)} aria-label={`${t.remove}: ${field === 'cover' ? t.coverAlt : fillText(t.photoAlt, { n: index + 1 })}`}>{t.remove}</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {queue.items.length > 0 && (
        <ul className="space-y-3" aria-label={fieldText.title}>
          {queue.items.map((item) => (
            <li key={item.key} className="flex items-center gap-3 rounded-[5px] border border-line p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview (blob: URL) */}
              <img src={item.preview} alt="" width={56} height={56} className="size-14 shrink-0 rounded-[5px] bg-surface object-cover" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="flex items-center gap-1.5 text-sm text-muted" aria-live="polite">
                  {['preparing', 'uploading', 'finishing'].includes(item.status) && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {item.status === 'failed' ? (
                    <span className="text-red-700">{t.queue.failed}. {item.error ? t.errors[item.error] : ''}</span>
                  ) : (
                    fillText(t.queue[item.status], { percent: item.progress })
                  )}
                </p>
                <div
                  role="progressbar"
                  aria-label={fillText(t.progressLabel, { name: item.name })}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.progress}
                  className="h-2 overflow-hidden rounded-[4px] bg-line"
                >
                  <div className={`h-full rounded-[4px] transition-[width] ${item.status === 'failed' ? 'bg-red-700' : 'bg-leaf'}`} style={{ width: `${item.progress}%` }} />
                </div>
              </div>
              {item.status === 'failed' && (
                <div className="flex shrink-0 flex-col gap-1 text-sm">
                  <button type="button" className="font-semibold text-forest underline" onClick={() => queue.retry(item.key)}>{t.retry}</button>
                  <button type="button" className="font-semibold text-muted underline" onClick={() => queue.dismiss(item.key)}>{t.cancel}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {spec.needsConsent && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-forest" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>
            <span className="font-semibold">{t.consent}</span> <span className="text-muted">{t.consentHint}</span>
          </span>
        </label>
      )}

      {(single || left > 0) && (
        <div
          tabIndex={0}
          aria-describedby={describedBy}
          onPaste={(event) => {
            const files = [...event.clipboardData.files].filter((f) => f.type.startsWith('image/'));
            if (files.length) {
              event.preventDefault();
              accept(files);
            }
          }}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes('Files')) return;
            event.preventDefault();
            setDropping(true);
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(event) => {
            if (!event.dataTransfer.types.includes('Files')) return;
            event.preventDefault();
            setDropping(false);
            accept([...event.dataTransfer.files]);
          }}
          className={`flex flex-col items-center gap-3 rounded-[5px] border-2 border-dashed p-5 text-center transition ${dropping ? 'border-forest bg-mint' : 'border-line'}`}
        >
          <button type="button" className={outline ? 'btn-outline' : 'btn'} onClick={() => inputRef.current?.click()}>
            <ImagePlus className="size-5" aria-hidden /> {single ? (items.length ? t.replace : t.chooseOne) : t.choose}
          </button>
          <p className="text-sm text-muted">{dropping ? t.dropActive : t.dropHere}</p>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            accept={acceptAttribute(field)}
            multiple={!single}
            onChange={(event) => {
              accept([...(event.target.files ?? [])]);
              event.target.value = '';
            }}
          />
        </div>
      )}
      {!single && left <= 0 && <p className="rounded-[5px] bg-sand p-3 text-sm">{fillText(t.full, { max: spec.maxCount })}</p>}

      <p aria-live="polite" role={message?.tone === 'error' ? 'alert' : undefined} className={message ? (message.tone === 'error' ? 'text-sm text-red-700' : 'text-sm font-semibold text-forest') : 'sr-only'}>
        {message?.text ?? ''}
      </p>

      {cropping && spec.cropAspect && (
        <CropDialog
          file={cropping}
          aspect={spec.cropAspect}
          text={t.crop}
          failedText={t.errors.decode}
          onCancel={() => setCropping(null)}
          onConfirm={(crop: CropRect) => {
            queue.add([{ file: cropping, crop }], consent);
            setCropping(null);
          }}
        />
      )}
    </section>
  );
}
