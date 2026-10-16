import Link from 'next/link';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * Shown instead of a form to signed-in accounts that have not finished the welcome step (e.g. no
 * invite code yet): the database would refuse what they send. The welcome step brings them back to `next`.
 */
export function FinishSetup({ t, locale, next, dark = false, className = '' }: { t: Dictionary; locale: string; next: string; dark?: boolean; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      <p className={dark ? 'text-sm text-white/80' : 'text-muted'}>{t.auth.welcomeBody}</p>
      <Link href={`/${locale}/welcome?next=${encodeURIComponent(next)}`} className="btn w-full sm:w-auto">
        {t.auth.finishSetup}
      </Link>
    </div>
  );
}
