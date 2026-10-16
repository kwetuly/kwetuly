import Link from 'next/link';
import { LogIn, MessagesSquare, UserRound } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { signOut } from '@/app/[lang]/(auth)/actions';

// Account buttons in the header. Below the `sm` width only icons and one main button stay in the
// bar so everything fits a 375px phone in every language; the rest lives in the menu (MenuAccount).
export async function AuthLinks() {
  const [user, t, locale] = await Promise.all([getCurrentUser(), getDictionary(), getLocale()]);

  if (!user) {
    return (
      <>
        <Link href={`/${locale}/login`} className="hidden whitespace-nowrap font-semibold text-charcoal/80 hover:text-charcoal sm:inline">
          {t.nav.signIn}
        </Link>
        <Link href={`/${locale}/join`} className="btn whitespace-nowrap px-3 py-2 text-sm sm:px-4">
          {t.nav.signUp}
        </Link>
      </>
    );
  }

  if (!user.onboarded) {
    return (
      <Link
        href={`/${locale}/welcome`}
        className="flex size-10 shrink-0 items-center justify-center whitespace-nowrap rounded-[5px] bg-leaf text-sm font-semibold text-white transition hover:bg-leaf-dark sm:h-auto sm:w-auto sm:px-4 sm:py-2"
        aria-label={t.auth.finishSetup}
        title={t.auth.finishSetup}
      >
        <LogIn className="size-5 sm:hidden" aria-hidden />
        <span className="hidden sm:inline" aria-hidden>{t.auth.finishSetup}</span>
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
          className="hidden rounded-[5px] bg-leaf px-4 py-2 text-sm font-bold text-white whitespace-nowrap sm:inline-flex"
        >
          {t.nav.hub}
        </Link>
      )}
      <Link
        href={`/${locale}/messages`}
        className="flex size-10 shrink-0 items-center justify-center rounded-[5px] border border-line hover:border-gold"
        aria-label={t.messages.title}
        title={t.messages.title}
      >
        <MessagesSquare className="size-5 text-gold" strokeWidth={2.5} aria-hidden />
      </Link>
      <Link
        href={`/${locale}/dashboard`}
        className="flex size-10 shrink-0 items-center justify-center whitespace-nowrap rounded-[5px] bg-night text-sm font-semibold text-white transition hover:bg-forest sm:h-auto sm:w-auto sm:px-4 sm:py-2"
        aria-label={t.nav.dashboard}
        title={t.nav.dashboard}
      >
        <UserRound className="size-5 sm:hidden" aria-hidden />
        <span className="hidden sm:inline" aria-hidden>{t.nav.dashboard}</span>
      </Link>
      <form action={signOut} className="hidden sm:block">
        <input type="hidden" name="locale" value={locale} />
        <button className="font-semibold text-muted hover:text-charcoal">{t.nav.signOut}</button>
      </form>
    </>
  );
}

// The same account links inside the mobile menu, so nothing is lost when the header bar shrinks.
export async function MenuAccount() {
  const [user, t, locale] = await Promise.all([getCurrentUser(), getDictionary(), getLocale()]);
  const link = 'flex w-full items-center gap-3 rounded-[5px] px-3 py-3 text-lg font-semibold text-white hover:bg-white/15';

  if (!user) {
    return (
      <div className="grid gap-2 pt-4">
        <Link href={`/${locale}/join`} className="btn w-full">{t.nav.signUp}</Link>
        <Link href={`/${locale}/login`} className={link}>{t.nav.signIn}</Link>
      </div>
    );
  }

  return (
    <ul className="pt-4">
      {!user.onboarded ? (
        <li><Link href={`/${locale}/welcome`} className={link}>{t.auth.finishSetup}</Link></li>
      ) : (
        <>
          <li><Link href={`/${locale}/dashboard`} className={link}>{t.nav.dashboard}</Link></li>
          <li><Link href={`/${locale}/messages`} className={link}>{t.messages.title}</Link></li>
          {user.canUseHub && <li><Link href={`/${locale}/hub`} className={link}>{t.nav.hub}</Link></li>}
          {user.role === 'admin' && <li><Link href={`/${locale}/admin`} className={link}>{t.nav.admin}</Link></li>}
        </>
      )}
      <li>
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <button className={`${link} text-white/80`}>{t.nav.signOut}</button>
        </form>
      </li>
    </ul>
  );
}
