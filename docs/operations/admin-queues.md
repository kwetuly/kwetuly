# Admin queues: what waits, what is "ready", and the daily routine

Prepared by operations-manager, 2026-10-31, for the "Admin dashboard" plan in `docs/team/board.md` (step 1a).
This is paper only. Nothing here is built yet, and nothing is decided until Walter says yes. Where this paper says "proposal", Walter decides.

Based on how the admin pages work today: `apps/web/src/app/[lang]/admin/page.tsx`, `actions.ts`, `businesses-admin.tsx`, `pending-packages.tsx`, `admin/messages`, `admin/trips`, and `docs/tech/items-approvals-orders-design.md` section 2.

Rules that apply to everything below:
- Only an admin acts. Agents prepare; Walter (or an admin he names) approves, rejects, pays out and calls people.
- Sample items (`is_sample`) are test data. They never count in the real numbers, are never ticked by "approve all ready", and are deleted before launch.
  - What counts as a sample: a guide or business marked `is_sample`, and any package or group trip that belongs to a sample guide.
- No personal data in this document. The admin pages show phone numbers only where a call is needed (group trip organisers, guides under review). The users list masks phone numbers.

---

## 1. The daily queues

| # | Queue | What is waiting | Where today | What the admin does |
|---|---|---|---|---|
| 1 | Guides to approve | Guide profiles with status pending | /admin, top section | Opens the ID and licence through the short-lived links, ticks only what they actually looked at, saves the ticks, then approves or rejects |
| 2 | Guide documents to re-check | Approved guides who uploaded a new ID, licence or first-aid certificate that nobody has ticked yet | /admin, same section, labelled "Approved guide: new document to check" | Opens the document, ticks it, sets the first-aid end date, presses "Save checks". The guide stays live during this |
| 3 | Packages | Guide packages with status pending, oldest first. A package goes back to pending when the guide changes it | /admin, "Guide packages" | Checks that the price, length and description are realistic and that the guide may run this kind of trip. Approves, or rejects with a note the guide sees |
| 4 | Businesses | Business listings with status pending | /admin, "Businesses" | Checks the name, type, place, story, website (a bad link shows in red), photo and business licence. Approves or rejects |
| 5 | Badge requests | Businesses that asked for the paid "Checked by Kwetuly" badge | /admin, "Badge check requests" | Only after the fee is received and the checks are done: ticks only the checks done, adds a private note (payment reference, who checked), saves. The badge then shows for one year. Unticking everything closes the request with no badge |
| 6 | Jobs | Job and client-handover posts with status pending | /admin, "Jobs" | Reads the role, place, pay and how to apply. Approves or rejects |
| 7 | Group trips | Group trips with status pending (cancelled trips are left out) | /admin, "Group trips" | Checks the organiser, dates, price and what is included. For a traveller organiser: calls the number shown, presses "Phone confirmed", then approves. The database refuses approval without a confirmed phone |
| 8 | Reviews | Traveller reviews of guides. They are public straight away, there is nothing to approve | /admin, "Latest reviews" (last 30) | Reads new reviews and hides abusive, off-topic or fake ones. Can show them again |
| 9 | Message reports | Messages that a guide or traveller reported, not yet resolved | /admin/messages, "Open reports" | Reads the original message (before contact details were hidden), deals with it, then presses "Mark resolved" |
| 10 | Payments | Deposits that are not pending. Two kinds need action: status "review" (check with Selcom) and status "paid" but not yet paid out | /admin, "Payments" (last 50) | "review": checks the amount with Selcom and accounting. "paid": pays the guide or company outside the site, then presses "Mark paid out". Empty until deposits are switched on |

Watch lists (nothing to approve, but they should be looked at every day):

| Watch list | Where today | Why |
|---|---|---|
| Trips flagged "Details being re-checked" | /admin/trips | Travellers see a warning until someone re-checks the facts against official sources |
| Trip enquiries with no guide (and enquiries to sample guides or listings) | /admin, "Trip enquiries" | Nobody else will answer them. customer-care drafts a reply; an admin sends it |
| Trip requests | /admin, "Trip requests" (last 15) | Requests with 0 offers after a day may need a nudge to guides (guide-success) |
| Sign-ups and partner applications | /admin, "Sign-ups" | Business and travel agent applications go to partnerships; guide interest goes to guide-success |

---

## 2. What the admin home counts show

One tile per queue. Each tile shows:
- The number waiting, real items only. Samples appear as a separate small line ("samples: 3") and never in the main number.
- How long the oldest item has waited ("oldest: 2 days").
- A red marker when the oldest item is past its target time (section 6).
- A link to the matching tab or page.

| Tile | Number shown | Extra line |
|---|---|---|
| Guides to approve | Pending guides | "n ready to approve" (pass the ready rule) |
| Guide documents | Approved guides with a document not yet ticked | none |
| Packages | Pending packages | "n ready" |
| Businesses | Pending businesses | "n ready" (if Walter allows batch for businesses, see 3.4) |
| Badge requests | Open badge requests | none |
| Jobs | Pending jobs | none |
| Group trips | Pending group trips | "n need a phone call" (traveller organiser, phone not confirmed) |
| Message reports | Open reports | none |
| Reviews | New reviews in the last 7 days | "n hidden". There is no "seen" mark today, so this is a time window, not a to-do count |
| Payments | "n to check with Selcom" and "n to pay out" | Hidden while deposits are off |
| Trips flagged | Trips flagged for re-check or with an outdated price | none |
| Enquiries | Enquiries with no guide in the last 7 days | none |
| Trip requests | Open requests with 0 offers | none |
| Sign-ups | New in the last 7 days | none |

Totals at the top: "Waiting for you: n" (sum of queues 1 to 7, 9 and 10) and "Past target: n".

---

## 3. The "ready" rule per kind

"Ready" means an item can be ticked for "Approve selected" and is included in "Approve all ready on this page". An item that is not ready shows the reason on its card and can still be approved one by one, as today.

The same rules are checked again on the server for every item at the moment of approval. An item that changed after the page was loaded (status no longer pending, or a rule no longer met) is skipped, and the reason is reported.

Every kind: not a sample, still pending.

### 3.1 Guide (new application)
Ready only when all of these are true:
- The ID tick and the licence tick were already saved, one guide at a time. That means the identity check date and the licence check date are both filled in.
- A registration number has been entered.
- No self-declared skills are waiting for proof: no special expertise and no "female guide" option chosen. Kwetuly has no "proof seen" record for these yet, so a guide who chose any of them is approved one by one, after Walter has seen the proof.
- First aid is optional and does not block "ready".

### 3.2 Guide documents on approved guides
Never ready. Ticking a document is a record that a person looked at it, so it is always done one by one.

### 3.3 Package (proposal)
Ready when:
- The guide is approved and has the licence tick saved.
- A price and a length are filled in.
- The kind is one of: cultural visit, one-on-one trip, day trip, food and cooking, city walk, nature and hiking.

Not ready, so approved one by one: multi-day trips (park entry, mountain and safety questions) and "Other".

### 3.4 Business (proposal, Walter chooses)
Today there is no saved record that someone opened a business's licence, unlike the guide ticks.
- Option A (recommended for phase 1): businesses are never ready. Approve one by one until a "licence seen on [date]" record exists. Phase 2 adds that record, together with the TIN and business licence that Walter has decided to collect.
- Option B: ready when a business licence is uploaded, any website is valid, a WhatsApp number is on file, and the type is one of: hotel, lodge or camp, homestay, hostel, apartment, curio and art shop, restaurant, massage and spa, salon and barber. In this option the licence itself is still not opened during a batch.

Under both options these types are never batch-approved: tanzanite and gems, transport, car hire, gear rental, nightlife, other. Tour operators and travel agents, when they are added, need their MNRT licence seen and its expiry recorded.

### 3.5 Group trip
- Traveller organiser: ready only when the organiser's phone is confirmed. That confirmation is a call made by a person, and the "Phone confirmed" button is pressed one trip at a time.
- Guide organiser: ready when the guide is approved.
- Company organiser: never ready. Kwetuly has no check of who the company is, so these are approved one by one.
- All group trips also need a start date in the future and a price above zero.

### 3.6 Job (proposal)
Never ready in phase 1. A job post is free text with contact details and pay. Walter decided that pay must follow the government minimum wage, and that cannot be checked automatically. Each post takes seconds to read.

---

## 4. Never batch-approved

- Rejecting anything. There is no "reject all" or "reject selected" in phase 1: a rejected guide or business cannot send their profile again today, and only packages have a reason box.
- Ticking document checks (ID, licence, first aid), and approved guides' new documents.
- Guides with self-declared skills or the "female guide" option.
- Confirming a phone number (one call, one press).
- Badge grants. They need the fee received and each check actually done.
- Marking payments as paid out. Each one is matched to a real transfer reference with accounting.
- Resolving message reports, and hiding or showing reviews.
- Jobs, company group trips, packages that are multi-day or "Other", and the business types listed in 3.4. In phase 1, all businesses unless Walter picks option B.
- Anything marked as a sample.
- Anything outside the review queues: publishing or un-flagging trips, news, commission statements, the badge fee, invite codes, places, merchandise.

Batch safeguards (from the board, kept here so the build follows them):
- A confirm screen shows the count and every name.
- At most 50 items at a time.
- The server re-checks each item.
- A result line, for example "18 approved, 2 not approved: phone not confirmed".
- The existing approval notices (guide approved, group approved) still go out for each item.

---

## 5. Daily checklist (admin, East Africa Time)

Morning (about 20 minutes):
1. Open the admin home. Note anything with a red "past target" marker and do that first.
2. Message reports: read every open report. Threats, scams, requests to pay outside Kwetuly, or anything about someone's safety go to Walter at once. Resolve the rest.
3. Group trips: call traveller organisers whose phone is not confirmed, confirm the phone, then approve ready trips. Do trips starting within 7 days first.
4. Guides: open documents, save ticks one guide at a time, then "Approve all ready". Approve guides with self-declared skills one by one, only after the proof has been seen.
5. Guide documents to re-check: tick and save each one.
6. Packages: "Approve all ready", then read multi-day and "Other" packages one by one. If you reject one, write a note the guide can act on.
7. Businesses and jobs: one by one (unless option B).

Afternoon (about 10 minutes):
8. Reviews: read new reviews and hide only abusive, off-topic or clearly fake ones. Never hide a review because it is negative.
9. Enquiries with no guide: hand them to customer-care for a draft reply.
10. Sign-ups: hand businesses and travel agent applications to partnerships, and guides to guide-success.
11. Payments (once deposits are on): check "review" items with Selcom and accounting. Mark paid out only after the transfer is done.
12. Badge requests: check whether the fee has arrived (accounting). Book check visits with partnerships.

Weekly (Monday):
- Trips flagged or with an outdated price: re-check against official park sources (tech-lead or marketing to research, Walter to publish).
- Trip requests with no offers: guide-success.
- Anything that has waited more than 7 days: list it for Walter.

---

## 6. Target response times (proposal)

Working hours: Monday to Saturday, 08:00 to 18:00 East Africa Time. "Day" means a working day.

| Queue | Target |
|---|---|
| Message reports about safety, threats or scams | Within 4 working hours |
| Other message reports | Same day |
| Group trips | 1 day. Same day if the trip starts within 7 days |
| Packages | 1 day |
| Jobs | 1 day |
| Guides (new) | 2 days after the documents are uploaded |
| Guide documents to re-check | 2 days |
| Businesses | 2 days |
| Badge requests | Reply within 2 days. Checks and visit within 10 days after the fee arrives |
| Reviews (hide if needed) | 1 day |
| Payments in "review" | 1 day |
| Payouts | Within the time in the guide's or business's agreement (accounting confirms) |
| Enquiries with no guide | Draft reply the same day |

Cover when the admin is away: today Walter is the only admin, so nothing gets approved while he is away. Walter decides whether to name a second admin or to accept a paused queue. If the queue is paused, customer-care tells people the expected wait.
