# Commission on service reservations (restaurants, spa and massage, salons)

Prepared by business-manager on 2026-11-22 for Walter. Paper only. Nothing has been built, sent or charged, and no business has been contacted. Every amount below is a **proposal**. Walter sets the real numbers in admin. Market figures I could not check are marked **to verify**.

Inputs: `docs/team/board.md` (2026-11-22 service bookings entry, decisions 1-10, step 1c), `docs/team/decisions-2026-11-21.md` (round 2, PV5: business verification = the yearly badge), `docs/legal/business-listing-terms.md` (Part C and Schedule 1), `docs/business/soft-launch-business-plan.md` (2B, 50/50 default split), `docs/business/new-ideas-business-view-2026-10-30.md` (15% proposal for money paid through Kwetuly), `docs/business/phone-sign-in-costs-2026-10-30.md` (WhatsApp prices).

## 0. Starting point

- Reservations are **requests only** while payments are off. The traveller pays the business on the day. Kwetuly never sees the bill.
- So the only way to earn is to **invoice the business each month** for completed reservations, under a signed referral agreement (Schedule 1). This is "invoicing on trust", the same weakness as the existing referral commission.
- Board decision 3 (2026-11-22): **no commission at the start**. This paper is for when Walter turns it on.
- Commission is always disclosed to travellers. Paying commission never changes ranking (the same rule as the badge).

## 1. Which commission model

Three ways to charge, and how each copes with a bill we cannot see:

| Model | How it works | For | Against |
| --- | --- | --- | --- |
| **A. % of the final bill, stated by the owner** | Owner types the bill amount after the visit. Kwetuly invoices a % of it | Grows with spend. Fair to small and big bills | Kwetuly cannot check it. Every incentive is to under-report. Owners must type amounts (more work, more disputes). Bills mix drinks, tips and VAT, so "what counts" is argued every month |
| **B. Fixed fee per guest who came** | Owner confirms how many people came. Fee × guests | Checkable: the reservation already holds the number of people, and the traveller can confirm. No amounts to report. Easy to explain | Same fee for a cheap lunch and a dinner. Large groups cost the owner a lot unless there is a cap |
| **C. % of the listed price of the booked item** | The traveller books a priced item from the catalogue (for example "60-minute massage, TSh X"). Kwetuly takes a % of the price **listed at booking time** | Checkable: the price is stored with the reservation. Follows value. Extras added on the day are not counted, so nothing to report | Needs priced items. Not usable for restaurants (a table is not an item) |

**Recommendation per service type:**

| Service type | Model | Why |
| --- | --- | --- |
| Restaurant | **B. Fixed fee per guest who came**, with a cap per reservation | A table has no listed price, and model A cannot be checked |
| Spa and massage | **C. % of the listed price** of the booked treatment(s) | Treatments have clear prices, and the price is saved at booking |
| Salon | **C. % of the listed price** of the booked service(s) | Same as spa |
| Spa or salon item with no price ("price on request") | **B. Fixed fee per person served** | Fallback, so every reservation has a basis |
| Later services (classes at a business, tastings, etc.) | Rule: **C if the item has a listed price, otherwise B** | One rule, no new model per type |

I do **not** recommend model A for any type while payments are off. If Walter wants a % of the real bill, it should wait for optional deposits or payment through Kwetuly (board "Later" step), when the amount is known.

What other platforms do (other markets, **to verify**, not Tanzanian data): OpenTable charges restaurants a fixed fee per seated diner who came through its network, reported at about US$1 to US$1.50 per cover in North America and €1.50 in Ireland, and says cancellations and no-shows are not billed ([OpenTable Canada plans](https://opentable.ca/restaurant-solutions/en/plans), [OpenTable Ireland plans](https://www.opentable.ie/restaurant-solutions/plans/), [Eat App summary](https://restaurant.eatapp.co/blog/opentable-pricing)). Fresha lists a one-time fee for new clients found through its marketplace, but its pricing page did not show the amount when I checked ([Fresha pricing](https://www.fresha.com/pricing), checked 2026-11-22). These only show that "fixed fee per guest" is a known model. They are not a basis for Tanzanian prices.

## 2. Suggested starting values (proposals for Walter)

I have no reliable data on what a tourist spends per guest in Tanzanian restaurants, spas or salons. The numbers below are built from Kwetuly's own logic, not from the market.

| Setting in admin | Proposal | Reasoning |
| --- | --- | --- |
| Restaurant fee per guest who came | **TSh 2,000** (placeholder) | Aim for about 5 to 10% of a typical spend per guest. TSh 2,000 fits that only if a typical guest spends about TSh 20,000 to 40,000 (**to verify**: Walter's own knowledge of Arusha, Moshi and Zanzibar prices). Formula for Walter: fee = typical spend per guest × 5 to 10%. Small enough that an owner won't bother cheating, and still well above the cost of one reservation (section 5) |
| Restaurant cap per reservation | **Guests counted up to 10** (so at most 10 × the fee) | Guide-led groups are welcome. Without a cap, a 25-person group dinner becomes a big invoice and pushes owners to take the group off Kwetuly |
| Spa and massage, % of listed price | **10%** (options 8, 10 or 15%) | Through-Kwetuly payments use a proposed 15%, but about 6 to 7% of that goes on card and payout fees (Flutterwave rates in `new-ideas-business-view-2026-10-30.md`). Invoiced commission has no card fee, so 10% leaves Kwetuly about the same net, and the business is not asked for more than with online payment. 15% risks owners refusing; 8% is thin once collection costs and late payers count |
| Salon, % of listed price | **10%** | Same reasoning. One rate for spa and salon is easier to explain |
| Fixed fee per person, items with no price | **TSh 3,000** (placeholder) | A treatment usually costs more than a meal per person (**to verify**). It also nudges owners to list prices, which is better for travellers |
| Guide's share (when the reservation came through a guide's code or trip file) | **50/50 of the commission**, Kwetuly pays the guide after the business pays | Default already recommended in the soft-launch plan 2B. With no guide link, Kwetuly keeps all of it |
| What counts | Reserved items or guests only. **No** commission on extras added on the day, tips, drinks bought later, delivery, VAT, or later visits made without Kwetuly | Simple and honest. Owners can trust the statement |

Any agreement may set other numbers for one business (Schedule 1). The admin values are only the defaults.

## 3. Completed, no-show, cancelled

Commission only on **completed** reservations. Nothing on:
- declined requests, or "other time offered" that the traveller did not accept;
- cancellations by the traveller, at any time;
- cancellations by the business;
- no-shows.

How "completed" is decided (proposal):
1. After the reservation time the owner marks each one: **came** (with the number of people who came) or **did not come**. The owner may lower the count ("4 booked, 3 came").
2. The traveller gets one short question the next day: "Did you visit [business]?" Yes, no, or no answer. Nobody is forced to answer.
3. If the owner marks nothing within **7 days** (the Schedule 1 reporting time), the reservation shows on the draft statement as **"came, as booked"**. The owner can still correct it on the statement (section 4). Without this default, silence would earn the owner a free month.
4. If the owner says "did not come" but the traveller says "yes", the line is marked **"to check"**. The first time, the owner's word stands. operations-manager reviews any business where this repeats (proposal: 3 times in 3 months).

No-show fees for travellers: **none** while payments are off, because Kwetuly cannot charge travellers and should not ask businesses to. Repeated traveller no-shows are an operations rule (for example a confirmation step after 2 no-shows). That is for operations-manager, step 1d.

## 4. Monthly statement and minimum invoice

- **Day 1 of the month:** each business with an agreement sees a draft statement for last month (each reservation, date, people or item, listed price, fee) in its dashboard.
- **Days 1 to 5:** the owner may correct lines, giving a reason.
- **Day 6:** Kwetuly issues the invoice (with an EFD receipt once registered). Payment within **14 days** by bank or mobile money in the company's name (Schedule 1).
- **Minimum invoice: TSh 20,000** (placeholder). Below that, the amount carries forward to the next month. Reasoning: each invoice costs staff time, an EFD receipt and a fee to receive the money (**to verify** once the bank and mobile money accounts exist). Invoicing TSh 4,000 would cost more than it earns.
- **Carry-forward limit:** whatever is owed is invoiced after **6 months** or when the agreement ends, whichever comes first, even if below the minimum. Proposal: Walter may write off very small amounts (he sets the level).
- **Late payment:** a reminder at 7 days late. At 30 days late, "Reserve" is paused on that business (the free listing stays). No late fee or interest (the advocate should confirm this is fine, and it keeps us away from credit questions).
- **Statements for information first:** from the day reservations start (no commission), businesses see the same monthly statement marked "for information, no charge". When commission begins, they already know the format. Agreement start needs 30 days' written notice (Schedule 1 ending clause works the same way).

## 5. Costs per reservation (to measure, not guessed)

Kwetuly earns only if: **fee per completed reservation × share of reservations completed > cost of messages + share of invoicing and dispute time**.

| Cost | Per | Amount |
| --- | --- | --- |
| Email alerts (owner request, traveller confirmation, reminder, "did you visit?") | message | Free within the Resend plan limits (to check against monthly volume) |
| WhatsApp alerts, if switched on | message | Meta's price for business ("utility") messages to Tanzania: **to verify**. The authentication price used in `phone-sign-in-costs-2026-10-30.md` (about US$0.009 with Twilio, partly to verify) is a different message type and must not be reused |
| Invoicing | business per month | Staff time + EFD + receiving fee, **to verify** |
| Disputes | case | Staff time, operations-manager to estimate |

Even at a few US cents per WhatsApp message (to verify), the message cost per reservation is far below TSh 2,000 or 10% of a typical treatment. The real costs are staff time on statements and disputes, and unpaid invoices. data-analyst should track completed reservations per business per month, the no-show rate, "to check" lines, statement corrections, days to payment and unpaid amounts.

## 6. How it fits the yearly "Checked by Kwetuly" badge

They stay **two separate products**:
- **Badge:** a yearly fee for checks done ("what was checked and when"). It never says "recommended" and doesn't change ranking.
- **Commission:** a fee for reservations Kwetuly sent, only with a signed agreement.

Options:

| Option | For | Against |
| --- | --- | --- |
| **1. Separate, no link** (recommended) | Clear. No "pay more, get more" impression. Matches the 2026-10-13 rejection of tiers | Some owners pay both |
| 2. Lower commission for badge holders | Pushes badge sales | It becomes a paid tier with better terms, close to the rejected Regular/Premium/VIP idea |
| 3. "Reserve" only for badge holders | Only checked businesses take bookings | Fewer listings take reservations. Owners pay before earning anything from us. Kwetuly earns the badge fee, not commission |

**Recommendation:** option 1 for restaurants and salons: any approved business may take reservations. **Spa and massage are the exception.** Because of decision 4 (licensed premises only, conduct risk), "Reserve" should need a business licence seen and dated by Kwetuly. Since PV5 makes business verification the badge, this means spa and massage need the badge before they can take reservations. Walter decides whether that is fair, or whether a free licence check at approval is enough (section 8, decision 5).

Walter's verification feature table (PV1) should list "Receive reservations" per business type, so this is written down in one place.

## 7. Risks

| Risk | What happens | Mitigation |
| --- | --- | --- |
| **Bypass by the traveller** | They find the restaurant on Kwetuly, then call or walk in | Accept it. We only charge for reservations made through Kwetuly, never for later visits. The small fixed fee keeps the reward for bypassing low. Reservations give travellers something worth using: confirmation in the app, the reservation in their trip file, a diet line, and the guide knowing the plan |
| **Bypass by the owner** ("book with us directly next time", or asking the guest to cancel and walk in) | Lost commission | Agreement clause: no steering away from Kwetuly reservations, and no higher price for Kwetuly guests (C4). Pattern checks by data-analyst (cancellation and no-show rate against the average). Sanction: "Reserve" paused or the agreement ends. The free listing stays |
| **False "did not come"** or lowered guest counts | Under-billing | Traveller "did you visit?" check, "to check" lines, review after repeats, occasional spot checks by phone (Walter approves any contact) |
| **Unpaid invoices** | Revenue on paper only | 30-day pause, minimum invoice, small amounts. Collection cost must stay below what is collected |
| **Guide steering** (guides push restaurants for their share) | Traveller trust | Disclosure that the guide may get part of it. C6 no-pressure rule. The guide's share only when the traveller used the guide's code or trip file |
| **Legal and tax** | Kwetuly may count as a travel agent. VAT on commission, withholding tax on guide shares, EFD duties | Existing advocate questions 4 to 6 (listing terms). No invoices before company registration, TIN and EFD |
| **Workload** | Statements and disputes for many small businesses | Start with a small number of agreements (Walter picks). Measure staff time before widening |
| **Owners refuse commission** | Few agreements | Reservations stay free for businesses without an agreement (no Kwetuly revenue, but listings stay useful). Walter decides whether "Reserve" needs an agreement (decision 7) |

## 8. Traveller-facing disclosure (draft English; localization makes all 7 languages)

Shown **next to the Reserve button and repeated in the confirmation**, only when the business has an active agreement:

- Restaurant: "Kwetuly receives a small fixed amount from [Business] for each guest who comes through this reservation. You pay [Business] the same price as every other guest."
- Spa, massage, salon: "Kwetuly receives a share of the listed price from [Business] for this reservation. You pay [Business] the listed price, nothing extra."
- When a guide is linked, add: "Part of it may go to your guide, [first name]."

The business page keeps its existing note: "Kwetuly and guides may earn a commission when you buy here."

Open choice: show the **exact amount** ("TSh 2,000 per guest", "10%") or only the basis, as above. Showing it is the most open, but owners may not want their rate public. legal should confirm what Tanzanian consumer rules require. Owner texts (statement, agreement summary) in English and Kiswahili, and Walter checks the Kiswahili.

## 9. Business go or no-go

- **Reservations without commission, after launch, month 1 to 2:** **go** (already decided). Useful for travellers and businesses, and it builds the data.
- **Commission:** **no-go for now. Go** only when all of these are true:
  1. the company is registered with a TIN, EFD receipts and a bank or mobile money account in its name;
  2. the advocate has reviewed Schedule 1 and answered the travel-agent and tax questions;
  3. at least 2 months of reservation data exist (completion rate, no-show rate, "to check" lines);
  4. each business has signed its own agreement with 30 days' notice.

## Decisions for Walter

1. **Model per type.** Restaurants pay a fixed fee per guest who came. Spa, massage and salon pay a % of the listed price saved at booking. Items with no price fall back to a fixed fee per person. Recommendation: **yes**. No "% of the bill the owner states" while payments are off.
2. **Starting values** (placeholders, set in admin): TSh 2,000 per restaurant guest, at most 10 guests counted per reservation; 10% for spa, massage and salon; TSh 3,000 per person for unpriced items. Recommendation: **set the restaurant fee from your own idea of a typical spend per guest (about 5 to 10% of it)**, keep 10% for spa and salon.
3. **Guide's share.** 50/50 when the reservation came through the guide's code or trip file, paid by Kwetuly after the business pays. Recommendation: **yes** (same as the soft-launch plan default).
4. **No commission on no-shows or any cancellation.** Unmarked reservations count as "came, as booked" after 7 days, and the owner can still correct the statement. Recommendation: **yes**.
5. **Badge link.** Commission and badge stay separate. Restaurants and salons need only approval. Spa and massage need a business licence seen and dated (the badge) before taking reservations. Recommendation: **yes**, or, if you prefer, a free licence check at approval for spa and massage.
6. **Minimum invoice and payment rules.** TSh 20,000 minimum, carried forward up to 6 months, 14 days to pay, "Reserve" paused at 30 days late, no late fees. Recommendation: **yes**, figures set by you.
7. **Does "Reserve" need a signed agreement?** Recommendation: **no during the free start; yes once commission begins**, with 30 days' notice. Businesses that don't sign keep their free listing and enquiries.
8. **Disclosure.** The basis-only lines in section 8, or the exact amount too. Recommendation: **basis-only now, and legal confirms** whether the amount must be shown.
9. **When commission starts.** Only after the four conditions in section 9. Monthly statements marked "for information, no charge" from the first reservation. Recommendation: **yes**.
10. **Next steps on paper.** legal adds reservation commission to the advocate pack (travel agent, VAT, withholding, disclosure). accounting drafts the statement and invoice layout. data-analyst adds the reservation measures in section 5 to the scorecard. Recommendation: **yes**. Nobody contacts any business.
