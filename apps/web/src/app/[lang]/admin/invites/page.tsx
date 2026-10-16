import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { setInviteCodeActive, setInviteOnly } from './actions';
import { CreateInviteForm } from './create-invite-form';

export const metadata: Metadata = { title: 'Admin: invite codes', robots: { index: false } };

type Code = { id: string; label: string; active: boolean; uses: number; max_uses: number | null; created_at: string };

export default async function AdminInvitesPage() {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">Invite codes</h1>
        <Link href={`/${locale}/admin`} className="text-sm font-semibold text-forest underline">Back to admin</Link>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        While Rafrika is invite-only, new accounts need one of these codes to finish signing up, on the website and in the app.
        Existing accounts are never asked. Codes are stored scrambled (hashed), so a code is shown only once, when you add it.
      </p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[5px] bg-surface" />}>
        <Invites locale={locale} />
      </Suspense>
    </div>
  );
}

async function Invites({ locale }: { locale: Locale }) {
  await requireAdmin(locale);
  const supabase = await createClient();
  const [{ data: setting }, { data: codes }] = await Promise.all([
    supabase.from('site_settings').select('value').eq('key', 'invite_only').maybeSingle<{ value: { enabled?: boolean } }>(),
    supabase.rpc('admin_invite_codes'),
  ]);
  const enabled = setting?.value?.enabled === true;
  const list = (codes ?? []) as Code[];

  return (
    <>
      <div className="card mt-6 flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-bold">{enabled ? 'Invite-only is on' : 'Invite-only is off'}</p>
          <p className="text-sm text-muted">{enabled ? 'Sign-up needs a valid code.' : 'Anyone can sign up without a code.'}</p>
        </div>
        <form action={setInviteOnly}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
          <button className={enabled ? 'btn-outline px-4 py-2 text-sm' : 'btn px-4 py-2 text-sm'}>
            {enabled ? 'Open sign-up to everyone' : 'Turn invite-only on'}
          </button>
        </form>
      </div>

      <CreateInviteForm locale={locale} />

      <ul className="mt-6 divide-y divide-line rounded-[5px] border border-line bg-white">
        {list.length === 0 && <li className="p-4 text-muted">No codes yet.</li>}
        {list.map((c) => {
          const usedUp = c.max_uses !== null && c.uses >= c.max_uses;
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{c.label || 'No label'}</p>
                <p className="text-xs text-muted">
                  Used {c.uses}{c.max_uses !== null ? ` of ${c.max_uses}` : ''} · added {c.created_at.slice(0, 10)}
                </p>
              </div>
              <span className={`rounded-[5px] px-2 py-0.5 text-xs font-bold ${c.active && !usedUp ? 'bg-mint text-forest' : 'bg-sand text-leaf-dark'}`}>
                {!c.active ? 'Off' : usedUp ? 'Used up' : 'Active'}
              </span>
              <form action={setInviteCodeActive}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="active" value={c.active ? 'false' : 'true'} />
                <button className="btn-outline px-3 py-1 text-xs">{c.active ? 'Switch off' : 'Switch on'}</button>
              </form>
            </li>
          );
        })}
      </ul>
    </>
  );
}
