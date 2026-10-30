import type { Metadata } from 'next';
import Link from 'next/link';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { pageMeta } from '@/lib/seo';
import { LegalPage } from '@/components/legal-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return pageMeta({ path: '/data-deletion', title: t.legal.deletionTitle });
}

const EMAIL = 'support@kwetuly.com';

// Data deletion instructions (needed by Meta), from Part B of docs/legal/interim-privacy-notice.md.
// What is deleted and kept follows supabase/migrations/20261016000000_delete_my_account.sql and
// 20261016001200_account_deletion_cleanup.sql; group-chat messages are removed with the account
// (group_chat_messages.sender_id is ON DELETE CASCADE). Update this page if those rules change.
export default async function DataDeletionPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const mail = <a href={`mailto:${EMAIL}?subject=${encodeURIComponent('Delete my account')}`}>{EMAIL}</a>;
  return (
    <LegalPage t={t} locale={locale} current="data-deletion" title={t.legal.deletionTitle}>
      <p>You can delete your Kwetuly account and data at any time. This works the same whether you signed up with email, Google or Facebook.</p>

      <h2>Option 1: delete it yourself (immediate)</h2>
      <h3>On the website</h3>
      <ol>
        <li>Sign in at kwetuly.com.</li>
        <li>
          Open your account&rsquo;s <Link href={`/${locale}/security#delete`}>Security page</Link>.
        </li>
        <li>Under &ldquo;Delete my account&rdquo;, type the email address of your account.</li>
        <li>Press &ldquo;Delete my account permanently&rdquo;.</li>
      </ol>
      <h3>In the app</h3>
      <ol>
        <li>Sign in to the Kwetuly app.</li>
        <li>Open the Account tab and tap &ldquo;Delete my account&rdquo; at the bottom of the page.</li>
        <li>Type the email address of your account and tap &ldquo;Delete my account permanently&rdquo;.</li>
      </ol>

      <h2>Option 2: ask us</h2>
      <p>
        Send an email to {mail} with the subject &ldquo;Delete my account&rdquo;, from the email address on your account. If you signed in with Facebook or Google, use the
        email address of that account. We will confirm it is you, delete the account, and reply to tell you it is done, within 30 days.
      </p>

      <h2>What is deleted</h2>
      <p>
        Your profile, guide profile or business listing, messages, chats, reviews, trip requests, saved tours, and the photos and documents you uploaded are removed
        permanently. Messages, photos and videos you sent in group chats are deleted too, so other members no longer see them. This cannot be undone.
      </p>

      <h2>What is kept, and why</h2>
      <ul>
        <li>
          <strong>Payment records</strong> are kept for accounting and tax, with your name removed. How long they are kept: to be added.
        </li>
        <li>
          <strong>Enquiries you sent to a guide or business</strong> stay with them as a record, but your name, contact details and message are removed.
        </li>
        <li>
          <strong>Alert records</strong> (which emails or WhatsApp messages we sent) are deleted automatically after 30 days, or 90 days if sending failed.
        </li>
        <li>
          <strong>Backups</strong> held by our database provider may hold a copy until they expire. How long backups are kept: to be added.
        </li>
      </ul>

      <h2>Removing Kwetuly from Facebook or Google</h2>
      <p>
        Removing Kwetuly from your Facebook or Google account settings stops Kwetuly from signing you in through that service. It does not delete the data Kwetuly already has.
        Use Option 1 or Option 2 above for that.
      </p>

      <h2>Questions</h2>
      <p>{mail}</p>
    </LegalPage>
  );
}
