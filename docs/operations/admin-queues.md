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

---

# Guide document checks (added 2026-11-08)

Prepared by operations-manager for step 1c of `docs/team/plan-guide-checks-2026-11.md`. This is a proposal on paper. It describes the admin work once the checks table, the approval gate and the expiry queue from that plan are built. Nothing changes on live, and no guide is told anything, until Walter decides (plan section 9).

When the gate goes live, it replaces parts of sections 1, 3.1 and 6 above:
- Queue 1 (guides to approve) needs a current guide licence and a current first aid or WFR certificate, plus a current driving licence for guides who drive guests, plus ID if Walter keeps it (decision 1). First aid is no longer optional, so the line "First aid is optional and does not block ready" in 3.1 stops applying.
- Queue 2 (documents to re-check) becomes "Renewals waiting for check". If Walter agrees to decision 4, a new upload no longer clears the current check.
- A new queue is added: "Expiring in 30 days / expired" (section 8).

## 7. Checklist per document

### 7.1 What a check means, and what it does not

A check is a record that a named Kwetuly admin looked at a document uploaded through Kwetuly, on a given date, and wrote down the valid-until date printed on it. It is nothing more.

What Kwetuly does not do. The checklist, the admin screens and every text must keep to this:
- Kwetuly does not confirm any document with a government register, an association or the issuer. Never write or say "confirmed with the register", "verified", "certified by Kwetuly" or "recommended".
- Kwetuly does not judge a guide's skill, fitness, experience, route knowledge or first aid ability.
- Kwetuly does not check vehicles, vehicle insurance or permits for a vehicle.
- Kwetuly does not decide whether a licence category or driving licence class allows a certain trip. That waits for legal (plan section 7).

Words to use: "seen on {date}", "checked on {date}", "valid until {date}". Certificates Kwetuly has not seen stay under "Stated by the guide".

### 7.2 Steps for every document (one check card, one document)

1. Open the document only through the short-lived link on the check card. Do not download it to a personal device, take screenshots, or forward it.
2. Accept only documents uploaded through Kwetuly. A photo sent by WhatsApp, email or chat is never checked. Ask the guide to upload it in the dashboard or app instead.
3. Check that the type is right. The file must be the document named on the card, for example a first aid certificate on the first aid card, not a course invitation.
4. Check that it is readable. The whole document is visible (all four corners), the name, number, issuer and dates can be read, and nothing is covered.
5. Check the name. The name must match the guide's profile and, if the ID check is kept, the ID. If the photo on a licence or driving licence is clear, compare it with the ID photo.
6. Look for signs of editing: different fonts in the name or dates, blurred patches over text, or dates that do not line up. If in doubt, do not tick (see 7.4).
7. Enter the valid-until date exactly as printed (see 7.5). It must be today or later for the check to count towards the gate.
8. Tick and save. The date seen and the admin's account are recorded automatically.
9. If something is wrong, do not tick. Leave the document waiting and use the "what to ask the guide" reasons in 7.4.

Every document is checked one guide at a time and one document at a time. "Approve all ready" only takes guides who already pass the gate. It never ticks a document.

### 7.3 Per document

| Document | Needed for | What the admin looks for | Reject (do not tick) if | Valid-until |
|---|---|---|---|---|
| ID (if Walter keeps decision 1) | Every guide | An official photo ID. The name and photo can be read, and the name matches the profile | Unreadable or cropped; the photo cannot be seen; the name does not match; it is not a photo ID; signs of editing | Enter it if one is printed. Whether an expired ID can be accepted is a question for Walter (see questions) |
| Guide licence | Every guide (gate) | The name matches the ID. The licence or registration number matches the number the guide typed on the profile. The issuer can be read. The valid-until date is printed. If a category or level is printed, write it in the private note as printed, without judging it | Expired; the number does not match the profile; the name does not match; the valid-until date cannot be read; it is a receipt or an application form instead of the licence; signs of editing | Required. If no expiry date is printed on the card, do not tick. Bring it to Walter (see questions) |
| First aid certificate | Every guide, unless a current WFR is checked (gate) | The name matches. The course provider, the course date and the valid-until date can be read | Expired; no provider named; only a letter saying the course was booked or attended, with no certificate; the name does not match | Required. If only a course date is printed, see the questions. Never work out an expiry date that the certificate does not state |
| WFR (Wilderness First Responder) | Alternative to first aid (gate) | As for first aid. The title on the certificate says Wilderness First Responder (or the provider's own name for that course, as printed) | As for first aid. A shorter wilderness first aid course is recorded as first aid or as "other", not as WFR | Required. Same rule as first aid |
| Driving licence | Only guides who switched on "I drive guests" (gate) | The name and photo match the ID. The number and valid-until date can be read. Write the class or classes printed in the private note, as printed | Expired; the name does not match; it is not a full driving licence as printed on the card (for example, the card says it is a learner or temporary permit); signs of editing. Do not reject because of the class until legal has said which class is needed | Required |
| Other certificate | Optional, never counts towards the gate | A title is entered (for example "Mountain rescue course"), the name matches, and the issuer and date can be read | No title; unreadable; the name does not match | Enter it if printed, otherwise leave it empty. The traveller line then says "{certificate} seen {date}" with no valid-until |

A current WFR covers the first aid requirement. A guide with an expired first aid certificate and a current WFR stays live, and the other way round.

### 7.4 When something is wrong: do not tick, ask

Do not reject the guide because of a document problem. Today a rejected guide cannot send their profile again (section 4). Leave the document waiting and ask the guide to upload it again. The admin sends that note, using drafts from guide-success. Agents do not contact guides.

Reasons to give the guide, in plain words (guide-success writes the English and Kiswahili text):
- "The photo is not clear. Please upload a sharp photo showing the whole document."
- "We could not read the valid-until date."
- "The name on the document is different from the name on your profile."
- "This document has expired. Please upload the current one."
- "The licence number on the card is different from the number on your profile."
- "This is not the document we asked for."

Bring the case to Walter instead of asking the guide when:
- the document looks edited or belongs to someone else (do not accuse the guide in any message);
- the name difference is small (a missing middle name, a different spelling or order) and the admin is not sure;
- the licence has no printed expiry date, or the certificate states no validity.

### 7.5 How to record the dates

- Date seen: filled in automatically with the day the admin ticks. It is never typed by hand and never backdated. If a document was looked at earlier but not ticked, it is ticked on the day it is looked at again.
- Valid-until: copied exactly from the document. Never guessed, never worked out from a course date, never extended. If only a month and year are printed, see the questions for Walter.
- If the valid-until date is less than 30 days away, the document can still be ticked. The 30-day reminder then starts at once (section 8).
- Private note: only what helps the next admin, for example "category as printed: ..." or "name order differs, Walter OK on {date}". Never copy ID numbers, licence numbers, dates of birth or addresses into the note, a spreadsheet, the board or a chat.
- Renewals: a renewed document is checked with the same steps. Once ticked, it replaces the old check, which is kept as "superseded" and is never shown to travellers.

## 8. Expiry queue: "Expiring in 30 days / expired"

### 8.1 What it shows

One line per check, for real approved guides only (samples are left out):
- the guide's display name and the kind of check (licence, first aid, WFR, driving licence, ID, other);
- the valid-until date and the days left, or "expired {n} days ago";
- whether the check is required for the gate;
- whether a renewal upload is waiting for check;
- whether the guide has a confirmed trip or an accepted offer in the next 14 days (proposal; needs the booking data the system already has).

Order: (1) required checks that have expired, (2) required checks expiring within 7 days where the guide has a trip, (3) renewals waiting for check, (4) everything else by days left. A red marker shows on lines 1 and 2.

A guide who switches on "I drive guests" without a current driving licence check also appears here, as "driving licence missing".

### 8.2 Reminders

- 30 days before any valid-until date, the guide and the admin get a text-only notice through the notification outbox (plan section 3). The guide's text says which document, the date and how to upload the new one.
- Proposal: a second reminder 7 days before, for required checks only (Walter decides).
- No reminder is sent for samples.

### 8.3 What happens on expiry

Required check (licence; first aid when there is no current WFR, or WFR when there is no current first aid; driving licence when the guide drives guests; ID if it is required and has an expiry):
- If Walter agrees to decision 3, the profile is hidden from lists automatically on the expiry day, and its page shows "not available". The guide sees why on the dashboard. The admin does not need to press anything.
- The same day, the admin checks the queue and confirms the profile has dropped off the lists.
- If the guide has a confirmed trip in the coming days, the admin brings it to Walter the same day. Walter decides whether the guide renews before the trip, the trip moves to another guide, or customer-care tells the traveller. Nobody tells the traveller that the trip is safe or unsafe.
- When the renewal is checked, the profile comes back by itself. Nothing else needs approving again.

Other certificates (not required):
- Nothing is hidden. The line is removed from the traveller's checks card, or shown as expired (designer and frontend choose; never shown as current).

What is never done on expiry: rejecting the guide, deleting the guide's documents, or contacting the guide's travellers without Walter.

### 8.4 Additions to the daily and weekly checklist (section 5)

Morning, after step 5:
- 5a. Expiry queue: deal with red lines first. Expired required checks: confirm the profile is hidden and bring any coming trips to Walter. Then check waiting renewals, one document at a time.

Weekly (Monday):
- Read the whole expiry queue for the next 30 days. Give guide-success a list of display names (no documents, no numbers) for guides who have not uploaded a renewal and expire within 14 days, so a reminder note can be drafted for Walter to send.
- Count, for the scorecard (data-analyst): guides hidden because of an expired check, renewals checked, average days from upload to check. Counts only.

## 9. Service levels for guide checks (proposal)

Same working hours as section 6 (Monday to Saturday, 08:00 to 18:00 East Africa Time). The clock starts when the guide uploads the document.

| Item | Target |
|---|---|
| First check of a new guide (all required documents uploaded) | 2 days, as in section 6 |
| Renewal waiting for check | 2 days |
| Renewal where the current check expires within 7 days | Same day, so the guide is not hidden while waiting for Kwetuly |
| Required check expired, or "driving licence missing" for a guide who drives guests | Noticed and confirmed the same day (safety) |
| Required check expired or expiring, with a trip in the next 14 days | Brought to Walter the same day |
| Document problem: note to the guide saying what to upload again | Same day as the check |
| Guide's question about a document that was not ticked | 1 day (guide-success drafts, the admin sends) |
| 30-day and 7-day reminders | Automatic. The admin reads the expiry queue daily for red lines and weekly in full |

Cover when the admin is away: the automatic hiding on expiry works without an admin, but renewals do not get checked. A guide who uploads a renewal in good time could still be hidden because nobody checked it. Until a second admin exists, the 30-day reminder should ask guides to upload at least 7 days before expiry. Walter decides whether that is enough, or whether a named second admin checks documents while he is away.

## 10. Open questions for Walter (guide checks)

1. ID types: which photo IDs are accepted (for example the national ID card, passport, voter card), and is an expired ID accepted if the guide licence is current?
2. A guide licence with no printed expiry date: hold the guide back, or record a rule Walter sets (legal to advise)? Nothing is ticked until Walter decides.
3. First aid or WFR certificates that show only a course date: is the guide asked for a provider letter stating the validity, or does Walter set a fixed period? Kwetuly must not invent one.
4. Only a month and year printed: record the last day of that month (proposed), or the first?
5. Online-only first aid courses: accepted as first aid, recorded as "other", or not accepted?
6. A second reminder 7 days before expiry for required checks: yes or no?
7. A second admin for document checks when Walter is away, or accept that renewals wait?
8. Small name differences between documents: may the admin tick with a private note, or does every case go to Walter?
