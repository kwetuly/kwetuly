'use client';

import { useRef, useState, useTransition } from 'react';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { sendChatMessage } from '@/app/[lang]/chats/actions';

type Labels = {
  placeholder: string;
  send: string;
  attach: string;
  uploading: string;
  uploadError: string;
  tooBig: string;
  shareConsent: string;
  consentNote: string;
  notSent: string;
};

const MAX_BYTES = 50 * 1024 * 1024;

// A successful send ends in a redirect; let Next.js handle it.
export const isRedirect = (err: unknown) => typeof (err as { digest?: unknown })?.digest === 'string' && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT');

// Message box for a group chat. Photos and videos go straight from the browser to private storage
// (only chat members can read them); the message itself is then saved by a server action.
export function ChatComposer({ chatId, locale, labels }: { chatId: string; locale: string; labels: Labels }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    setError('');
    if (chosen && chosen.size > MAX_BYTES) {
      setError(labels.tooBig);
      event.target.value = '';
      return;
    }
    setFile(chosen);
  }

  function clearFile() {
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!String(form.get('body') ?? '').trim() && !file) return;
    setError('');

    startTransition(async () => {
      if (file) {
        const extension = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
        const path = `${chatId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await createClient().storage.from('chat-media').upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) {
          setError(labels.uploadError);
          return;
        }
        form.set('media_path', path);
        form.set('media_type', file.type.startsWith('video/') ? 'video' : 'image');
      }
      // Clear the box right away, but put the text back if the message does not go through.
      const text = String(form.get('body') ?? '');
      formRef.current?.reset();
      clearFile();
      const keep = () => {
        if (bodyRef.current) bodyRef.current.value = text;
        setError(labels.notSent);
      };
      try {
        const result = await sendChatMessage(form);
        if (result && result.ok === false) keep();
      } catch (err) {
        if (isRedirect(err)) throw err;
        keep();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="sticky bottom-3 mt-4 space-y-2 rounded-[5px] border border-line bg-white p-2 shadow-lg">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="chat_id" value={chatId} />
      {error && <p className="rounded-[5px] bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {file && (
        <div className="rounded-[5px] bg-surface p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold">{file.name}</span>
            <button type="button" onClick={clearFile} className="rounded-[5px] p-1 hover:bg-white" aria-label="Remove">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <label className="mt-2 flex items-start gap-2">
            <input type="checkbox" name="share_public" className="mt-0.5 size-4 accent-leaf" />
            <span>
              <span className="font-semibold">{labels.shareConsent}</span>
              <span className="block text-xs text-muted">{labels.consentNote}</span>
            </span>
          </label>
        </div>
      )}
      <div className="flex items-end gap-2">
        <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[5px] bg-mint text-forest hover:bg-forest hover:text-white" title={labels.attach}>
          <ImagePlus className="size-5" aria-hidden />
          <span className="sr-only">{labels.attach}</span>
          <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" onChange={pick} className="sr-only" />
        </label>
        <textarea
          ref={bodyRef}
          name="body"
          maxLength={4000}
          rows={2}
          placeholder={labels.placeholder}
          className="min-h-11 flex-1 resize-none rounded-[5px] px-3 py-2 text-sm outline-none"
          aria-label={labels.placeholder}
        />
        <button disabled={pending} className="btn self-end px-4 py-3" aria-label={labels.send}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          <span className="sr-only">{pending ? labels.uploading : labels.send}</span>
        </button>
      </div>
    </form>
  );
}
