import type { Metadata } from 'next';
import Link from 'next/link';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { pageMeta } from '@/lib/seo';
import { LegalPage } from '@/components/legal-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return pageMeta({ path: '/terms', title: t.legal.termsTitle });
}

const EMAIL = 'support@kwetuly.com';

// Temporary traveller terms, from docs/legal/traveller-terms.md (approved by Walter on 2026-10-30).
// Blanks that could not be filled truthfully were left out or marked "to be added".
export default async function TermsPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const mail = <a href={`mailto:${EMAIL}`}>{EMAIL}</a>;
  const privacy = <Link href={`/${locale}/privacy`}>privacy notice</Link>;
  return (
    <LegalPage t={t} locale={locale} current="terms" title={t.legal.termsTitle}>
      <p>
        These terms apply when you use the Kwetuly website kwetuly.com or app as a traveller. Guides and businesses have their own terms. Our {privacy} is part of these terms.
      </p>
      <ul>
        <li>Operator: Kwetuly</li>
        <li>Address: to be added</li>
        <li>Contact: {mail}</li>
      </ul>

      <h2>1. What Kwetuly is, and what it is not</h2>
      <p>
        1.1 Kwetuly is a platform where you can find independent Tanzanian guides, tour companies and local businesses, talk to them, ask for offers, join group trips and send
        enquiries.
      </p>
      <p>
        1.2 <strong>Kwetuly is not the guide, tour operator, hotel or shop.</strong> When you agree a trip, a prep call, a package, a stay or a purchase, your contract for that
        service is with the guide, company or business that provides it, not with Kwetuly. They are responsible for the service, its safety, its price, their licences and
        permits, and for what they promise you.
      </p>
      <p>1.3 Kwetuly merchandise (section 9) is sold by Kwetuly itself.</p>

      <h2>2. Your account</h2>
      <p>2.1 You must be 18 or older to create an account.</p>
      <p>
        2.2 Give true details, including a phone number you can be reached on. Keep your password safe; turn on two-step sign-in if you can. You are responsible for what happens
        in your account.
      </p>
      <p>2.3 During the invite-only period, accounts are by invitation and we may refuse or close accounts at our discretion.</p>
      <p>
        2.4 You can delete your account at any time in Security settings (see <Link href={`/${locale}/data-deletion`}>how to delete your Kwetuly data</Link>). Some records are
        kept as explained in the {privacy}.
      </p>

      <h2>3. What the labels on Kwetuly mean</h2>
      <p>We try to say exactly what we know, and no more.</p>
      <ul>
        <li>
          <strong>Guide checks.</strong> A guide profile lists each check Kwetuly has done (&ldquo;Identity checked&rdquo;, &ldquo;Guide licence checked&rdquo;, &ldquo;First aid
          checked&rdquo;) with the date. It means a Kwetuly team member looked at the document on that date. It does not mean Kwetuly guarantees the guide, their skills or their
          conduct. A first-aid check disappears when the certificate expires.
        </li>
        <li>
          <strong>&ldquo;Checked by Kwetuly&rdquo; badge on businesses.</strong> The business paid a yearly fee for a check. The badge lists what was checked and when, and until
          when the badge runs. It is <strong>not a recommendation</strong>.
        </li>
        <li>
          <strong>&ldquo;Listed&rdquo;.</strong> The business is on Kwetuly but we have not checked it.
        </li>
        <li>
          <strong>Commission note.</strong> Where you see &ldquo;Kwetuly and guides may earn a commission when you buy here&rdquo;, the business has agreed to pay Kwetuly (and
          sometimes the guide who referred you) a share of what you spend.
        </li>
        <li>
          <strong>&ldquo;Sample guide&rdquo; / &ldquo;Sample listing&rdquo;.</strong> Test data. It is not a real person or business offering services. Enquiries go to Kwetuly,
          not to anyone named.
        </li>
        <li>
          <strong>&ldquo;Details being re-checked&rdquo;.</strong> Kwetuly has not yet confirmed the trip details. Confirm everything with the provider.
        </li>
        <li>
          <strong>Reviews</strong> come only from travellers who really dealt with the guide (an accepted or completed prep call, or a confirmed booking). We do not edit reviews,
          but we may hide reviews that break section 8.
        </li>
      </ul>

      <h2>4. Enquiries, messages, trip requests and offers</h2>
      <p>
        4.1 <strong>Enquiries and messages.</strong> You can message guides and send enquiries to businesses. To protect you from scams, phone numbers, emails and WhatsApp links
        are hidden until a booking or call is confirmed. Please keep conversations on Kwetuly until then. Kwetuly staff may read messages to keep people safe, check reports and
        fix problems.
      </p>
      <p>
        4.2 <strong>Trip requests.</strong> You can describe the trip you want. Approved guides and business accounts can see it and send offers with a price, itinerary,
        inclusions and exclusions, and how long the offer is valid.
      </p>
      <p>
        4.3 <strong>Accepting an offer</strong> is your agreement with that guide or company on the terms in the offer. The other offers are declined, both of you can see each
        other&rsquo;s email and phone, and a private chat opens. Read the itinerary, what is included and excluded, and the cancellation terms before accepting. Ask the guide or
        company for anything that is not written in the offer.
      </p>
      <p>
        4.4 <strong>Prep calls</strong> are calls with a guide at the price the guide sets.
      </p>
      <p>
        4.5 <strong>Packages</strong> on guide profiles are reviewed by Kwetuly before they appear. Prices &ldquo;on request&rdquo; are agreed with the guide.
      </p>

      <h2>5. Group trips</h2>
      <p>
        5.1 Guides, businesses and travellers with a confirmed phone number can start group trips. Kwetuly reviews each group trip before it is public, and again if the dates,
        price, size or description change.
      </p>
      <p>5.2 The organiser decides who joins. Your request shares your name, contact, seats and message with the organiser.</p>
      <p>
        5.3 A group trip organised by a traveller is a private arrangement among the people going. Kwetuly does not run it and does not provide the guide, transport or
        accommodation unless the trip says a named guide or company does.
      </p>
      <p>5.4 Every approved group trip has a group chat. Photos and videos from a group chat are used publicly only as set out in section 10.3.</p>

      <h2>6. Money</h2>
      <p>
        6.1 <strong>At soft launch, Kwetuly does not take any payments for trips.</strong> You pay the guide, company or business directly, as you agree with them. Never pay
        anyone who asks you to pay &ldquo;Kwetuly&rdquo; outside the methods shown on the site.
      </p>
      <p>6.2 When deposits are switched on, a Deposit and Refund Policy will apply and will be published on the site.</p>
      <p>
        6.3 Prices are set by the provider. Kwetuly may show amounts in other currencies for convenience; the amount in the offer or invoice is the one that counts.
      </p>

      <h2>7. Safety, health, visas and insurance</h2>
      <p>
        7.1 Mountain climbs, safaris, water trips and remote travel carry real risks. Follow your guide&rsquo;s instructions and park rules. Tell your guide about any health
        condition that matters for the trip.
      </p>
      <p>
        7.2 <strong>Visas.</strong> Kwetuly links only to the official Tanzanian immigration e-visa site (visa.immigration.go.tz). We never apply for visas for you.
      </p>
      <p>
        7.3 <strong>Insurance.</strong> Kwetuly does not sell or arrange insurance. The <Link href={`/${locale}/travel-info`}>Before you travel</Link> page links only to the
        official insurance portals for mainland Tanzania and Zanzibar. Check what your own travel insurance covers, including high-altitude trekking.
      </p>
      <p>
        7.4 Information on Kwetuly (park fees, altitudes, maps, news, AI concierge answers) is general and may be out of date. Maps and altitudes are approximate. Check with
        official sources and your guide.
      </p>

      <h2>8. How to behave on Kwetuly</h2>
      <p>You must not:</p>
      <ul>
        <li>give false information, pretend to be someone else, or use someone else&rsquo;s account;</li>
        <li>harass, threaten or discriminate against anyone;</li>
        <li>post content that is illegal, sexual, violent, hateful, or that shows people without their permission;</li>
        <li>post photos or videos of children for public use without a parent&rsquo;s or guardian&rsquo;s permission;</li>
        <li>write fake reviews, or offer or accept anything in return for a review;</li>
        <li>try to avoid Kwetuly&rsquo;s safety rules, for example by sharing contact details in images to get around hidden contact details;</li>
        <li>scrape, copy or overload the site, or test its security without our written permission;</li>
        <li>use Kwetuly to sell or advertise anything not related to your trip.</li>
      </ul>
      <p>We may remove content, hide reviews, limit or close accounts that break these rules. Report problems with the report button or at {mail}.</p>

      <h2>9. Kwetuly merchandise and shop orders</h2>
      <p>
        9.1 <strong>Kwetuly merchandise</strong> (t-shirts, caps and similar) is sold by Kwetuly through the &ldquo;Kwetuly Shop&rdquo;. Prices are in Tanzanian shillings.
        Kwetuly confirms the price and how to pay before anything is sent. Nothing in these terms limits your rights under Tanzanian consumer law.
      </p>
      <p>
        9.2 <strong>Shop order requests</strong> to curio, gem and gear-rental shops are requests to that shop. The shop confirms the price and how to pay before anything is
        sent, and you pay the shop directly. The shop, not Kwetuly, is responsible for the goods, delivery, certificates (for example for tanzanite) and any export rules. Ask
        the shop for the documents you need.
      </p>

      <h2>10. Content you post</h2>
      <p>10.1 You keep ownership of what you post (messages, reviews, photos, videos).</p>
      <p>
        10.2 You give Kwetuly a non-exclusive, royalty-free licence to store, show and send it as needed to run Kwetuly (for example, to show your review on a guide&rsquo;s
        profile).
      </p>
      <p>
        10.3 <strong>Public use of group-chat media</strong> happens only when you say yes, Kwetuly chooses the item, and nobody in the chat objects. You can stop sharing at any
        time.
      </p>
      <p>10.4 You confirm that you have the right to post what you post.</p>

      <h2>11. AI concierge</h2>
      <p>
        The travel concierge is an AI system, not a person. It can be wrong. Do not rely on it for safety, medical, visa, legal or money decisions; check with official sources
        and your guide. Do not type sensitive personal information into it.
      </p>

      <h2>12. Investment page</h2>
      <p>
        Kwetuly&rsquo;s investment page only makes introductions between people. Kwetuly does not give financial or investment advice, does not hold investors&rsquo; money and
        does not check whether a project is a good investment.
      </p>

      <h2>13. Our responsibility to you</h2>
      <p>
        13.1 We provide Kwetuly with reasonable care and skill. Nothing in these terms limits rights you have under Tanzanian consumer law that cannot be limited, or our
        responsibility for death or personal injury caused by our negligence, or for fraud.
      </p>
      <p>
        13.2 Because the guide, company or business provides the service, Kwetuly is not responsible for their acts or omissions, the quality or safety of their service, or what
        they promised you, except where Kwetuly itself was at fault.
      </p>
      <p>13.3 Kwetuly is free for travellers to use, except paid features named on the site.</p>
      <p>13.4 The site may sometimes be unavailable. We will try to fix problems quickly.</p>

      <h2>14. Complaints and disputes</h2>
      <p>
        14.1 Tell us first at {mail}. For a problem with a guide or business, we may pass on your complaint, ask for their side, and remove their listing or badge, but we cannot
        force them to pay you.
      </p>
      <p>14.2 These terms are governed by the laws of the United Republic of Tanzania.</p>
      <p>14.3 You may also contact the Fair Competition Commission (consumer protection).</p>

      <h2>15. Changes and ending</h2>
      <p>
        We may change these terms. We will post the new version with a date and, for important changes, tell you before they apply. You can stop using Kwetuly at any time. We
        may suspend or close an account that breaks these terms, after telling you why unless that would put someone at risk.
      </p>

      <h2>16. Languages</h2>
      <p>For now these terms are only in English.</p>
    </LegalPage>
  );
}
