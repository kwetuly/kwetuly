'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EVENTS, UX_TEXT } from '@rafrika/shared';
import { track } from '@/lib/analytics';

// Friendly fallback when a page fails to render, with a retry and a way home.
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { lang } = useParams<{ lang: string }>();
  const t = UX_TEXT[lang as keyof typeof UX_TEXT] ?? UX_TEXT.en;
  useEffect(() => {
    console.error(error);
    track(EVENTS.errorShown, { kind: 'page', digest: error.digest, page: window.location.pathname });
  }, [error]);
  return (
    <div role="alert" className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-3xl font-bold">{t.errorTitle}</h1>
      <p className="mt-3 text-muted">{t.errorBody}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="btn">{t.tryAgain}</button>
        <Link href={`/${lang ?? 'en'}`} className="btn-outline">{t.goHome}</Link>
      </div>
    </div>
  );
}
