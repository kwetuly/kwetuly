import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { signOut } from '@/app/[lang]/(auth)/actions';

export async function AuthLinks() {
  const [user, t, locale] = await Promise.all([getCurrentUser(), getDictionary(), getLocale()]);

  if (!user) {
    return (
      <>
        <Link href={`/${locale}/login`} className="font-medium hover:text-forest">
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
        <Link href={`/${locale}/admin`} className="font-medium hover:text-forest">
          {t.nav.admin}
        </Link>
      )}
      <Link href={`/${locale}/dashboard`} className="font-medium hover:text-forest">
        {t.nav.dashboard}
      </Link>
      <form action={signOut}>
        <input type="hidden" name="locale" value={locale} />
        <button className="font-medium text-muted hover:text-forest">{t.nav.signOut}</button>
      </form>
    </>
  );
}
