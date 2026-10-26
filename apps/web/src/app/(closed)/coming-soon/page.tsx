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
    </main>
  );
}
