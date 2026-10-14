'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mic, Send, Sparkles, Square, Volume2, VolumeX, X } from 'lucide-react';
import { locales, type Locale } from '@/i18n/config';

const langs = locales.join('|');
const pathSplit = new RegExp(`(/(?:${langs})/[a-z0-9_/?=&-]*)`, 'g');
const isPath = new RegExp(`^/(?:${langs})/`);

// Regional voices the browser should listen and speak with for each site language.
const SPEECH_LANGS: Record<Locale, string> = {
  en: 'en-GB',
  sw: 'sw-TZ',
  fr: 'fr-FR',
  it: 'it-IT',
  de: 'de-DE',
  pl: 'pl-PL',
  zh: 'zh-CN',
};

type Message = { role: 'user' | 'assistant'; content: string };

type Labels = {
  open: string;
  title: string;
  intro: string;
  placeholder: string;
  send: string;
  error: string;
  disclaimer: string;
  talk: string;
  listening: string;
  speakOn: string;
  speakOff: string;
};

// The Web Speech API is not in TypeScript's DOM types, so describe the parts we use.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};
type RecognitionConstructor = new () => Recognition;

function getRecognition(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Reads a reply aloud, leaving out site paths like /en/calls that sound odd when spoken.
function speak(text: string, lang: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const spoken = text.replace(pathSplit, '').replace(/[*#_`>]/g, '').trim();
  if (!spoken) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spoken);
  utterance.lang = lang;
  const base = lang.split('-')[0];
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-').startsWith(base));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

// Turns site paths like /en/calls in the AI's reply into links.
function Linkified({ text }: { text: string }) {
  const parts = text.split(pathSplit);
  return (
    <>
      {parts.map((part, i) =>
        isPath.test(part) ? (
          <Link key={i} href={part} className="font-semibold text-leaf-dark underline">
            {part}
          </Link>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function Concierge({ labels, locale }: { labels: Labels; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const readAloudRef = useRef(readAloud);
  const speechLang = SPEECH_LANGS[locale];

  // The reply finishes streaming in a callback, so it reads the latest setting from a ref.
  useEffect(() => {
    readAloudRef.current = readAloud;
  }, [readAloud]);

  // The panel only renders after a click, so checking browser support here never runs on the server.
  const canListen = open && getRecognition() !== null;
  const canSpeak = open && 'speechSynthesis' in window;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function ask(question: string, voice: boolean) {
    if (!question || busy) return;

    const history: Message[] = [...messages, { role: 'user', content: question }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);

    let reply = '';
    const appendToReply = (text: string) => {
      reply += text;
      setMessages((current) => {
        const next = [...current];
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, content: last.content + text };
        return next;
      });
    };

    try {
      const response = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.filter((m) => m.content), voice }),
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
      if (readAloudRef.current) speak(reply, speechLang);
    }
  }

  function send(event: React.FormEvent) {
    event.preventDefault();
    ask(input.trim(), false);
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const RecognitionImpl = getRecognition();
    if (!RecognitionImpl || busy) return;

    stopSpeaking();
    const recognition = new RecognitionImpl();
    recognition.lang = speechLang;
    recognition.interimResults = true;
    recognition.continuous = false;
    let transcript = '';
    recognition.onresult = (event) => {
      transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('');
      setInput(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      // Someone who speaks probably wants to hear the answer, so switch read-aloud on.
      if (transcript.trim()) {
        setReadAloud(true);
        readAloudRef.current = true;
        ask(transcript.trim(), true);
      }
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function close() {
    recognitionRef.current?.stop();
    stopSpeaking();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          // Some browsers load their voice list lazily; asking early makes the first reply use the right voice.
          if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
        }}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-[5px] bg-leaf px-5 py-3.5 font-bold text-white shadow-[0_8px_24px_-8px_rgba(28,58,46,0.35)] transition hover:bg-leaf-dark"
      >
        <Sparkles className="size-5" aria-hidden />
        <span className="hidden sm:inline">{labels.open}</span>
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-label={labels.title}
            className="fixed inset-x-3 bottom-3 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-[5px] border border-line bg-white shadow-[0_30px_80px_-20px_rgba(28,58,46,0.45)] sm:inset-x-auto sm:right-5 sm:w-[400px]"
          >
            <div className="pattern-kanga flex items-center justify-between gap-2 px-5 py-4 text-white">
              <p className="flex items-center gap-2 font-extrabold">
                <Sparkles className="size-5 text-gold" aria-hidden /> {labels.title}
              </p>
              <div className="flex items-center gap-1.5">
                {canSpeak && (
                  <button
                    type="button"
                    onClick={() => {
                      if (readAloud) stopSpeaking();
                      setReadAloud(!readAloud);
                    }}
                    className={`rounded-[5px] p-1.5 ${readAloud ? 'bg-gold text-night' : 'bg-white/10'}`}
                    aria-label={readAloud ? labels.speakOff : labels.speakOn}
                    aria-pressed={readAloud}
                    title={readAloud ? labels.speakOff : labels.speakOn}
                  >
                    {readAloud ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                  </button>
                )}
                <button type="button" onClick={close} className="rounded-[5px] bg-white/10 p-1.5" aria-label="Close">
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-surface p-4 text-sm" aria-live="polite">
              <p className="max-w-[85%] rounded-[5px] bg-white p-3 shadow-sm">{labels.intro}</p>
              {messages.map((m, i) => (
                <p
                  key={i}
                  className={`max-w-[85%] whitespace-pre-wrap rounded-[5px] p-3 shadow-sm ${
                    m.role === 'user' ? 'ml-auto bg-night text-white' : 'bg-white'
                  }`}
                >
                  {m.content ? <Linkified text={m.content} /> : <span className="animate-pulse">…</span>}
                </p>
              ))}
              <div ref={endRef} />
            </div>

            <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
              {canListen && (
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={busy}
                  className={`relative flex shrink-0 items-center justify-center rounded-[5px] px-3.5 transition disabled:opacity-60 ${
                    listening ? 'bg-leaf text-white' : 'bg-mint text-forest hover:bg-forest hover:text-white'
                  }`}
                  aria-label={listening ? labels.listening : labels.talk}
                  aria-pressed={listening}
                  title={labels.talk}
                >
                  {listening && <span className="absolute inset-0 animate-ping rounded-[5px] bg-leaf/40" aria-hidden />}
                  {listening ? <Square className="relative size-4" aria-hidden /> : <Mic className="size-5" aria-hidden />}
                </button>
              )}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={listening ? labels.listening : labels.placeholder}
                maxLength={2000}
                className="field py-2.5"
                aria-label={labels.placeholder}
              />
              <button disabled={busy || listening} className="btn shrink-0 px-4 py-2.5" aria-label={labels.send}>
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
