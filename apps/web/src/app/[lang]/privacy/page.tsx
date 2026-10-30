import type { Metadata } from 'next';
import Link from 'next/link';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { pageMeta } from '@/lib/seo';
import { LegalPage } from '@/components/legal-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return pageMeta({ path: '/privacy', title: t.legal.privacyTitle });
}

const EMAIL = 'support@kwetuly.com';

const PROVIDERS: [string, string][] = [
  ['Supabase', 'Database, sign-in, file storage and server functions'],
  ['Vercel', 'Hosts the website'],
  ['Resend', 'Sends email alerts'],
  ['Meta (WhatsApp Business)', 'Sends WhatsApp alerts'],
  ['Expo', 'Sends app notifications'],
  ['Anthropic', 'Answers questions sent to the travel concierge'],
  ['PostHog (EU)', 'Cookieless usage statistics'],
  ['Google and Facebook', 'Sign-in, only if you choose it'],
  ['Selcom', 'Card and mobile-money payments, only when deposits are switched on'],
  ['OpenFreeMap and Amazon Web Services', 'Map images on tour pages; they see your IP address when a map loads'],
];

// Temporary privacy notice, from Part A of docs/legal/interim-privacy-notice.md (approved by Walter on 2026-10-30).
export default async function PrivacyPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const mail = <a href={`mailto:${EMAIL}`}>{EMAIL}</a>;
  return (
    <LegalPage t={t} locale={locale} current="privacy" title={t.legal.privacyTitle}>
      <p>
        <strong>This is a short interim notice.</strong> Kwetuly is preparing a full privacy policy with a Tanzanian advocate. When it is ready it will replace this page,
        and we will tell account holders by email before any important change applies.
      </p>

      <h2>Who we are</h2>
      <p>Kwetuly runs the website kwetuly.com and the Kwetuly app. Kwetuly helps travellers find and talk to independent Tanzanian guides and local businesses.</p>
      <ul>
        <li>Operator: Kwetuly</li>
        <li>Address: to be added</li>
        <li>Registration with the Personal Data Protection Commission: to be added</li>
        <li>Privacy contact: {mail}</li>
      </ul>

      <h2>If you sign in with Google or Facebook</h2>
      <p>When you choose &ldquo;Continue with Google&rdquo; or &ldquo;Continue with Facebook&rdquo;, that service asks your permission and then sends us:</p>
      <ul>
        <li>your name;</li>
        <li>your email address;</li>
        <li>a link to your profile photo;</li>
        <li>an account ID that the service uses for Kwetuly.</li>
      </ul>
      <p>What we do with it:</p>
      <ul>
        <li>We use your email address and the account ID to create your Kwetuly account and sign you in.</li>
        <li>We copy your name into your Kwetuly profile. You can change it on the welcome step and later.</li>
        <li>
          We do not show your Google or Facebook photo on Kwetuly. Our sign-in provider (Supabase) keeps it together with the other sign-in details. A guide or business photo
          on Kwetuly is only one you upload yourself.
        </li>
        <li>We do not get your password, your contacts, your friends list or your posts, and we cannot post anything for you.</li>
        <li>
          We use this information only to run your Kwetuly account. We do not sell it, we do not use it for advertising, and we do not share it with Google or Facebook beyond
          what is needed to sign you in.
        </li>
      </ul>
      <p>After you sign in for the first time, we ask you to choose your account type (traveller, guide or business) and to add a phone number before you can use Kwetuly.</p>
      <p>
        You can also remove Kwetuly from your Google or Facebook account settings. This stops future sign-ins through that service, but it does not delete your Kwetuly account.
        To delete your account, see &ldquo;Deleting your data&rdquo; below.
      </p>

      <h2>Other information we keep</h2>
      <p>What we keep depends on how you use Kwetuly:</p>
      <ul>
        <li>
          <strong>Account:</strong> email address, name, phone number, preferred language, account type, the invite code you used, and a two-step sign-in factor if you turn
          that on. If you sign up with email, your password is held by our sign-in provider in a form we cannot read.
        </li>
        <li>
          <strong>Guide and business profiles:</strong> what you publish (for example name, photo, bio, regions, languages, prices, packages, listing details and photos), plus
          private details that are never shown publicly: WhatsApp number, registration and licence numbers, and copies of documents such as your ID, guide licence or business
          licence. Documents are kept in private storage that only you and Kwetuly admins can open.
        </li>
        <li>
          <strong>Messages and group chats:</strong> messages you send, and photos and videos you share in group chats. In one-to-one messages, phone numbers, emails and
          WhatsApp links are hidden from the other person until a booking or call is confirmed. Kwetuly admins can read messages and chats, including the original text, to keep
          people safe and deal with reports.
        </li>
        <li>
          <strong>Uploads:</strong> profile and listing photos, documents, and group-chat photos and videos.
        </li>
        <li>
          <strong>Enquiries, trip requests and bookings:</strong> what you send to a guide or business (for example name, contact, dates, number of travellers, budget and
          message), offers, which offer you accepted, group-trip join requests, call requests and reviews. When an offer is accepted, both sides can see each other&rsquo;s email
          and phone number.
        </li>
        <li>
          <strong>Payments (when deposits are switched on):</strong> amount, what it was for, status, and the payment provider&rsquo;s reference. We never receive your full card
          number or mobile-money PIN.
        </li>
        <li>
          <strong>Alerts:</strong> your email address, phone number and app notification token, so we can tell you about messages, offers and bookings.
        </li>
        <li>
          <strong>Travel concierge:</strong> what you type to the AI travel assistant, so it can answer.
        </li>
        <li>
          <strong>Usage and technical data:</strong> pages viewed and buttons used, without cookies and without your name, email or phone; and the IP address, device and error
          logs kept by our hosting providers.
        </li>
      </ul>

      <h2>Who helps us run Kwetuly</h2>
      <p>These service providers process data for us. Several are outside Tanzania.</p>
      <ul>
        {PROVIDERS.map(([name, role]) => (
          <li key={name}>
            <strong>{name}:</strong> {role}
          </li>
        ))}
      </ul>
      <p>
        We do not sell personal data and we do not share it with advertisers. We share information with authorities only when the law requires it, or to protect someone&rsquo;s
        life or safety.
      </p>

      <h2>Your rights under Tanzanian law</h2>
      <p>Kwetuly follows the Personal Data Protection Act, 2022 (Act No. 11 of 2022) of Tanzania. Under the Act you can ask us:</p>
      <ul>
        <li>to tell you what personal data we hold about you, why, and who we share it with;</li>
        <li>to correct data that is wrong, incomplete or misleading;</li>
        <li>to delete data that is no longer needed or should not be held;</li>
        <li>
          to stop using your data in ways that harm you, and not to be subject to decisions made only by a computer that significantly affect you (Kwetuly does not make such
          decisions).
        </li>
      </ul>
      <p>
        To ask, write to {mail} from the email address on your account and say what you want. We may need to confirm it is you. We will reply within 30 days.
      </p>
      <p>
        If you are not happy with our answer, you can complain to the Personal Data Protection Commission:{' '}
        <a href="https://pdpc.go.tz" target="_blank" rel="noopener">
          pdpc.go.tz
        </a>
        .
      </p>

      <h2>Deleting your data</h2>
      <p>
        You can delete your account yourself at any time, or ask us to do it. See <Link href={`/${locale}/data-deletion`}>how to delete your Kwetuly data</Link> for the steps.
      </p>

      <h2>Cookies</h2>
      <p>
        Kwetuly only uses what is needed to keep you signed in and remember your language. Our usage statistics do not use cookies. We do not use advertising cookies.
      </p>
      <p>
        In detail, the website sets: sign-in cookies from our sign-in provider (Supabase); a cookie that remembers your language; a short-lived cookie during a password reset;
        and, before launch, a cookie for Kwetuly team members who open the preview of the site. Your browser also keeps a short list of the guides and trips you opened
        recently, on your own device only, so the home page can show them again.
      </p>

      <h2>Children</h2>
      <p>Kwetuly accounts are for people aged 18 and over.</p>

      <h2>Contact</h2>
      <p>{mail}</p>
    </LegalPage>
  );
}
