'use client';

import { useEffect, useState } from 'react';
import { Check, Link2, Mail, Share2 } from 'lucide-react';

type Labels = { share: string; copyLink: string; copied: string; email: string; more: string };

// Brand marks drawn inline (lucide has no brand icons).
const marks = {
  whatsapp: (
    <path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3s.8-2.2 1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.3.5-.4.5c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.4 2.5 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.8-.2 1.5z" />
  ),
  facebook: (
    <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" />
  ),
  x: <path fill="currentColor" d="M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.8 2.3h7l4.8 6.4 5.6-6.4zm-1.2 17.9h1.9L7.1 4.2H5.1L17 20.2z" />,
  telegram: (
    <path fill="#229ED9" d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.9 8.2-2 9.4c-.1.7-.5.8-1.1.5l-3-2.2-1.5 1.4c-.2.2-.3.3-.6.3l.2-3.1 5.6-5c.2-.2 0-.3-.4-.1l-6.9 4.3-3-.9c-.6-.2-.7-.6.1-1l11.6-4.5c.6-.2 1.1.1.9 1z" />
  ),
};

function Mark({ name }: { name: keyof typeof marks }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      {marks[name]}
    </svg>
  );
}

// Share any Kwetuly page: the phone's own share sheet (Instagram, TikTok, Messenger…) when the
// browser supports it, plus direct links that work everywhere. `path` is the page path, e.g. /en/tours/x.
export function ShareButtons({ path, title, text, labels, compact = false }: { path: string; title: string; text: string; labels: Labels; compact?: boolean }) {
  const [url, setUrl] = useState('');
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // Built in the browser so the link always matches the address people are using.
  useEffect(() => {
    const absolute = new URL(path, window.location.origin).toString();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only values after mount
    setUrl(absolute);
    setCanNativeShare(typeof navigator.share === 'function');
  }, [path]);

  const message = `${text} ${url}`;
  const links = [
    { name: 'whatsapp' as const, label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(message)}` },
    { name: 'facebook' as const, label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { name: 'x' as const, label: 'X', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
    { name: 'telegram' as const, label: 'Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  ];

  async function nativeShare() {
    try {
      await navigator.share({ title, text, url });
    } catch {
      // Closing the share sheet is not an error worth showing.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(labels.copyLink, url);
    }
  }

  const button = 'inline-flex items-center gap-1.5 rounded-[5px] border border-line bg-white px-3 py-2 text-sm font-semibold text-charcoal transition hover:border-leaf';

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={labels.share}>
      {!compact && <span className="mr-1 flex items-center gap-1.5 text-sm font-bold"><Share2 className="size-4 text-leaf-dark" aria-hidden /> {labels.share}</span>}
      {canNativeShare && (
        <button type="button" onClick={nativeShare} className={`${button} bg-night text-white hover:border-charcoal`}>
          <Share2 className="size-4" aria-hidden /> {labels.more}
        </button>
      )}
      {links.map((l) => (
        <a key={l.name} href={url ? l.href : undefined} target="_blank" rel="noopener noreferrer" className={button} aria-label={`${labels.share}: ${l.label}`}>
          <Mark name={l.name} /> {!compact && l.label}
        </a>
      ))}
      <a href={url ? `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}` : undefined} className={button} aria-label={labels.email}>
        <Mail className="size-4" aria-hidden /> {!compact && labels.email}
      </a>
      <button type="button" onClick={copy} className={button}>
        {copied ? <Check className="size-4 text-forest" aria-hidden /> : <Link2 className="size-4" aria-hidden />} {copied ? labels.copied : labels.copyLink}
      </button>
    </div>
  );
}
