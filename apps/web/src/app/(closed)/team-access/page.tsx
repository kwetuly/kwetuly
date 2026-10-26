import { Suspense } from 'react';
import { Logo } from '@/components/logo';
import { openTeamPreview } from './actions';

export default function TeamAccess({ searchParams }: PageProps<'/team-access'>) {
  return (
    <main className="card w-full max-w-md p-8">
      <Logo className="text-[32px]" />
      <h1 className="mt-6 text-xl font-bold">Team preview</h1>
      <p className="mt-2 text-sm text-muted">Type the team password once. This browser then shows the full site until launch.</p>
      <form action={openTeamPreview} className="mt-6 grid gap-3">
        <label className="label" htmlFor="password">Team password</label>
        <input className="field" id="password" name="password" type="password" required maxLength={200} autoComplete="current-password" autoFocus />
        <Suspense fallback={null}>
          <WrongPassword searchParams={searchParams} />
        </Suspense>
        <button className="btn" type="submit">Open the site</button>
      </form>
    </main>
  );
}

async function WrongPassword({ searchParams }: Pick<PageProps<'/team-access'>, 'searchParams'>) {
  const { wrong } = await searchParams;
  if (!wrong) return null;
  return <p className="text-sm font-semibold text-red-700" role="alert">That password is not right.</p>;
}
