# Soft-launch business plan (draft)

Prepared by business-manager on 2026-10-16 for Walter. Draft only. Nothing here has been sent to anyone. Walter decides every price and target.

Scope: website first, invite only, deposits off, no sample data shown (see `docs/team/board.md`).

Rules used: no invented prices, market figures, partners or results. Vendor prices are cited and were checked on 2026-10-16. Every target is an internal planning assumption, not a forecast.

---

## 0. One thing to settle first: can Rafrika take money at all?

Every paid stream needs a registered company that can invoice and give receipts: a BRELA registration, a TIN, EFD receipts, and VAT if registered. The legal drafts still have `[COMPANY LEGAL NAME]`, `[BRELA REGISTRATION NUMBER]` and `[TIN]` as placeholders (`docs/legal/business-listing-terms.md`, `docs/legal/README.md`).

**Assumption:** until those exist, Rafrika should not sell badges, invoice commissions or sell merchandise. accounting and legal should confirm what is required.

---

## 1. Revenue streams during the soft launch

| Stream | Who pays | Works in soft launch? | Why | Starts |
| --- | --- | --- | --- | --- |
| "Checked by Rafrika" badge (yearly) | Business | **Yes**, once the company can invoice | Paid by invoice over WhatsApp and bank or mobile money. It does not use the deposit system. Admin already stores the fee and the badge dates. | Soft launch |
| Referral commission | Business, after referred sales | **Yes, but small and late** | Shops record sales, Rafrika invoices monthly and is paid within the agreed days (Schedule 1). Cash arrives about 1 to 2 months after the sale. It also depends on travellers being in Tanzania, and an invite-only launch will bring few. | Soft launch, first cash around month 2 to 3 |
| Merchandise (Rafrika Shop) | Traveller | **Only if stock is in hand and prices are set** | Order requests are paid by mobile money or cash. It needs known unit costs, stock and receipts. | Soft launch or later (Walter's choice) |
| Guide packages | Traveller pays the guide directly | **No revenue for Rafrika** | Deposits are off, so Rafrika never sees the money. Taking a cut would mean billing guides on trust, which leaks and damages trust. | Later, when payments go through Rafrika |
| Prep calls | Traveller pays the guide directly | **No revenue for Rafrika** | Same reason. `call_price_usd` is set by the guide, and the payments table only covers trip and group deposits. | Later; probably the first guide-side fee once payments are on (see 2C) |
| Fee on deposits | Traveller or guide | No | Deposits are off. It needs Selcom and the advocate's answer on the National Payment Systems Act (deposit policy, question 1). | After the advocate and Selcom |
| Insurance | None | Never, for now | It needs NIC agency and TIRA approval. We only link to official portals. | Not planned |

**Honest summary:** the soft launch will earn little. Its job is to prove that real guides join and answer, that travellers enquire, and that businesses will pay for a check. Expect soft-launch revenue to come almost entirely from badges.

---

## 2. What Walter must price

I do not have Tanzanian market data on what businesses pay for listings or checks, or on typical shop commission rates, so I have not put in any market figures. Where a number is needed, I give a way to calculate it from Walter's own costs.

### 2A. Yearly "Checked by Rafrika" badge fee

**Floor (cost of doing one check):** staff hours (documents, identity, video call or visit, admin) × hourly cost + travel cost if it is a visit + payment fees + a share of the advocate and receipt costs.

Walter or accounting needs to supply the hourly cost and the travel cost. Any fee below this floor loses money on every badge.

| Option | What it is | For | Against |
| --- | --- | --- | --- |
| 1. One flat fee for every business, in TSh | Same price for a homestay and a hotel | Simple and easy to explain. Matches legal draft B4 ("same for every business of the same type"). | Too high for small homestays, or too low for hotels. |
| 2. Fee depends on how it is checked: video call or visit | A visit costs Rafrika more and is a stronger check. The badge already must say which one was done. | Price follows real cost. Honest, because the badge shows the method. | Must not look like the rejected Regular/Premium/VIP tiers. It has to stay "what was checked", never "better" or "recommended". |
| 3. Founding businesses free for year 1, full fee at renewal | The first N businesses (Walter sets N) get the check free during the soft launch | Fills listings fast. Tests the checklist and the process. | No revenue in year 1. Does not prove anyone will pay. Risk that businesses see the badge as "always free". |

**Recommendation:** option 1, a single TSh fee set at or above the cost floor. Offer a launch discount to the first businesses rather than making it free, so we learn whether anyone will pay. Ask partnerships to prepare (not send) 5 short questions about willingness to pay, for Walter to ask the first businesses.

Also decide:
- VAT included or not.
- Refund if no check item passes (legal B5).
- Badge does not change ranking. I recommend "does not" (legal B8). It is simpler and avoids extra disclosure.

### 2B. Rafrika's default share of referral commission

The total commission a business pays is agreed with each business, and I have no reliable data on usual rates. What Walter can set is the **default split** of that total between Rafrika and the guide. The guide's share is paid by Rafrika out of its share, after the business pays.

| Option | Split of the total commission (Rafrika / guide) | For | Against |
| --- | --- | --- | --- |
| 1. Equal | 50 / 50 | Simple. Fair story for guides. | Small amounts for both. |
| 2. Guide-first | Guide gets the larger part (for example 1/3 Rafrika, 2/3 guide) | Matches "guides are the core customers". Strong reason for guides to use codes. | Stronger pull for guides to steer travellers. Rafrika earns less per sale. |
| 3. Rafrika-first | Rafrika gets the larger part | More revenue per sale. | Guides have little reason to hand out codes, so few sales get recorded at all. |

**Recommendation:** option 1 (50/50) as the default, changeable per agreement.

Keep these rules:
- the commission note is shown to travellers
- referred travellers never pay more (legal C4)
- no pressure on travellers to buy (C6)

Risks:
- Shops under-report sales, because we rely on honest reporting.
- Late payment of invoices.
- Withholding tax on guide shares is still an open question for the advocate and accountant.

### 2C. Guide packages and prep calls

| Option | What it is | For | Against |
| --- | --- | --- | --- |
| 1. Free for guides during the soft launch | No fee, no commission | Gets guides on board. No collection problem while payments are off. | No revenue from the main product yet. |
| 2. Guides report bookings and Rafrika invoices them a % | Commission on trust | Some revenue now. | Cannot be checked. Guides stop reporting. Hurts trust with core customers. Admin work. |
| 3. Later: a disclosed Rafrika fee on prep calls paid through Rafrika | Once Selcom is live and the advocate approves, the traveller pays the call price plus or including a fee shown before paying | Collected automatically. Prep calls are small, fixed prices, so the fee is easy to explain. | Waits on company registration, Selcom and the advocate's answer on collecting money for guides. |

**Recommendation:** option 1 now, and announce option 3 to guides in writing before it starts. Do not charge guides a monthly subscription. Any subscription with levels would bring back the rejected tiered model.

### 2D. Merchandise prices

The unit costs are not in the repo, so I cannot set prices. Price = (unit cost + packaging + delivery share + payment fees) × (1 + margin). Show prices in TSh (`price_tzs`).

| Option | What it is | For | Against |
| --- | --- | --- | --- |
| 1. Hide the shop for the soft launch | No merch until stock and costs are known | No risk of unpaid or unreceipted sales. Less admin. | No brand items for early guides and travellers. |
| 2. Low margin (Walter picks, for example cost + a small %) | Brand awareness first | Guides wear and spread the brand. | Little or no profit. Easy to lose money on delivery. |
| 3. Normal retail margin | Profit per item | Real revenue. | Higher prices, slower sales, stock left over. |

**Recommendation:** option 1 unless Walter already holds stock with known costs. In that case use option 2 and give or sell first items to approved guides.

---

## 3. Monthly running costs for the soft launch

Vendor prices were checked on 2026-10-16 in US$ and may change. TSh amounts depend on the exchange rate on the day. accounting should convert at the actual rate.

| Item | Needed now? | Monthly cost (US$) | Source / assumption |
| --- | --- | --- | --- |
| Vercel hosting | Yes | **20** (Pro, 1 seat, includes US$20 usage credit) | The Hobby plan is "for personal, non-commercial use", so Pro is needed. [vercel.com/pricing](https://vercel.com/pricing) |
| Supabase (production) | Yes | **25** (Pro; daily backups kept 7 days; never paused) | The Free plan pauses after 1 week of inactivity and has no backups, which is not OK for real users. [supabase.com/pricing](https://supabase.com/pricing) |
| Supabase (staging) | Walter's choice | **0 to about 10** | 0 on a Free project (pauses when idle, fine for staging). About 10 if it is a second Pro-org project (estimate: Pro includes US$10 of compute credit covering one Micro instance; verify on the billing page). |
| Point-in-time recovery | No | 0 (would be 100) | Not needed at soft-launch size. [supabase.com/pricing](https://supabase.com/pricing) |
| Email (Resend) | Yes | **0** (Free: 3,000/month, 100/day), or 20 (Pro: 50,000/month) | Risk: a busy invite day could hit 100 emails/day. Upgrade only if the free plan's limits are reached. [resend.com/pricing](https://resend.com/pricing) |
| Analytics (PostHog EU) | Yes | **0** | Free: first 1M events and 5,000 recordings a month. Set billing limits. [posthog.com/pricing](https://posthog.com/pricing) |
| Domain rafrika.com | Yes | **about 1 to 2** (yearly fee spread over 12 months) | Estimate, not checked. Depends on registrar and on whether Walter already owns it. |
| AI concierge (Anthropic API) | Optional | **0 if off**; otherwise set a hard monthly cap | Secondary sources list Haiku 4.5 at US$1 input / US$5 output per million tokens ([finout.io](https://finout.io/blog/anthropic-api-pricing)). Check against Anthropic's own pricing page. |
| SMS phone codes | Later | 0 now (admin phone confirmation) | Later, per SMS. International gateways are about US$0.14 to 0.32 per SMS ([sent.dm comparison](https://www.sent.dm/resources/tanzania-sms-pricing), secondary source). One local provider lists 25 TSh per segment ([Sakura](https://billing.sakurahost.co.tz/knowledgebase/49/Understanding-SMS-Pricing-and-Credit-System-in-Tanzania.html), indicative). Get real quotes before choosing. |
| WhatsApp Business messages | Later | Not priced | Meta per-message pricing; check when turned on. |
| Selcom fees | Later | Not priced | Ask Selcom when the merchant account is opened. |
| Apple / Google developer accounts | Later | Not counted | Not needed for website first. |
| Tanzanian advocate | Yes (one-off) | **Quote needed** | Review of 6 legal drafts plus licence and payments questions. I have no basis for a figure; get 2 written quotes. |
| Company registration, TIN, business licence, EFD | Yes if earning (one-off) | **Quote needed** | accounting and legal to list. |

**Monthly running cost (excluding advocate, company setup and Walter's own time):**
- Lean: about **US$46/month** (Vercel 20 + Supabase 25 + domain about 1).
- Upper: about **US$76/month or more** (adding Resend Pro 20 and staging about 10), plus any AI usage under the cap.

**Break-even for running costs:** badges needed per year = (monthly running cost × 12) ÷ badge fee. Example of the formula only: at US$46/month, yearly cost is about US$552. Divide that by whatever fee Walter sets. The advocate and company setup are one-off costs to recover separately.

---

## 4. 90-day targets and go/no-go for public launch

These are **planning targets set by me, not forecasts**. They reflect what an invite-only launch run by Walter can handle, not market demand. data-analyst should track them weekly once PostHog is live.

| Measure | Day 30 | Day 60 | Day 90 | Why it matters |
| --- | --- | --- | --- | --- |
| Real guides invited (Walter sends) | 10 | 20 | 30 | Supply |
| Guides approved (identity and licence checked) | 8 | 15 | 20 | Quality supply |
| Guide packages approved | 10 | 25 | 40 | The main product exists |
| Guides with a prep-call price set | 5 | 10 | 15 | The second product exists |
| Traveller enquiries (packages + prep calls + trips) | 10 | 30 | 60 | Demand |
| Enquiries answered by the guide within 24 hours | 70% | 80% | 80% | Trust |
| Prep calls held (reported by guides) | 2 | 6 | 12 | Proof of value |
| Businesses listed (real, free) | 10 | 20 | 30 | Stays and shops coverage |
| Badges sold (paid) | 0 | 2 | 5 | Proof that businesses pay |
| Referral agreements signed (after the advocate) | 0 | 2 | 4 | Second revenue stream |
| Serious unresolved complaints | 0 | 0 | 0 | Safety |

### Go for a public launch if all of these are true by day 90
1. At least 15 approved real guides, with at least 25 approved packages across more than one trip type (for example Kilimanjaro, safari, Zanzibar).
2. At least 80% of enquiries answered within 24 hours over the last 30 days.
3. At least 40 real enquiries in total, with at least 5 that guides report led to a booking or prep call.
4. At least 3 paid badges, which shows businesses will pay.
5. Business basics in place:
   - company registered with a TIN
   - receipts can be issued
   - privacy policy and terms reviewed by the advocate and published
   - no sample data live
   - security-reviewer's blockers closed
   - qa-tester gives a pass verdict
6. Monthly running costs are covered by revenue, or Walter has confirmed a funding runway for at least 6 months.

### No-go (stay invite-only and fix) if any of these happen
- Fewer than 10 approved guides, or guides often do not answer enquiries.
- No business pays for a badge at the set fee. If so, revisit the fee or the offer; do not cut the checks.
- Any serious safety, privacy or fraud incident not yet resolved.
- No advocate-reviewed terms or privacy policy.

### 3, 6 and 12 months after public launch (outline only, to set with data-analyst)
- 3 months: badges cover the monthly running costs.
- 6 months: payments live through Selcom (if the advocate approves); first prep-call fee revenue.
- 12 months: guide-side fees are the largest stream. Set the numbers after 90 days of real data.

---

## 5. Parked credits idea: a safe version

Stored credit that customers buy, top up or can cash out is very likely e-money or a stored-value product. That likely needs Bank of Tanzania approval under the National Payment Systems Act, 2015. So do not build a wallet.

Versions that **do not hold customers' money** (advocate to confirm each):

1. **Discount codes Rafrika funds itself.** For example "first prep call: Rafrika fee waived". They only reduce Rafrika's own fee at the moment of paying. No balance, no cash value, not transferable, with an expiry.
2. **Free-service perks for businesses and guides.** For example a referral or loyalty reward that gives a business a discount on its next badge renewal. They can only be used against Rafrika's own fees. They cannot be bought and are never paid out in cash.
3. **Guide referral shares stay commission, not credit.** Rafrika pays them out monthly after the business pays. No balance is held for longer. Ask the advocate whether even this short period counts as holding money.

Avoid:
- gift cards or vouchers sold for money
- credits usable with guides or other businesses (Rafrika would be holding money for third parties)
- any top-up
- any cash-out

When to build: not before payments go through Rafrika. Until then there is no Rafrika fee to discount.

---

## Decisions for Walter

1. **Company first.** Confirm whether the company is registered with a TIN and can issue receipts. Recommendation: no sales of any kind until it can.
2. **Badge fee.** Recommendation: one flat TSh fee at or above the cost floor (option 1), with a launch discount for the first businesses rather than free. Walter supplies the hourly and travel costs so accounting can work out the floor. Also: VAT included or not, no refund once the check is done (pending the advocate), badge does not affect ranking.
3. **Default referral split.** Recommendation: 50/50 of the agreed total between Rafrika and the guide, paid by Rafrika after the business pays, changeable per agreement.
4. **Guide packages and prep calls.** Recommendation: free during the soft launch. Plan a disclosed fee on prep calls paid through Rafrika once Selcom and the advocate allow it. No guide subscriptions.
5. **Merchandise.** Recommendation: hide the shop for the soft launch unless stock and unit costs are known. If they are, use a low margin.
6. **Hosting spend.** Recommendation: Vercel Pro (US$20) and Supabase Pro (US$25) for production, a Free Supabase project for staging, free Resend and PostHog, AI concierge off or capped. About US$46/month.
7. **Advocate and company setup.** Recommendation: get 2 written quotes before committing (legal and accounting to prepare the request; Walter sends it).
8. **90-day targets and go/no-go.** Recommendation: adopt the table and criteria in section 4 as the scorecard, and have data-analyst track them weekly.
9. **Credits.** Recommendation: keep it parked until payments are live, then only consider option 1 (Rafrika-funded discount codes), after the advocate confirms.
