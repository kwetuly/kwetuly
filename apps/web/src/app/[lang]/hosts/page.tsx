import type { Metadata } from 'next';
import Link from 'next/link';
import { Crown } from 'lucide-react';
import { hostsText } from '@kwetuly/shared';
import { pageMeta } from '@/lib/seo';
import { getLocale } from '@/i18n/dictionaries';

// "Become a host": a static page for people who want to be personal trip or investment visit hosts.
// Host texts are guide/owner texts (English and Kiswahili; other languages show English).
export async function generateMetadata(): Promise<Metadata> {
  const x = hostsText(await getLocale());
  return pageMeta({ path: '/hosts', title: x.metaTitle, description: x.metaDescription });
}

export default async function HostsPage() {
  const locale = await getLocale();
  const x = hostsText(locale);
  const textLang = locale === 'sw' ? 'sw' : 'en';
  const apply = `/${locale}/join?role=guide&intent=host`;
  return (
    <div lang={textLang} className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold sm:text-4xl">
        <Crown className="size-8 shrink-0 text-leaf-dark" aria-hidden /> {x.title}
      </h1>
      <p className="mt-3 text-lg text-muted">{x.intro}</p>

      <section className="card mt-8" aria-labelledby="host-kinds">
        <h2 id="host-kinds" className="text-2xl font-bold">{x.kindsTitle}</h2>
        <ul className="mt-4 space-y-4">
          {x.kinds.map((k) => (
            <li key={k.name}>
              <p className="font-semibold">{k.name}</p>
              <p className="mt-1">{k.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-[5px] border border-gold bg-sand p-5 text-charcoal" aria-labelledby="host-not-offered">
        <h2 id="host-not-offered" className="text-xl font-bold">{x.notOfferedTitle}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {x.notOffered.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>

      <section className="card mt-6" aria-labelledby="host-how">
        <h2 id="host-how" className="text-2xl font-bold">{x.howTitle}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {x.how.map((line) => <li key={line}>{line}</li>)}
        </ol>
      </section>

      <section className="card mt-6" aria-labelledby="host-good">
        <h2 id="host-good" className="text-2xl font-bold">{x.goodTitle}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {x.good.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>

      <section className="card mt-6" aria-labelledby="host-conduct">
        <h2 id="host-conduct" className="text-2xl font-bold">{x.conductTitle}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {x.conduct.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p className="mt-4 text-sm text-muted">{x.draftNote}</p>
      </section>

      <div className="mt-8">
        <Link href={apply} className="btn w-full sm:w-auto" data-track="hosts_apply">
          {x.apply}
        </Link>
        <p className="mt-2 text-sm text-muted">{x.applyNote}</p>
      </div>
    </div>
  );
}
