import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Check, Search } from 'lucide-react';
import { getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { adminDate, maskPhone } from '@/lib/admin-format';

export const metadata: Metadata = { title: 'Users', robots: { index: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;

const PAGE = 50;
const ROLES = [
  { id: 'all', label: 'All' },
  { id: 'traveler', label: 'Travellers' },
  { id: 'guide', label: 'Guides' },
  { id: 'provider', label: 'Businesses' },
  { id: 'admin', label: 'Admins' },
] as const;
const ROLE_NAME: Record<string, string> = { traveler: 'Traveller', guide: 'Guide', provider: 'Business', investor: 'Investor', admin: 'Admin' };

// Read-only list of accounts. No edits and no role changes in phase 1. Phone numbers are masked,
// email addresses are not shown (and not searched).
export default async function UsersPage({ searchParams }: PageProps<'/[lang]/admin/users'>) {
  const locale = await getLocale();
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href={`/${locale}/admin`} className="font-semibold text-forest underline">Admin</Link> / Users
      </nav>
      <Suspense fallback={<UsersSkeleton />}>
        <UsersContent locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function UsersSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading users">
      <div className="mt-2 h-8 w-40 animate-pulse rounded-[5px] bg-line" />
      <div className="mt-4 h-12 animate-pulse rounded-[5px] bg-line" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="mt-3 h-20 animate-pulse rounded-[5px] bg-line" />
      ))}
    </div>
  );
}

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

type Row = { id: string; full_name: string | null; role: string; created_at: string; phone: string | null; phone_verified_at: string | null };

async function UsersContent({ locale, searchParams }: { locale: Locale; searchParams: Search }) {
  await requireAdmin(locale);
  const params = await searchParams;
  const q = one(params.q).trim().slice(0, 80);
  const role = ROLES.some((r) => r.id === one(params.role)) ? one(params.role) : 'all';
  const phone = ['yes', 'no'].includes(one(params.phone)) ? one(params.phone) : 'any';
  const sort = one(params.sort) === 'oldest' ? 'oldest' : 'newest';
  const pageAsked = Number.parseInt(one(params.page), 10);
  const page = Number.isFinite(pageAsked) && pageAsked > 1 ? pageAsked : 1;

  const href = (change: Record<string, string | number>) => {
    const next = { q, role, phone, sort, page: 1, ...change } as Record<string, string | number>;
    const s = new URLSearchParams();
    if (next.q) s.set('q', String(next.q));
    if (next.role !== 'all') s.set('role', String(next.role));
    if (next.phone !== 'any') s.set('phone', String(next.phone));
    if (next.sort !== 'newest') s.set('sort', String(next.sort));
    if (Number(next.page) > 1) s.set('page', String(next.page));
    const str = s.toString();
    return `/${locale}/admin/users${str ? `?${str}` : ''}`;
  };

  const supabase = await createClient();
  let query = supabase.from('profiles').select('id, full_name, role, created_at, phone, phone_verified_at', { count: 'exact' });
  // Search by name only. % and _ are wildcards in ilike, so they are escaped.
  if (q) query = query.ilike('full_name', `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (role !== 'all') query = query.eq('role', role);
  if (phone === 'yes') query = query.not('phone_verified_at', 'is', null);
  if (phone === 'no') query = query.is('phone_verified_at', null);
  const from = (page - 1) * PAGE;
  const { data, count, error } = await query
    .order('created_at', { ascending: sort === 'oldest' })
    .range(from, from + PAGE - 1)
    .returns<Row[]>();
  const rows = data ?? [];
  const total = count ?? 0;

  const chip = (selected: boolean) =>
    `inline-flex min-h-10 items-center rounded-[5px] px-3 text-sm font-semibold ${selected ? 'bg-leaf-dark text-white' : 'border border-line bg-white text-charcoal hover:border-leaf'}`;

  return (
    <>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Users{error ? '' : ` (${total})`}</h1>
      <p className="text-sm text-muted">Read only. Phone numbers are shortened; full numbers stay on the person’s profile.</p>

      <form method="get" action={`/${locale}/admin/users`} className="mt-5 space-y-3">
        {role !== 'all' && <input type="hidden" name="role" value={role} />}
        <div className="flex gap-2">
          <label className="relative block flex-1">
            <span className="sr-only">Search by name</span>
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" name="q" defaultValue={q} placeholder="Search by name" className="field min-h-11 pl-10" maxLength={80} />
          </label>
          <button className="btn min-h-11 px-5 py-2">Show</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="sr-only">Phone confirmed</span>
            <select name="phone" defaultValue={phone} className="field py-2.5">
              <option value="any">Any phone</option>
              <option value="yes">Phone confirmed</option>
              <option value="no">Phone not confirmed</option>
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Order</span>
            <select name="sort" defaultValue={sort} className="field py-2.5">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
      </form>

      <nav aria-label="Account types" className="mt-3 flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <Link key={r.id} href={href({ role: r.id })} aria-current={role === r.id ? 'page' : undefined} className={chip(role === r.id)}>
            {r.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <p role="alert" className="mt-5 rounded-[5px] bg-red-50 p-4 text-red-800">Could not load users. Reload the page to try again.</p>
      ) : rows.length === 0 ? (
        <p className="mt-5 rounded-[5px] border border-line bg-white p-5">{q ? `No user matches “${q}”.` : 'No users match these filters.'}</p>
      ) : (
        <>
          {/* Phones: one card per user. */}
          <ul className="mt-5 space-y-3 md:hidden">
            {rows.map((u) => (
              <li key={u.id} className="rounded-[5px] border border-line bg-white p-4">
                <p className="font-semibold">{u.full_name || 'No name given'}</p>
                <p className="text-sm text-muted">{ROLE_NAME[u.role] ?? u.role} · joined {adminDate(u.created_at)}</p>
                <PhoneLine u={u} />
              </li>
            ))}
          </ul>
          {/* Wider screens: a table. */}
          <table className="mt-5 hidden w-full border-collapse overflow-hidden rounded-[5px] border border-line bg-white text-sm md:table">
            <caption className="sr-only">Users</caption>
            <thead className="bg-surface text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                <th scope="col" className="px-4 py-3 font-semibold">Joined</th>
                <th scope="col" className="px-4 py-3 font-semibold">Phone</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-4 py-3 font-semibold">{u.full_name || 'No name given'}</td>
                  <td className="px-4 py-3">{ROLE_NAME[u.role] ?? u.role}</td>
                  <td className="px-4 py-3">{adminDate(u.created_at)}</td>
                  <td className="px-4 py-3"><PhoneLine u={u} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-sm text-muted">
            Showing {from + 1} to {from + rows.length} of {total}
          </p>
          {total > PAGE && (
            <nav aria-label="Pages" className="mt-3 grid grid-cols-2 gap-3">
              {page > 1 ? <Link href={href({ page: page - 1 })} className="btn-outline min-h-11">Previous</Link> : <span />}
              {from + rows.length < total && <Link href={href({ page: page + 1 })} className="btn-outline min-h-11">Next</Link>}
            </nav>
          )}
        </>
      )}
    </>
  );
}

function PhoneLine({ u }: { u: Row }) {
  const masked = maskPhone(u.phone);
  if (!masked) return <span className="text-sm text-muted">No phone</span>;
  return (
    <span className="text-sm">
      Phone {masked} ·{' '}
      {u.phone_verified_at ? (
        <span className="inline-flex items-center gap-1 font-semibold text-forest"><Check size={14} aria-hidden /> confirmed</span>
      ) : (
        <span className="text-charcoal">not confirmed</span>
      )}
    </span>
  );
}
