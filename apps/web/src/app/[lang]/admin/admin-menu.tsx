import Link from 'next/link';
import {
  BadgeCheck,
  Building2,
  ClipboardCheck,
  ClipboardList,
  HandCoins,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  LayoutList,
  Map as MapIcon,
  MapPin,
  Newspaper,
  ShieldAlert,
  ShoppingBag,
  Star,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

type Row = { href: string; label: string; hint?: string; icon: LucideIcon };

// The grouped admin menu (replaces the old row of buttons). Phones: a list under the tiles;
// desktop: a side column. Rows are whole-width links with no arrows.
export function AdminMenu({ locale, current }: { locale: string; current?: string }) {
  const a = `/${locale}/admin`;
  const groups: { title: string; rows: Row[] }[] = [
    {
      title: 'Approvals',
      rows: [
        { href: `${a}/review`, label: 'Review waiting items', icon: ClipboardCheck },
        { href: `${a}/trips`, label: 'Tours and operators', icon: MapIcon },
        { href: `${a}/listings`, label: 'Business listings', icon: Building2 },
      ],
    },
    {
      title: 'People',
      rows: [
        { href: `${a}/users`, label: 'Users', hint: 'Read only', icon: Users },
        { href: `${a}/invites`, label: 'Invite codes', icon: KeyRound },
        { href: `${a}/messages`, label: 'Message safety', icon: ShieldAlert },
      ],
    },
    {
      title: 'Money',
      rows: [
        { href: `${a}/all#payments`, label: 'Payments', hint: 'On the old page for now', icon: Wallet },
        { href: `${a}/commissions`, label: 'Commissions', icon: HandCoins },
        { href: `${a}/all#businesses`, label: 'Badge fee and badge requests', hint: 'On the old page for now', icon: BadgeCheck },
      ],
    },
    {
      title: 'Content',
      rows: [
        { href: `${a}/news`, label: 'News', icon: Newspaper },
        { href: `${a}/places`, label: 'Places', icon: MapPin },
        { href: `${a}/media`, label: 'Shared media', icon: ImageIcon },
        { href: `${a}/shop`, label: 'Merchandise', icon: ShoppingBag },
      ],
    },
    {
      title: 'Inbox',
      rows: [
        { href: `${a}/all#inbox`, label: 'Enquiries and sign-ups', icon: Inbox },
        { href: `${a}/all#reviews`, label: 'Latest reviews', icon: Star },
        { href: `${a}/all#requests`, label: 'Trip requests', icon: ClipboardList },
      ],
    },
  ];

  return (
    <nav aria-label="Admin menu">
      <h2 className="text-lg font-bold">Manage</h2>
      {groups.map((group) => (
        <div key={group.title} className="mt-4">
          <h3 className="text-sm font-semibold text-muted">{group.title}</h3>
          <ul className="mt-1">
            {group.rows.map((row) => {
              const active = current === row.href;
              const Icon = row.icon;
              return (
                <li key={row.href}>
                  <Link
                    href={row.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-12 items-center gap-3 rounded-[5px] px-2 py-1.5 hover:underline focus-visible:underline ${active ? 'bg-mint text-forest' : ''}`}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-[5px] bg-leaf text-white" aria-hidden>
                      <Icon size={16} strokeWidth={2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{row.label}</span>
                      {row.hint && <span className="block text-sm text-muted">{row.hint}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="mt-4 border-t border-line pt-3">
        <Link href={`${a}/all`} className="flex min-h-12 items-center gap-3 rounded-[5px] px-2 py-1.5 hover:underline focus-visible:underline">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[5px] bg-night text-white" aria-hidden>
            <LayoutList size={16} strokeWidth={2} />
          </span>
          <span className="font-semibold">All sections (old page)</span>
        </Link>
      </div>
    </nav>
  );
}
