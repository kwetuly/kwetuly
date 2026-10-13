'use client';

import { useRef, useState, useTransition } from 'react';
import { Loader2, Send } from 'lucide-react';
import { sendMessage } from '@/app/[lang]/messages/actions';
import { isRedirect } from './chat-composer';

// Message box for a traveller–guide conversation. A failed send keeps the text and says so.
export function MessageComposer({ conversationId, locale, labels }: { conversationId: string; locale: string; labels: { placeholder: string; send: string; notSent: string } }) {
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get('body') ?? '');
    if (!text.trim()) return;
    setError('');
    startTransition(async () => {
      formRef.current?.reset();
      const keep = () => {
        if (bodyRef.current) bodyRef.current.value = text;
        setError(labels.notSent);
      };
      try {
        const result = await sendMessage(form);
        if (result && result.ok === false) keep();
      } catch (err) {
        if (isRedirect(err)) throw err;
        keep();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="sticky bottom-3 mt-4 space-y-2 rounded-3xl border border-line bg-white p-2 shadow-lg">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="conversation_id" value={conversationId} />
      {error && <p role="alert" className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="flex gap-2">
        <textarea
          ref={bodyRef}
          name="body"
          required
          maxLength={4000}
          rows={2}
          placeholder={labels.placeholder}
          className="min-h-12 flex-1 resize-none rounded-2xl px-3 py-2 text-sm outline-none"
          aria-label={labels.placeholder}
        />
        <button disabled={pending} className="btn self-end px-4 py-3" aria-label={labels.send}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        </button>
      </div>
    </form>
  );
}
