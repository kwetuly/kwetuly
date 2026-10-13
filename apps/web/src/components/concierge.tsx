'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, Sparkles, X } from 'lucide-react';
import { locales } from '@/i18n/config';

const langs = locales.join('|');
const pathSplit = new RegExp(`(/(?:${langs})/[a-z0-9_/?=&-]*)`, 'g');
const isPath = new RegExp(`^/(?:${langs})/`);

type Message = { role: 'user' | 'assistant'; content: string };

type Labels = {
  open: string;
  title: string;
  intro: string;
  placeholder: string;
  send: string;
  error: string;
  disclaimer: string;
};

// Turns site paths like /en/calls in the AI's reply into links.
function Linkified({ text }: { text: string }) {
  const parts = text.split(pathSplit);
  return (
    <>
      {parts.map((part, i) =>
        isPath.test(part) ? (
          <Link key={i} href={part} className="font-semibold text-sunset underline">
            {part}
          </Link>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function Concierge({ labels }: { labels: Labels }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy) return;

    const history: Message[] = [...messages, { role: 'user', content: question }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);

    const appendToReply = (text: string) =>
      setMessages((current) => {
        const next = [...current];
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, content: last.content + text };
        return next;
      });

    try {
      const response = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.filter((m) => m.content) }),
      });
      if (!response.ok || !response.body) throw new Error(String(response.status));

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        appendToReply(chunk.replace('\n\n[error]', `\n\n${labels.error}`));
      }
    } catch {
      appendToReply(labels.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-sunset to-gold px-5 py-3.5 font-bold text-night shadow-[0_12px_32px_-8px_rgba(255,106,43,0.7)] transition hover:-translate-y-0.5"
      >
        <Sparkles className="size-5" aria-hidden />
        <span className="hidden sm:inline">{labels.open}</span>
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-label={labels.title}
            className="fixed inset-x-3 bottom-3 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-[0_30px_80px_-20px_rgba(10,31,23,0.45)] sm:inset-x-auto sm:right-5 sm:w-[400px]"
          >
            <div className="pattern-kanga flex items-center justify-between px-5 py-4 text-white">
              <p className="flex items-center gap-2 font-extrabold">
                <Sparkles className="size-5 text-gold" aria-hidden /> {labels.title}
              </p>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-white/10 p-1.5" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-surface p-4 text-sm" aria-live="polite">
              <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white p-3 shadow-sm">{labels.intro}</p>
              {messages.map((m, i) => (
                <p
                  key={i}
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl p-3 shadow-sm ${
                    m.role === 'user' ? 'ml-auto rounded-tr-sm bg-night text-white' : 'rounded-tl-sm bg-white'
                  }`}
                >
                  {m.content ? <Linkified text={m.content} /> : <span className="animate-pulse">…</span>}
                </p>
              ))}
              <div ref={endRef} />
            </div>

            <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={labels.placeholder}
                maxLength={2000}
                className="field py-2.5"
                aria-label={labels.placeholder}
              />
              <button disabled={busy} className="btn shrink-0 px-4 py-2.5" aria-label={labels.send}>
                <Send className="size-4" aria-hidden />
              </button>
            </form>
            <p className="px-4 pb-3 text-[11px] text-muted">{labels.disclaimer}</p>
          </div>,
          document.body,
        )}
    </>
  );
}
