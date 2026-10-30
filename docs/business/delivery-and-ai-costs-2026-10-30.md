# Delivery and collection for shop orders; AI helper costs

Prepared by business-manager on 2026-10-30 for Walter (board item R2). Paper only. Nothing built, nobody contacted. Walter decides every fee, cap and model.

Inputs:
- `docs/business/new-ideas-business-view-2026-10-30.md` (catalogue money model, per-agreement commission)
- `docs/legal/business-listing-terms.md` A6 and the commission table (sale definition already proposes to exclude delivery charges)
- `docs/legal/traveller-terms.md` 9.1 and 9.2 (Kwetuly Shop; shop order requests)
- `docs/legal/travel-agent-and-transfers.md` 2.1 (LATRA licences for vehicles and motorcycles used commercially)
- `docs/tech/post-launch-catalogue-lessons-payments-plan.md` (today's order request is free text built by `orderMessage()`)
- `apps/web/src/app/api/concierge/route.ts` (concierge uses `claude-opus-5-5`, `max_tokens: 4000`, effort low, cached system prompt)
- Anthropic price list, checked on the web on 2026-10-30 (section 2.1)

Labels: **[Assumption]** = my estimate for planning, not a fact or a quote.

---

## 1. Delivery and collection for shop orders

### 1.1 Verdict on the chief of staff's proposal

**Confirmed**, with six improvements:

1. **Pay on delivery or at collection as the default.** The shop may ask for payment first, but then the form shows it clearly before the traveller sends the request. Kwetuly cannot refund anything, so pay-first must never be a surprise.
2. **Commission on items only, never on the delivery charge.** This matches the sale definition already proposed in the listing terms.
3. **"Free delivery" is a third choice** next to "fixed fee per area" and "on request".
4. **Delivery inside Tanzania only** at the start. No shipping abroad (export permits, customs, certificates).
5. **Tanzanite and gem shops: collection at the shop only** at the start, because of the value, the certificate and the risk of fake stones or lost parcels. Walter can widen this after the advocate answers legal Q18.
6. **The Kwetuly Shop is a special case.** Here Kwetuly is the seller, so Kwetuly sets the charge and carries the liability (see 1.6).

Why Kwetuly should not calculate distance or travel time at the start:
- A maps or distance service is a new running cost and a new integration. No price is in this document because I have not checked one.
- If Kwetuly quotes the fee, a traveller who is charged a different amount blames Kwetuly. Kwetuly would be setting a price for a service it doesn't provide.
- It moves Kwetuly towards looking like the delivery operator. Carrying goods for pay by motorcycle or car is a LATRA question (see `docs/legal/travel-agent-and-transfers.md` 2.1). That should stay the shop's question, not ours.
- Shops already price delivery by area in practice. Fixed area fees capture most of the value of distance pricing with none of the build.

**Later option (only if the data shows a need):** if "on request" makes many travellers give up (conversion and data-analyst measure this), let shops enter a fee per kilometre and show an *estimate* labelled "set by the shop, confirmed by the shop". Revisit 3 months after the catalogue goes live.

### 1.2 Who delivers

| Party | Role |
| --- | --- |
| Shop | Delivers with its own staff or a rider, taxi or courier **it** chooses and pays. Its own licences and insurance. |
| Traveller | Collects at the shop, or names someone to collect for them (for example their guide), with the order number. |
| Kwetuly | Passes the order request. Never delivers, never books riders, never handles goods or money for other shops. |
| Hotel | Only receives the parcel at reception if it agrees. Hotels are not part of the agreement and carry no duty. Some hotels refuse parcels, so the shop confirms with the traveller. |

### 1.3 Who sets the charge and who receives it

- **The shop sets it** in its business settings: (a) free delivery, (b) a fixed fee in TSh per area it lists, or (c) "on request" (the shop states the fee when it confirms the order). Optional: a minimum order value for delivery and the days and hours it delivers.
- **The shop receives it**, together with the item price, paid directly by the traveller (cash, mobile money or whatever the shop accepts). Kwetuly never collects the delivery fee. This keeps us clear of the Bank of Tanzania question on holding customers' money.
- **Kwetuly sets no maximum.** It shows the fee exactly as entered, with "Delivery charge set by [shop]".
- **Fees shown in TSh.** Shops that want US$ can say so in the "on request" reply. A conversion shown by Kwetuly is not recommended without localization's money rules.

### 1.4 Liability

| Risk | Who carries it | What Kwetuly does |
| --- | --- | --- |
| Goods wrong, damaged, fake or not as described | Shop (listing terms A6 already say this) | Records the order request with the listed item and price; customer care script; repeated complaints lead to an admin review of the listing or badge. |
| Parcel lost, late, or left at the wrong hotel | Shop (it chose the carrier) | Order form asks for the latest delivery date (before departure) and the name at reception. |
| Traveller paid first and nothing arrives | Shop to traveller. Kwetuly cannot refund. | Pay on delivery is the default; a pay-first warning shows on the form when the shop requires it. |
| Traveller doesn't show up or refuses the delivery | Shop's risk. It may ask for payment first or a deposit (its choice, shown on the form). | None beyond showing the shop's rule. |
| Rider or vehicle licence (LATRA), road accident | Shop and its carrier | None. Kwetuly does not arrange transport. |
| Hotel room number and name shared | Kwetuly as data controller of the order request | Room number optional; "name at reception" instead; delete delivery details after the order is closed (legal to set the period under PDPA). |
| Kwetuly Shop (merchandise) orders | **Kwetuly** as seller | See 1.6. |

Traveller terms 9.2 and listing terms A6 already cover most of this. Legal should add: delivery charge set and received by the shop; Kwetuly does not deliver; hotels are not responsible; delivery details are deleted after the order is closed.

### 1.5 How this fits the referral commission model

- **The commission base is the item price only.** Delivery fees are excluded. The listing terms commission table already proposes "Excludes ... delivery charges". I recommend making that final:
  - Commission on delivery would reward shops for keeping the fee low and *under-reporting* it, or it would push the fee up for travellers.
  - It would make Kwetuly look like part of the delivery service.
  - Delivery is mostly the shop's own cost, not margin.
- **The audit trail gets better.** The structured order request records each item, its listed price, the quantity, delivery or collection, the area and the listed fee. The monthly report to each shop (drafted by accounting) lists referred orders. Only the item values count towards commission.
- **No new fee and no new tier.** Delivery settings are part of the free listing, not a paid add-on. The badge doesn't change: it never says anything about delivery.
- **Disclosure unchanged.** The commission note stays on the business page. The order form adds one line: "Kwetuly may receive a commission from [shop] on the items, not on delivery."
- **Collection by a guide** fits "guides first", but a guide who collects for a traveller is doing them a favour, not earning a Kwetuly fee. Any tip is between them.

### 1.6 Kwetuly Shop (merchandise)

Kwetuly is the seller, so the same form applies, but Walter fills in the shop settings:
- **Recommendation:** collection only (a fixed place and hours Walter chooses), or delivery in one or two areas at a fixed TSh fee Walter sets.
- If a paid rider delivers, use a registered courier or a rider who holds the LATRA licence. Ask legal before the first paid delivery.
- Price formula from the soft-launch plan still applies: price = (unit cost + packaging + delivery share + payment fees) × (1 + margin). If delivery is "free", its cost must sit in the item price, otherwise every delivery loses money.

### 1.7 What the order form must ask (so there is no back-and-forth)

**Shop settings (filled in once by the shop, shown on the form):**
- Delivery offered: yes or no. Areas with the fee in TSh, "free", or "on request".
- Delivery days and hours; how long delivery takes (same day, next day, number of days); minimum order for delivery (optional).
- Collection address (from the listing), collection hours, and whether the shop holds an order and for how many days.
- How the traveller can pay (cash TSh, mobile money, card at the shop); whether payment is needed before delivery.

**Traveller form:**
1. Items from the catalogue: item, variant (size or colour), quantity; the listed price is shown and saved with the request. The note field stays free text.
2. **Delivery or collection**: only the options the shop offers.
3. If delivery:
   - Area (from the shop's list), which shows the fee, "free" or "on request". When the fee is "on request", the form says: "The shop will confirm the delivery charge before delivering."
   - Hotel or place name, and the street or landmark.
   - Name at reception (room number optional).
   - Preferred date and time window.
   - **Latest date** (for example the day before departure).
4. If collection: preferred date and time window; who collects (me or a named person, for example my guide).
5. Contact:
   - Phone with the country picker (board item A2).
   - Whether WhatsApp is fine.
   - Email.
   - Preferred language (English or Kiswahili for the shop's reply, plus the traveller's site language).
6. How I plan to pay, from the shop's accepted methods.
7. Two tick boxes:
   - "I pay [shop] directly. Kwetuly does not take payment for this order."
   - "The delivery charge is set by [shop]." This one shows only when there is a fee or "on request".
8. A summary before sending: items subtotal, delivery fee (or "on request"), the total as far as it is known, pay-first or pay-on-delivery, and the commission disclosure line.

**Shop's reply (one step):** accept or decline; the confirmed total (items + delivery); the delivery or collection time. The traveller then confirms. With fixed or free fees this is the only round trip. With "on request" it is one extra confirmation, which is why I suggest nudging shops towards fixed area fees.

Texts: traveller form in all 7 languages, shop side in English and Kiswahili (localization).

---

## 2. AI helper cost (profile helper and pre-check summaries)

### 2.1 Anthropic prices used

Source: Anthropic pricing documentation, https://platform.claude.com/docs/en/about-claude/pricing, cross-checked with https://claude.com/pricing (www.anthropic.com/pricing redirects there). **Checked 2026-10-30.** All in US$ per million tokens (MTok).

| Model | Input | Output | Cache write (5 min) | Cache read | Batch input / output (50% off) |
| --- | --- | --- | --- | --- | --- |
| Claude Haiku 5.5 (prompts up to 100,000 tokens) | 0.10 | 0.50 | 0.125 | 0.01 | 0.05 / 0.25 |
| Claude Haiku 5.5 (prompts over 100,000 tokens) | 0.50 | 2.50 | 0.625 | 0.05 | 0.25 / 1.25 |
| Claude Sonnet 5.5 | 2 | 10 | 2.50 | 0.10 | 1 / 5 |
| Claude Opus 5.5 (concierge today, for comparison) | 4 | 20 | 5 | 0.20 | 2 / 10 |

Other facts from the same page:
- Tool use adds a hidden system prompt (286 tokens for Opus 5.5).
- Claude 4.7 and later models use a tokenizer that gives about 30% more tokens for the same text.
- US-only inference (`inference_geo`) costs 1.1x. Not needed; the default global routing is standard price.

**Not priced by Anthropic:** speech-to-text. My estimate assumes dictation uses the phone's or browser's own dictation (free to Kwetuly), and the AI receives text only (board item P6 says "text only"). If tech-lead's voice options pick a paid transcription service, that cost is extra and must be quoted separately.

### 2.2 Token estimates **[Assumption]**

I have no measured data; these are planning figures. Data-analyst should replace them with real token counts from the first 50 profiles (the API returns usage on every call).

**Profile helper** (the person types or dictates; the AI fills the guide or business profile fields as structured output):
- Fixed part per call: instructions plus the field list and rules (no "recommended", no invented facts), about 2,000 tokens, plus the tool overhead of about 300.
- The person's text: a dictated description of 300 to 800 words, about 500 to 1,500 tokens. Kiswahili and other languages may need more tokens than English.
- Output: the filled profile in English and Kiswahili, about 1,000 tokens per call.
- A typical session has 3 calls (first draft and two corrections). The conversation grows each call.

| Case | Calls | Input tokens | Output tokens |
| --- | --- | --- | --- |
| Typical | 3 | about 16,000 | about 3,000 |
| High (long dictation, many corrections) | 5 | about 40,000 | about 8,000 |

**Pre-check summary** (the AI reads a submitted guide or business application as text and writes a short summary for the admin: missing fields, risky wording, anything that doesn't match the checklist; the admin still decides):
- Input: instructions and checklist about 2,000, submission about 1,500. Output: about 500.
- High case: a long submission plus a second run after "needs more info", about 8,000 input and 1,000 output.

### 2.3 Cost per unit (US$, no caching, no batch discount: the conservative figure)

| Model | Profile helper, typical / high | Pre-check summary, typical / high | **Both, per profile, typical / high** |
| --- | --- | --- | --- |
| Haiku 5.5 | 0.0031 / 0.0080 | 0.0006 / 0.0013 | **0.0037 / 0.0093** |
| Sonnet 5.5 | 0.062 / 0.16 | 0.012 / 0.026 | **0.074 / 0.186** |
| Opus 5.5 (reference) | 0.124 / 0.32 | 0.024 / 0.052 | **0.148 / 0.372** |

How it is calculated: input tokens × input price + output tokens × output price. For example, Sonnet typical helper: 16,000 × $2/M + 3,000 × $10/M = $0.032 + $0.030 = $0.062.

Savings not counted above:
- Caching the fixed instructions makes repeated reads cost 0.05x (Sonnet/Opus 5.5) or 0.1x (Haiku 5.5) of the input price.
- Pre-checks are not urgent, so they can run through the Batch API at 50% off.

Together these could cut the bill by roughly a quarter to a half **[Assumption]**.

### 2.4 Monthly cost (one helper session and one pre-check per profile; US$)

| Profiles per month | Haiku 5.5 typical / high | Sonnet 5.5 typical / high | Opus 5.5 typical / high (reference) |
| --- | --- | --- | --- |
| 50 | 0.19 / 0.47 | 3.70 / 9.30 | 7.40 / 18.60 |
| 500 | 1.85 / 4.65 | 37 / 93 | 74 / 186 |
| 5,000 | 18.50 / 46.50 | 370 / 930 | 740 / 1,860 |

What this says:
- **Haiku 5.5 costs about 20 times less than Sonnet 5.5** for this job. Even 5,000 profiles a month (far more than any soft-launch target) stays under US$50.
- **Sonnet 5.5** is affordable at soft-launch volume (50 profiles: under US$10) but costs as much as the whole hosting budget (about US$46 to 76 a month) at around 500 profiles.
- The real cost risk is **misuse, not normal use**: someone looping the helper or pasting huge texts. Haiku 5.5 is also 5 times dearer per token once a prompt goes over 100,000 tokens, so the input must be capped well below that.

**Quality caveat:** filling a profile from a dictated, mixed English and Kiswahili text, without inventing facts, is the hard part. Price alone should not decide. Run both models on the same 20 sample (`is_sample`) profiles and 20 sample submissions, and let qa-tester and guide-success compare them before choosing.

### 2.5 Proposed spending cap and limits

Options for the AI helper and pre-check (kept separate from the concierge):

| Option | Monthly cap | Covers | Risk |
| --- | --- | --- | --- |
| A | US$10 | Haiku at any realistic volume; Sonnet up to about 50 to 130 profiles | Sonnet runs out in a busy month, so the helper switches off until the next month |
| **B (recommended)** | **US$25** | Haiku with a large margin for misuse; Sonnet up to about 130 to 340 profiles | Small |
| C | US$50 | Sonnet at about 270 to 680 profiles | More exposed to misuse before anyone notices |

Recommendation: **US$25 a month during the soft launch and the first 3 months, reviewed at the 3-month mark** with real token data.

Limits in the app (for tech-lead and backend-engineer to design; security-reviewer to check):
- **A separate Anthropic API key and workspace** for the helper and pre-checks, with its own spend limit set in the Anthropic Console, so the concierge cannot use up the helper's budget or the other way round. Walter sets the limit himself; check the console option on his account.
- **Signed-in users only**, and only for their own profile.
- **[Assumption]** At most 5 helper calls per profile per day and 20 per account per month; input capped at about 3,000 words per call; `max_tokens` about 1,500 for the helper and 800 for summaries (not 4,000).
- **An alert at 50% and 80% of the cap**, sent to Walter (devops).
- **When the cap is reached:** the helper hides and people fill in the form by hand, and pre-checks pause. Nothing else stops.

### 2.6 Note on the concierge (outside this task, for Walter's awareness)

The concierge uses Opus 5.5, the dearest of the three, with `max_tokens` 4,000. That allows up to US$0.08 of output per reply (4,000 × $20/M), plus input. Its only rate limit is per IP and kept in memory, so it resets on every deploy.

I recommend tech-lead looks at three things:
- Testing Haiku 5.5 or Sonnet 5.5 for the concierge.
- Lowering `max_tokens`.
- Giving the concierge its own capped key, as the soft-launch plan already proposed (concierge "off or capped").

---

## Decisions for Walter

1. **Delivery model.** Recommendation: confirm the chief of staff's proposal. The shop delivers and sets its own charge: free, a fixed TSh fee per area, or "on request". The traveller pays the shop directly. Kwetuly doesn't calculate distance or collect the fee. Revisit distance-based estimates 3 months after the catalogue goes live, only if "on request" causes drop-offs.
2. **Pay on delivery as default.** Recommendation: yes. Shops may require payment first, but the form must show it before the traveller sends the request.
3. **Commission base.** Recommendation: items only, never delivery charges. Make the listing terms' "excludes delivery charges" final (legal and partnerships).
4. **Limits on delivery.** Recommendation: inside Tanzania only; tanzanite and gem shops collection only, until the advocate answers legal Q18.
5. **Kwetuly Shop delivery.** Recommendation: collection at one place, or delivery in one or two areas at a fixed TSh fee you set. Ask legal before using a paid rider.
6. **Order form fields.** Recommendation: approve the list in section 1.7 for the catalogue order form (board item P2).
7. **AI model.** Recommendation: Claude Haiku 5.5 for both the profile helper and pre-check summaries, after a side-by-side test against Sonnet 5.5 on 20 sample profiles. Use Sonnet 5.5 only if Haiku clearly fails on quality (for example inventing facts or poor Kiswahili).
8. **AI spending cap.** Recommendation: US$25 a month on a separate API key with its own console spend limit, alerts at 50% and 80%, and the per-user limits in 2.5. Review at 3 months.
9. **Dictation.** Recommendation: use the phone's or browser's own dictation (no extra cost), and send text only to the AI. Any paid transcription service needs its own quote first.
10. **Concierge cost review.** Recommendation: ask tech-lead to test a cheaper model and lower `max_tokens` for the concierge, and give it its own capped key.
