import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { TwoStepSetup } from '@/components/two-step-setup';

export const metadata: Metadata = { robots: { index: false } };

export default async function SecurityPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/${locale}/dashboard`} className="text-sm font-semibold text-leaf-dark underline">{t.nav.dashboard}</Link>
      <h1 className="mt-3 text-3xl font-bold">{t.ux.securityTitle}</h1>
      <Suspense fallback={<div className="card mt-6 h-56 animate-pulse" />}>
        <Settings t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function Settings({ t, locale }: { t: Dictionary; locale: Locale }) {
  await requireUser(locale);
  const { data } = await (await createClient()).auth.mfa.listFactors();
  const enabled = (data?.totp ?? []).some((f) => f.status === 'verified');
  return (
    <div className="mt-6">
      <TwoStepSetup enabled={enabled} labels={t.ux} />
    </div>
  );
}
