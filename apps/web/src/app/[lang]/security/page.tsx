import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { Trash2 } from 'lucide-react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { adminSecondStep, requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { TwoStepSetup } from '@/components/two-step-setup';
import { ConnectedSignIns } from '@/components/connected-sign-ins';
import { deleteAccount } from './actions';
import { SIGNIN_NOTICE_COOKIE, readSignInNotice } from '@/lib/signin-notice';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).ux.securityTitle, robots: { index: false } };
}

export default async function SecurityPage({ searchParams }: PageProps<'/[lang]/security'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/${locale}/dashboard`} className="text-sm font-semibold text-leaf-dark underline">{t.nav.dashboard}</Link>
      <h1 className="mt-3 text-3xl font-bold">{t.ux.securityTitle}</h1>
      <Suspense fallback={<div className="card mt-6 h-56 animate-pulse" />}>
        <Settings t={t} locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Settings({ t, locale, searchParams }: { t: Dictionary; locale: Locale; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, status] = await Promise.all([requireUser(locale), searchParams]);
  const { data } = await (await createClient()).auth.mfa.listFactors();
  const enabled = (data?.totp ?? []).some((f) => f.status === 'verified');
  // Admin accounts change their sign-ins only in a two-step session (checked again in the actions).
  const signInsLocked = user.role === 'admin' && (await adminSecondStep()) !== 'ok';
  // Result notes only when this account really just asked for a sign-in change (signed cookie).
  const recentChange = readSignInNotice((await cookies()).get(SIGNIN_NOTICE_COOKIE)?.value, user.id);
  return (
    <div className="mt-6 space-y-6">
      {status.admin === 'two-step' && user.role === 'admin' && (
        // Admin area texts are English only, like the rest of /admin.
        <p role="alert" className="rounded-[5px] border border-gold bg-gold/10 p-4 text-sm">
          {enabled ? (
            <>
              Two-step sign-in is on. <Link href={`/${locale}/admin`} className="font-semibold text-leaf-dark underline">Open the admin pages</Link>
            </>
          ) : (
            'Admin pages need two-step sign-in. Turn it on below with an authenticator app (for example Google Authenticator or Microsoft Authenticator), then open the admin pages again.'
          )}
        </p>
      )}
      <TwoStepSetup enabled={enabled} labels={t.ux} />
      <ConnectedSignIns t={t} locale={locale} status={status} locked={signInsLocked} recentChange={recentChange} />

      <section id="delete" className="card scroll-mt-28 space-y-4" aria-labelledby="delete-title">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[5px] bg-red-50 text-red-800">
            <Trash2 className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="delete-title" className="text-lg font-bold">{t.ux.deleteTitle}</h2>
            <p className="mt-1 text-sm text-muted">{t.ux.deleteBody}</p>
          </div>
        </div>
        {status.deleteError && (
          <p role="alert" className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">
            {status.deleteError === '1' ? t.ux.deleteMismatch : t.ux.errorBody}
          </p>
        )}
        <form action={deleteAccount} className="space-y-3">
          <input type="hidden" name="locale" value={locale} />
          <div>
            <label className="label" htmlFor="delete-email">{t.ux.deleteConfirm}</label>
            <input id="delete-email" name="email" type="email" required autoComplete="off" placeholder={user.email ?? ''} className="field" />
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-[5px] border-2 border-red-700 px-6 py-2.5 font-semibold text-red-800 transition hover:bg-red-50">
            {t.ux.deleteButton}
          </button>
        </form>
      </section>
    </div>
  );
}
