import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { signOut } from '@/app/[lang]/(auth)/actions';

export async function AuthLinks() {
  const [user, t, locale] = await Promise.all([getCurrentUser(), getDictionary(), getLocale()]);

  if (!user) {
    return (
      <>
        <Link href={`/${locale}/login`} className="hidden font-semibold text-charcoal/80 hover:text-charcoal sm:inline">
          {t.nav.signIn}
        </Link>
        <Link href={`/${locale}/join`} className="btn px-4 py-2 text-sm">
          {t.nav.join}
        </Link>
      </>
    );
  }

  return (
    <>
      {user.role === 'admin' && (
        <Link href={`/${locale}/admin`} className="hidden font-semibold text-charcoal/80 hover:text-charcoal sm:inline">
          {t.nav.admin}
        </Link>
      )}
      <Link href={`/${locale}/dashboard`} className="btn-dark px-4 py-2 text-sm">
        {t.nav.dashboard}
      </Link>
      <form action={signOut} className="hidden sm:block">
        <input type="hidden" name="locale" value={locale} />
        <button className="font-semibold text-muted hover:text-charcoal">{t.nav.signOut}</button>
      </form>
    </>
  );
}
