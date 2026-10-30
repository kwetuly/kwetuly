import Link from 'next/link';
import { Logo } from '@/components/logo';
import { SUPPORT_EMAIL } from '@/lib/site';

export default function ComingSoon() {
  return (
    <main className="card w-full max-w-md p-8 text-center">
      <Logo className="text-[40px]" />
      <h1 className="mt-6 text-2xl font-bold">Coming soon</h1>
      <p className="mt-2 text-muted">The home of Tanzanian guides is getting ready.</p>
      <p className="mt-4 font-semibold" lang="sw">Inakuja hivi karibuni</p>
      <p className="mt-1 text-muted" lang="sw">Nyumbani kwa waongoza watalii wa Tanzania inajiandaa.</p>
      {SUPPORT_EMAIL && (
        <p className="mt-6 text-sm text-muted">
          <a className="font-semibold text-forest underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      )}
      {/* These pages stay open while the site is closed (LEGAL_PAGES in src/proxy.ts). */}
      <nav aria-label="Legal" className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
        <Link className="font-semibold text-forest underline" href="/en/privacy">Privacy</Link>
        <Link className="font-semibold text-forest underline" href="/en/terms">Terms</Link>
        <Link className="font-semibold text-forest underline" href="/en/data-deletion">Delete your data</Link>
      </nav>
    </main>
  );
}
