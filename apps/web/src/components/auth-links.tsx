import Link from 'next/link';
import { MessagesSquare } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { signOut } from '@/app/[lang]/(auth)/actions';

export async function AuthLinks() {
  const [user, t, locale] = await Promise.all([getCurrentUser(), getDictionary(), getLocale()]);

  if (!user) {
    return (
      <>
        <Link href={`/${locale}/login`} className="hidden whitespace-nowrap font-semibold text-charcoal/80 hover:text-charcoal sm:inline">
          {t.nav.signIn}
        </Link>
        <Link href={`/${locale}/join`} className="btn whitespace-nowrap px-4 py-2 text-sm">
          {t.nav.signUp}
        </Link>
      </>
    );
  }

  if (!user.onboarded) {
    return (
      <Link href={`/${locale}/welcome`} className="btn whitespace-nowrap px-4 py-2 text-sm">
        {t.auth.finishSetup}
      </Link>
    );
  }

  return (
    <>
      {user.role === 'admin' && (
        <Link href={`/${locale}/admin`} className="hidden whitespace-nowrap font-semibold text-charcoal/80 hover:text-charcoal sm:inline">
          {t.nav.admin}
        </Link>
      )}
      {user.canUseHub && (
        <Link
          href={`/${locale}/hub`}
          className="hidden rounded-[15px] bg-gradient-to-r from-gold to-sunset px-4 py-2 text-sm font-bold text-night whitespace-nowrap sm:inline-flex"
        >
          {t.nav.hub}
        </Link>
      )}
      <Link
        href={`/${locale}/messages`}
        className="flex size-10 items-center justify-center rounded-full border border-line hover:border-sunset"
        aria-label={t.messages.title}
        title={t.messages.title}
      >
        <MessagesSquare className="size-5" aria-hidden />
      </Link>
      <Link href={`/${locale}/dashboard`} className="btn-dark whitespace-nowrap px-4 py-2 text-sm">
        {t.nav.dashboard}
      </Link>
      <form action={signOut} className="hidden sm:block">
        <input type="hidden" name="locale" value={locale} />
        <button className="font-semibold text-muted hover:text-charcoal">{t.nav.signOut}</button>
      </form>
    </>
  );
}
