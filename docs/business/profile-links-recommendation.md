# Profile links: website and social media (recommendation)

Prepared by conversion on 2026-10-30, after Walter asked whether guide and business profiles need a website link, and said profiles should allow social media links. Draft only. Walter approves; frontend-engineer and backend-engineer build after that, then qa-tester and security-reviewer check the work (it touches user-entered links).

No Kwetuly traffic data exists yet, so every effect size below is an estimate, not a measurement.

## What is on the pages today

| Where | What it shows | Where it sits | Problem |
| --- | --- | --- | --- |
| Business page, web (`apps/web/src/app/[lang]/businesses/[id]/page.tsx`, lines 71-75) | "Website" link, https only (database check in `20261016000200_business_listings.sql`) | Main column, under the story. On a phone the enquiry card comes after the whole main column, so the website link comes **before** the form | The one off-platform exit sits above the main action on phones. There is no sticky "Ask" button on business pages (guide pages have one) |
| Business page, app (`apps/mobile/src/app/business/[id].tsx`, line 73) | "Website" as a **full-width outline button** | Directly above the enquiry card | It looks like the main action and competes with "Send" |
| Guide page, web (`apps/web/src/app/[lang]/guides/[slug]/page.tsx`, lines 200-204) | Instagram, Facebook, TikTok text links | Mid-page, above Share and Reviews | No host check: the labels say "Instagram" but the address only has to start with `https://` (`apps/web/src/app/[lang]/dashboard/actions.ts`, line 28). The database columns have no check at all (`20261012000200_guides.sql`), so another writer could store any address |
| Guide page, app | No social links | n/a | Web and app differ |
| Guide website | No field exists | n/a | n/a |
| Messages (`private.mask_message`) | Hides instagram.com, facebook.com, wa.me and t.me links until a call is accepted | n/a | Social links are hidden in chat but shown in public on the profile. The team should choose this on purpose, not by accident (see below) |
| Travellers | No public profile page | n/a | n/a |

## How links affect revenue

- **Guides.** Deposits are off, so Kwetuly earns nothing on guide trips today (`soft-launch-business-plan.md`, section 1). The risk is a habit: travellers who learn to book guides by WhatsApp from Instagram now are harder to bring back once deposits and the 15% call/lesson commission start (`new-ideas-business-view-2026-10-30.md`).
- **Businesses with a referral agreement.** Commission depends on Kwetuly having a record of the referral (order requests, `leads`, referral codes). A traveller who leaves for the website and books there leaves no record, so the commission is lost. Businesses without an agreement only cost Kwetuly the enquiry data. Badge revenue does not depend on links.
- **Trust.** For a traveller who has never heard of Kwetuly, a real hotel website or a guide's Instagram with years of trip photos is strong outside proof. Removing links does not stop leakage anyway: the business name is on the page and anyone can search for it. Removing them would cost trust and save little.

## The recommendation

### 1. Website link: keep it for businesses, move it below the main action. Do not add one for guides.

- **Businesses:** keep the website, but take it out of the main column. Show it inside the enquiry card, **below the Send button** and the "what happens next" text, as a plain text link (not a button). Show the host name so travellers can see where they are going, for example "Website: serengeti-lodge.co.tz". Do the same in the app: replace the full-width button with a text link under Send.
- **Guides:** do not add a website field. Guides are the core customers and the future deposit and commission revenue. A guide's own website is usually a booking page, which competes directly with the enquiry. Their social pages give the trust benefit (section 2).
- **Operators** (`/operators/[slug]`): no change. Their website and Tripadvisor details are entered and checked by admin, and they are licensed companies.

### 2. Social networks

| Network | Guides | Businesses | Why |
| --- | --- | --- | --- |
| Instagram | Yes | Yes | Most used for trip and place photos; strong visual proof |
| Facebook (page) | Yes | Yes | Widely used by Tanzanian businesses and guides; often has visitor comments |
| TikTok | Yes | Yes | Already supported for guides; short trip videos |
| YouTube | Yes | Yes | Long trip and safari videos; strong proof, low contact leakage |
| X | No | No | Little trip proof for this audience; one more icon competing with the enquiry. Can be added later if guides ask |
| LinkedIn | No | No | Little use to travellers choosing a guide or a stay |
| WhatsApp Business | **No public link** | **No public link** | It is a direct contact channel, not proof. It skips the enquiry completely, shows a phone number to anyone (spam, scams pretending to be the guide), and contradicts chat masking and `provider_private`, where the business WhatsApp is owner and admin only. Kwetuly already uses WhatsApp to alert businesses and guides about enquiries |
| Travellers ("people") | n/a | n/a | No public traveller profiles exist. Do not add social links for travellers: it is a privacy cost with no conversion gain |

Allow at most one link per network, so four in total.

On the conflict with chat masking: keep the masking, and keep the public social links. They do different jobs. The profile link is the guide's own public page, given as proof. Masking stops people moving a live negotiation off Kwetuly before a call is accepted. Write this down in the chat FAQ so customer-care can explain it.

### 3. How to show them without losing the enquiry

- **One main action per page stays the enquiry:** "Ask {name}" / "Order from {name}" and the green Send button. Links are never green buttons, never above the form, and never in the page header.
- **Placement (web and app, guides and businesses):** one row inside the enquiry or contact card, under Send and the "what happens next" text:
  - label: "Also online" (traveller text, needed in all 7 languages; localization to translate)
  - network name with its small logo, then the website host for businesses, as text links in grey `#7F7F7F` with underline
  - a short honest note under the row: "Their own pages. Kwetuly has not checked them." This matters most for businesses with the "Checked by Kwetuly" badge, so the badge is never read as covering their website or social content.
  On desktop this keeps the links near the decision but after it. On phones it puts them after the form.
- **Add a sticky "Ask {business}" button on business pages on phones**, like the guide page's `StickyCta`, so the enquiry is always one tap away even when someone scrolls to the links. Hide it after sending, as on guide pages.
- **No links on sample listings** (`is_sample`): they point at people and businesses who have not joined.
- Proof near the decision stays Kwetuly's own: reviews, the "What Kwetuly checked" list and the badge explanation. Social links come after them.

### 4. Link safety (for backend-engineer and security-reviewer)

- **https only, with known hosts only.** The server accepts a pasted URL or an @handle, turns it into a standard URL, and stores it only if it matches its network:
  - Instagram: `https://www.instagram.com/{handle}/` (handle: letters, digits, `.` and `_`, up to 30 characters)
  - Facebook: `https://www.facebook.com/{page}` or `https://www.facebook.com/profile.php?id={digits}` (`m.facebook.com` is converted to `www`)
  - TikTok: `https://www.tiktok.com/@{handle}`
  - YouTube: `https://www.youtube.com/@{handle}` or `/channel/{id}`
  - Not accepted: link shorteners (`bit.ly`, `fb.me`, `linktr.ee` and similar), `wa.me`, `t.me`, look-alike hosts, user:password@ addresses, and any other ports.
- **Website (businesses):** https only (already enforced), maximum 200 characters, no IP addresses, no shorteners, no `wa.me`/`t.me`. Admin sees the link in the approval queue.
- **Add the same checks as database CHECK constraints**, not only in the web form, because the app and the API also write these columns. Guides' `facebook_url`, `instagram_url` and `tiktok_url` have no constraint today. Before adding constraints, list existing values that would fail and show them to Walter. Do not null or delete them without his approval.
- **Rendering:** `target="_blank" rel="nofollow ugc noopener"`. I recommend not adding `noreferrer`: browsers' default referrer policy (`strict-origin-when-cross-origin`) sends only `https://kwetuly.com`, never the page path, so the business can see visits came from Kwetuly. That helps when Kwetuly shows a business its value at badge renewal. For extra attribution, Walter could approve adding `?utm_source=kwetuly&utm_medium=referral` to business website links only. security-reviewer should confirm the referrer choice.
- **Never build links from free text in the bio or story.** Only the structured fields become links.

### 5. Tracking (data-analyst)

- Add `business_viewed` (pages do not have it yet) and `outbound_link_clicked` with props `{ kind: 'guide' | 'business', network: 'website' | 'instagram' | 'facebook' | 'tiktok' | 'youtube', id }`. No personal data, and keys pass `safeProps`.
- Measure the website link click separately from social links.

## Metrics each choice affects

| Choice | Main metric | Expected direction and size (estimate) | Guardrails |
| --- | --- | --- | --- |
| Business website moved below Send, text link not button | Enquiry or order rate per business page view (`enquiry_sent` with kind business / `business_viewed`) | Enquiry rate +0% to +10% relative. Website clicks per view -20% to -50% relative | Business listing completions (owners may not like the demotion), complaints to partnerships |
| Sticky "Ask" on business pages, phones | Same enquiry rate, phone only | +0% to +15% relative | Bounce rate, accidental taps (enquiry started but not sent) |
| Social links in the card for guides (moved from mid-page) | Enquiry rate per guide view (`enquiry_sent` / `guide_viewed`) | -5% to +5% relative; direction uncertain because more trust and more exits pull opposite ways | Outbound click rate, reply rate, reports of off-platform scams |
| No WhatsApp link | Share of first contacts that come through Kwetuly | Keeps it at today's level; no lift expected | Customer-care tickets that say "I couldn't reach them" |
| Host-checked links | Bad or broken links found in admin review | Toward zero | Guides or businesses who give up on the profile step with a link error (`error_shown`) |

For businesses with a referral agreement, also watch **reported referral sales per enquiry** each month. It is slow and depends on honest reporting, so it is a direction check, not a test result.

## A/B test (business pages first)

- **Question:** does moving the website link from the main column (A, today) into the enquiry card under Send (B) change enquiries without hurting trust?
- **Who:** all visitors to approved, non-sample business pages that have a website, web only, split 50/50 per visitor with a PostHog feature flag. Business owners viewing their own page are excluded.
- **Primary metric:** enquiry or order sent per page view. **Secondary:** outbound website clicks per view, and the share of visitors who click out and later send an enquiry anyway.
- **Guardrails:** bounce rate, `error_shown` on the form, new business listings per week.
- **Length:** at least 2 full weeks, and until each arm reaches the sample size from `n ≈ 16 × p × (1 − p) / d²`, where p is the measured baseline enquiry rate and d the smallest absolute change worth acting on. With invite-only soft-launch traffic this will probably not be reached for months. Until it is, do a **before/after** instead: 4 weeks with the current layout, then 4 weeks with B, comparing the same metrics, and treat the result as a direction, not proof.
- **Risk:** some business owners will feel their website is hidden. partnerships should explain the reason in one line: "Enquiries through Kwetuly show that we sent the guest, which is what your badge renewal and any commission agreement are based on."

A second test (social links in the header next to the name vs in the card) is only worth running once guide traffic is large enough. Start with tracking.

## Build and review order (after Walter approves)

1. backend-engineer: add `youtube_url` to guides; add `instagram_url`, `facebook_url`, `tiktok_url`, `youtube_url` to `providers`; add CHECK constraints after Walter sees the existing values that would fail; a shared normaliser in `packages/shared` used by web and app.
2. frontend-engineer: the "Also online" row in the enquiry card (web and app), sticky Ask on business pages, the business website moved and shown as a text link in the app, form fields in the guide and business editors, and the two events.
3. localization: the label and the "Their own pages. Kwetuly has not checked them." note in all 7 languages; editor field labels in English and Kiswahili.
4. security-reviewer: link validation, referrer choice, no links built from bio text. qa-tester: phone layout, slow connection, pasted handles and bad links.
5. data-analyst: add the events to the weekly scorecard.

## Decisions for Walter

1. Keep the business website, below Send, as a text link. Never above the form. (Recommended.)
2. No website field for guides. (Recommended.)
3. Allowed networks: Instagram, Facebook, TikTok, YouTube for guides and businesses. No X, LinkedIn or public WhatsApp link. No links for travellers. (Recommended.)
4. Add `utm_source=kwetuly` to business website links: yes or no. (Optional.)

Noticed on the way, outside this topic: the "open to partners" link on guide pages ends with "→" (`guides/[slug]/page.tsx`, line 179), which breaks the "no arrows on buttons" brand rule.
