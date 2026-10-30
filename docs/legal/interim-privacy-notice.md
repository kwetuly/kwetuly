# Interim privacy notice and data deletion instructions

> **DRAFT – to be reviewed by a Tanzanian advocate.** Not legal advice.
> Prepared 2026-10-30 by the Kwetuly legal research helper (AI). Version 0.1.
> Purpose: Google's OAuth consent screen and Meta's Live mode need a public privacy policy URL, and Meta also needs a data deletion instructions URL, before "Continue with Google" and "Continue with Facebook" can be offered to the public. The full privacy policy (docs/legal/privacy-policy.md) is still waiting for the advocate. This is a short stand-in.
> **Walter must approve both texts before they are published.** Square brackets `[...]` are gaps for Walter to fill (or to confirm with tech-lead). Do not fill them with guesses. Lines starting with "Note for Walter" are not part of the public text and must be removed before publishing.
> Sources: the database migrations in `supabase/migrations`, `apps/web/src`, `apps/mobile/src/lib/social.ts`, `supabase/functions/notify` and `supabase/functions/payments`, and `packages/shared` (read 2026-10-30).

---

## Part A. Page text for kwetuly.com/privacy

# Kwetuly privacy notice (interim)

Last updated: [DATE OF PUBLICATION]

**This is a short interim notice.** Kwetuly is preparing a full privacy policy with a Tanzanian advocate. When it is ready it will replace this page, and we will tell account holders by email before any important change applies.

### Who we are

Kwetuly runs the website kwetuly.com and the Kwetuly app. Kwetuly helps travellers find and talk to independent Tanzanian guides and local businesses.

- Operator: [COMPANY LEGAL NAME, or the name of the person running Kwetuly until the company is registered]
- Address: [POSTAL ADDRESS, TANZANIA]
- Registration with the Personal Data Protection Commission: [PDPC REGISTRATION NUMBER, or "application pending"]
- Privacy contact: support@kwetuly.com

Note for Walter: the company is not registered yet. Google and Meta both check that the policy names who is responsible. Write your own name here, or the company name once BRELA registration is done; ask the advocate which is right.

### If you sign in with Google or Facebook

When you choose "Continue with Google" or "Continue with Facebook", that service asks your permission and then sends us:

- your name;
- your email address;
- a link to your profile photo;
- an account ID that the service uses for Kwetuly.

What we do with it:

- We use your email address and the account ID to create your Kwetuly account and sign you in.
- We copy your name into your Kwetuly profile. You can change it on the welcome step and later.
- We do not show your Google or Facebook photo on Kwetuly. Our sign-in provider (Supabase) keeps it together with the other sign-in details. A guide or business photo on Kwetuly is only one you upload yourself.
- We do not get your password, your contacts, your friends list or your posts, and we cannot post anything for you.
- We use this information only to run your Kwetuly account. We do not sell it, we do not use it for advertising, and we do not share it with Google or Facebook beyond what is needed to sign you in.

After you sign in for the first time, we ask you to choose your account type (traveller, guide or business) and to add a phone number before you can use Kwetuly.

You can also remove Kwetuly from your Google or Facebook account settings. This stops future sign-ins through that service, but it does not delete your Kwetuly account. To delete your account, see "Deleting your data" below.

### Other information we keep

What we keep depends on how you use Kwetuly:

- **Account:** email address, name, phone number, preferred language, account type, the invite code you used, and a two-step sign-in factor if you turn that on. If you sign up with email, your password is held by our sign-in provider in a form we cannot read.
- **Guide and business profiles:** what you publish (for example name, photo, bio, regions, languages, prices, packages, listing details and photos), plus private details that are never shown publicly: WhatsApp number, registration and licence numbers, and copies of documents such as your ID, guide licence or business licence. Documents are kept in private storage that only you and Kwetuly admins can open.
- **Messages and group chats:** messages you send, and photos and videos you share in group chats. In one-to-one messages, phone numbers, emails and WhatsApp links are hidden from the other person until a booking or call is confirmed. Kwetuly admins can read messages and chats, including the original text, to keep people safe and deal with reports.
- **Uploads:** profile and listing photos, documents, and group-chat photos and videos.
- **Enquiries, trip requests and bookings:** what you send to a guide or business (for example name, contact, dates, number of travellers, budget and message), offers, which offer you accepted, group-trip join requests, call requests and reviews. When an offer is accepted, both sides can see each other's email and phone number.
- **Payments (when deposits are switched on):** amount, what it was for, status, and the payment provider's reference. We never receive your full card number or mobile-money PIN.
- **Alerts:** your email address, phone number and app notification token, so we can tell you about messages, offers and bookings.
- **Travel concierge:** what you type to the AI travel assistant, so it can answer.
- **Usage and technical data:** pages viewed and buttons used, without cookies and without your name, email or phone; and the IP address, device and error logs kept by our hosting providers.

### Who helps us run Kwetuly

These service providers process data for us. Several are outside Tanzania.

| Provider | What it does for Kwetuly |
| --- | --- |
| Supabase | Database, sign-in, file storage and server functions |
| Vercel | Hosts the website |
| Resend | Sends email alerts |
| Meta (WhatsApp Business) | Sends WhatsApp alerts |
| Expo | Sends app notifications |
| Anthropic | Answers questions sent to the travel concierge |
| PostHog (EU) | Cookieless usage statistics |
| Google and Facebook | Sign-in, only if you choose it |
| Selcom | Card and mobile-money payments, only when deposits are switched on |
| OpenFreeMap and Amazon Web Services | Map images on tour pages; they see your IP address when a map loads |

We do not sell personal data and we do not share it with advertisers. We share information with authorities only when the law requires it, or to protect someone's life or safety.

Note for Walter: tech-lead to confirm the Supabase project region and Vercel region, whether PostHog, the concierge and WhatsApp alerts are switched on in production at publication, and whether the map still loads anything from unpkg (the October draft listed it; it was not found in the code on 2026-10-30). Remove rows for services that are not in use.

### Your rights under Tanzanian law

Kwetuly follows the Personal Data Protection Act, 2022 (Act No. 11 of 2022) of Tanzania. Under the Act you can ask us:

- to tell you what personal data we hold about you, why, and who we share it with;
- to correct data that is wrong, incomplete or misleading;
- to delete data that is no longer needed or should not be held;
- to stop using your data in ways that harm you, and not to be subject to decisions made only by a computer that significantly affect you (Kwetuly does not make such decisions).

To ask, write to **support@kwetuly.com** from the email address on your account and say what you want. We may need to confirm it is you. We will reply within [RESPONSE TIME, to be set with the advocate].

If you are not happy with our answer, you can complain to the Personal Data Protection Commission: https://pdpc.go.tz.

### Deleting your data

You can delete your account yourself at any time, or ask us to do it. See kwetuly.com/data-deletion for the steps.

### Cookies

Kwetuly only uses what is needed to keep you signed in and remember your language. Our usage statistics do not use cookies. We do not use advertising cookies.

Note for Walter: frontend-engineer to confirm the exact cookies (Supabase sign-in, language, team-preview cookie) before publishing.

### Children

Kwetuly accounts are for people aged [MINIMUM AGE, proposed 18] and over.

### Contact

support@kwetuly.com

---

## Part B. Page text for kwetuly.com/data-deletion

# How to delete your Kwetuly data

Last updated: [DATE OF PUBLICATION]

You can delete your Kwetuly account and data at any time. This works the same whether you signed up with email, Google or Facebook.

### Option 1: delete it yourself (immediate)

**On the website**
1. Sign in at kwetuly.com.
2. Open your account's Security page (kwetuly.com/en/security).
3. Under "Delete my account", type the email address of your account.
4. Press "Delete my account permanently".

**In the app**
1. Sign in to the Kwetuly app.
2. Go to [MENU PATH TO "Delete my account", to be confirmed by frontend-engineer].
3. Confirm the deletion.

### Option 2: ask us

Send an email to **support@kwetuly.com** with the subject "Delete my account", from the email address on your account. If you signed in with Facebook or Google, use the email address of that account. We will confirm it is you, delete the account, and reply to tell you it is done, within [RESPONSE TIME, to be set with the advocate].

### What is deleted

Your profile, guide profile or business listing, messages, chats, reviews, trip requests, saved tours, and the photos and documents you uploaded are removed permanently. This cannot be undone.

### What is kept, and why

- **Payment records** are kept for accounting and tax, with your name removed. [RETENTION PERIOD FOR FINANCIAL RECORDS]
- **Enquiries you sent to a guide or business** stay with them as a record, but your name, contact details and message are removed. [Confirm with tech-lead that this cleanup is live.]
- **Alert records** (which emails or WhatsApp messages we sent) are deleted automatically after 30 days, or 90 days if sending failed. [Confirm with tech-lead that this cleanup is live.]
- **Backups** held by our database provider may hold a copy until they expire after [BACKUP PERIOD].
- Messages you sent to other people in group chats may remain visible to them. [Confirm with tech-lead how group-chat messages from a deleted account are handled.]

### Removing Kwetuly from Facebook or Google

Removing Kwetuly from your Facebook or Google account settings stops Kwetuly from signing you in through that service. It does not delete the data Kwetuly already has. Use Option 1 or Option 2 above for that.

### Questions

support@kwetuly.com

---

## Notes for Walter (not for publication)

1. **Gaps to fill:** operator name and address, PDPC registration status, publication date, response time, minimum age, retention period for payment records, backup period, the app's menu path to "Delete my account".
2. **The coming-soon gate.** The live site shows a coming-soon page until launch (commit 94310b9). Google and Meta reviewers must be able to open /privacy and /data-deletion without the team password. frontend-engineer must leave these two paths outside the gate when building the pages.
3. **support@kwetuly.com must work** before publication; Google and Meta may write to it, and deletion requests arrive there. Someone must check it and handle requests (operations-manager can write the checklist).
4. **Things to confirm with tech-lead before publishing, so the notice is true:**
   - Supabase keeps the Google or Facebook profile photo link in its sign-in records; Kwetuly code does not copy it into the profile (no use of `avatar_url` or `picture` from sign-in data was found).
   - Which Google and Facebook permissions are requested. The code uses Supabase's defaults and requests no extra scopes; this notice assumes only name, email and photo.
   - Whether migration `20261016001200_account_deletion_cleanup.sql` (enquiry blanking, 30/90-day alert purge, coming-soon sign-up deletion) is applied in production. The legal README of 2026-10-16 said it was not yet applied.
   - What happens to a deleted person's group-chat messages, and Supabase backup retention for the current plan.
   - Which services are live (PostHog, concierge, WhatsApp alerts, Selcom), and the Supabase and Vercel regions.
5. **Meta also accepts a data deletion callback** instead of instructions. Instructions (this page) are enough for now and need no extra build.
6. **Translations.** Interim: English only, unless you want Kiswahili too (localization can prepare it after approval). Traveller texts normally go in all 7 languages.
7. **No approval implied.** This draft is not approved for publishing until you say so, and should go to the advocate together with the full privacy policy.

## Law and sources

| Point | Source | Checked against official text? |
| --- | --- | --- |
| Personal Data Protection Act, 2022 (Act No. 11 of 2022), now cited as Cap. 44 R.E. 2023 | [Clyde & Co, Feb 2023](https://www.clydeco.com/en/insights/2023/02/tanzania-personal-data-protection-act-of-2022); [Clyde & Co, May 2026](https://www.clydeco.com/en/insights/2026/05/understanding-data-subject-rights-in-tanzania-acce) | No. The official text (Attorney General's site, TanzLII) could not be opened on 2026-10-30 |
| Right of access, s. 33; rectification, erasure and destruction, ss. 29 and 38; informing third parties after correction, s. 38(4); automated decisions, s. 33(c) | [Clyde & Co, May 2026](https://www.clydeco.com/en/insights/2026/05/understanding-data-subject-rights-in-tanzania-acce) | No, secondary source only. This is why the public text names the Act but no section numbers |
| Registration with the Commission before collecting or processing; transfers abroad allowed subject to conditions; complaints to the Commission | [Clyde & Co, Feb 2023](https://www.clydeco.com/en/insights/2023/02/tanzania-personal-data-protection-act-of-2022) | No |
| Personal Data Protection Commission: website, complaint form, registration portal, helpdesk@pdpc.go.tz, P.O. Box 1105, Dodoma | [pdpc.go.tz](https://pdpc.go.tz/); [complaint form](https://dataprotection.pdpc.go.tz/complaint-form-one) | Yes, the official PDPC site (2026-10-30) |
| Complaints Settlement Procedures Regulations, 2023 | Mentioned in search results; text not read | No |
| PDPC on-site compliance inspections from 31 August 2026 | [The Citizen](https://thecitizen.co.tz/tanzania/news/national/data-protection-regulator-begins-compliance-crackdown-5574710) | No, press report |

## Open questions for the advocate

1. Can Kwetuly publish a privacy notice and collect sign-in data before the company is registered and before it holds a PDPC registration certificate? Whose name should appear as the responsible party in the meantime?
2. Is an interim notice like this enough under the Personal Data Protection Act, 2022 for an invite-only soft launch, or must the full policy be in place first?
3. Please confirm the section numbers for data subject rights (reported as ss. 29, 33 and 38 of Cap. 44 R.E. 2023) and whether the public notice should cite them.
4. Is there a legal deadline and any fee allowed for answering access and deletion requests? What should we write as the response time?
5. Cross-border transfers: nearly all processing (Supabase, Vercel, Resend, Meta, Expo, Anthropic, PostHog EU) happens outside Tanzania. What must Kwetuly do (PDPC permit, contract clauses, consent), and what must the notice say about it?
6. How long must payment and accounting records be kept in Tanzania, and is keeping them with the name removed acceptable after a deletion request?
7. Is it lawful, and enough to disclose it in the notice, that admins can read all messages and chats including the original text of hidden contact details?
8. Is the cookieless usage analytics acceptable without asking for consent?
9. What minimum age should accounts have, and must it be checked?
10. Are 30 days (sent alerts) and 90 days (failed alerts) acceptable retention periods, and must the notice state retention periods for the other data?
