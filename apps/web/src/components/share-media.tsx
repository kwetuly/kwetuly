'use client';

import { useState } from 'react';
import { Download, Loader2, Share2 } from 'lucide-react';

// Sends a chat photo or video to the phone's share sheet (WhatsApp, Instagram, TikTok, Facebook…).
// Browsers that cannot share files get a download instead.
export function ShareMedia({ url, name, labels }: { url: string; name: string; labels: { share: string; download: string } }) {
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], name, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Rafrika' });
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = name;
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch {
      // Closing the share sheet is not an error worth showing.
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex gap-1">
      <button type="button" onClick={share} disabled={busy} className="inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-xs font-semibold hover:bg-surface">
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Share2 className="size-3.5" aria-hidden />} {labels.share}
      </button>
      <a href={url} download={name} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-xs font-semibold hover:bg-surface">
        <Download className="size-3.5" aria-hidden /> {labels.download}
      </a>
    </span>
  );
}
