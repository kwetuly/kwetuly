import Link from 'next/link';
import { Suspense } from 'react';
import { ShieldCheck } from 'lucide-react';
import { HUB_MENU } from '@rafrika/shared';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { requireHubAccess } from '@/lib/auth';
import { Icon } from '@/components/icon';

// Everything under /hub is for verified guides (and admins) only.
// The database enforces the same rule, so data never leaks even if a page is reached.
export default async function HubLayout({ children }: LayoutProps<'/[lang]/hub'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="min-h-[70vh] bg-surface">
      <div className="bg-night text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4">
          <p className="flex items-center gap-2 font-extrabold">
            <ShieldCheck className="size-5 text-gold" aria-hidden /> {t.hub.title}
          </p>
          <nav className="flex flex-wrap gap-1">
            {HUB_MENU.map((item) => (
              <Link
                key={item.slug}
                href={`/${locale}${item.href}`}
                className="flex items-center gap-1.5 rounded-[15px] px-3 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
              >
                <Icon name={item.icon} className="size-4" />
                {item.label[locale]}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-6xl animate-pulse rounded-3xl bg-white" />}>
        <HubGate locale={locale}>{children}</HubGate>
      </Suspense>
    </div>
  );
}

async function HubGate({ locale, children }: { locale: string; children: React.ReactNode }) {
  await requireHubAccess(locale);
  return <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>;
}
