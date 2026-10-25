import Link from 'next/link';
import { PACKAGE_COLUMNS, PACKAGE_KINDS, packageDuration, packagePrice, type GuidePackage } from '@kwetuly/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { reviewPackage } from './actions';

type PendingPackage = GuidePackage & { guides: { display_name: string; slug: string } | null };

// Guide packages wait here until approved. Check that the price, length and description are
// realistic and that the guide is allowed to run this kind of trip.
export async function PendingPackages({ t, locale }: { t: Dictionary; locale: Locale }) {
  const user = await requireAdmin(locale);
  if (user.role !== 'admin') return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('guide_packages')
    .select(`${PACKAGE_COLUMNS}, guides(display_name, slug)`)
    .eq('status', 'pending')
    .order('updated_at', { ascending: true })
    .returns<PendingPackage[]>();
  const packages = data ?? [];
  const pt = t.packages;

  return (
    <section id="packages" className="mt-12">
      <h2 className="text-2xl font-bold">Guide packages ({packages.length})</h2>
      {packages.length === 0 && <p className="mt-3 text-muted">—</p>}
      <ul className="mt-4 space-y-4">
        {packages.map((p) => (
          <li key={p.id} className="card space-y-2">
            <p className="text-xs font-semibold text-leaf-dark">{PACKAGE_KINDS.find((k) => k.id === p.kind)?.en}</p>
            <h3 className="text-lg font-bold">{p.title}</h3>
            {p.guides && (
              <Link href={`/${locale}/guides/${p.guides.slug}`} className="text-sm text-forest underline">
                {p.guides.display_name}
              </Link>
            )}
            <p className="text-sm">{p.summary}</p>
            {p.details && <p className="whitespace-pre-line text-sm text-muted">{p.details}</p>}
            <p className="text-sm font-semibold">
              {[packagePrice(p, pt), packageDuration(p, pt), p.max_group ? pt.upTo.replace('{n}', String(p.max_group)) : null].filter(Boolean).join(' · ')}
            </p>
            {p.includes.length > 0 && <p className="text-sm text-muted">{pt.included}: {p.includes.join(', ')}</p>}
            {p.meeting_point && <p className="text-sm text-muted">{pt.meetingPoint}: {p.meeting_point}</p>}
            {p.photo_url && (
              <a href={p.photo_url} target="_blank" rel="noopener" className="text-sm text-forest underline">Photo</a>
            )}
            <form action={reviewPackage} className="flex flex-wrap items-end gap-3 pt-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="package_id" value={p.id} />
              <button name="decision" value="approve" className="btn px-4 py-2 text-sm">{t.admin.approve}</button>
              <label className="min-w-56 flex-1">
                <span className="label">Note to the guide (if not approved)</span>
                <input className="field" name="note" maxLength={500} />
              </label>
              <button name="decision" value="reject" className="btn-outline px-4 py-2 text-sm">{t.admin.reject}</button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
