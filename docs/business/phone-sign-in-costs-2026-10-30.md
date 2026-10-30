# Phone sign-in (one-time code by SMS or WhatsApp): costs, rules and risk

Prepared by: business-manager, 2026-10-30. Research only: no sign-ups, no contacts with any provider, operator or authority.
Status: draft for Walter. Every price is marked "checked on 2026-10-30, source" or "to verify". Amounts are in US$ unless shown otherwise; TSh conversion to be done by accounting at the day's rate (no rate assumed here).

## 1. Short answer

- **SMS to Tanzania is expensive.** Twilio lists US$0.4336 per SMS segment to Tanzania. At 10,000 sign-ins a month that is about US$5,600 to US$6,100 a month.
- **WhatsApp is about 50 times cheaper.** It costs about US$0.009 per code (Twilio fee plus Meta's fee). The Meta part of that price is still marked "to verify".
- **There is a launch blocker for SMS.** Since 16 June 2025, Vodacom, Airtel, Tigo/Yas and Zantel block SMS from unregistered sender names. Registering a sender name needs company documents (registration certificate, TIN). Kwetuly's company is not registered yet.
- **Fake sign-ups that trigger codes ("SMS pumping") are a real cost risk.** A captcha, rate limits, a Tanzania-only setting and Twilio Fraud Guard reduce it a lot.
- **Recommendation: no-go for phone sign-in at public launch.** Keep email, Google and Apple. Prepare WhatsApp-first codes through Twilio, with SMS as a backup, for after the company is registered. Details are in section 8.

## 2. Price per message to Tanzanian numbers

| Provider / channel | Price | Per-network detail | Status |
| --- | --- | --- | --- |
| Twilio Programmable SMS, Tanzania | US$0.4336 per segment (one segment = 160 characters). Registered alphanumeric sender: also US$0.4336. Failed messages: US$0.001 processing fee. "Additional carrier fees may apply". | Twilio shows one rate for all Tanzanian networks; it lists no separate prices for Vodacom, Airtel, Tigo/Yas or Halotel | Checked on 2026-10-30, https://www.twilio.com/en-us/sms/pricing/tz |
| Twilio Verify (SMS) | US$0.05 per **successful** verification plus the SMS channel fee for **every** attempt, delivered or not. The Verify page shows only the US channel fee (US$0.0083). The Tanzania channel fee is assumed equal to the SMS rate above. | Same as above | Base fee checked on 2026-10-30, https://www.twilio.com/en-us/verify/pricing. Tanzania channel fee **to verify** |
| Twilio WhatsApp, authentication message | Twilio fee US$0.005 per message, plus Meta's fee | n/a (WhatsApp does not depend on the mobile network) | Twilio fee checked on 2026-10-30, https://www.twilio.com/en-us/whatsapp/pricing |
| Meta fee, WhatsApp authentication, "Rest of Africa" region (Tanzania, +255, is in this region) | US$0.0040 per delivered message. Meta charges only for delivered messages. Rest of Africa has no separate higher "authentication-international" rate. | n/a | Region membership and "delivered only" checked on 2026-10-30, https://developers.facebook.com/docs/whatsapp/pricing. The **US$0.0040 figure comes from a third party** (SleekFlow table "as of 1 October 2026", https://sleekflow.io/blog/whatsapp-business-price). Meta's own CSV rate card could not be read, so **to verify** |
| Twilio Verify (WhatsApp) | US$0.05 per successful verification plus a WhatsApp channel fee. Twilio's page gives two different channel fees (US$0.0034 in the table, US$0.0147 in the FAQ). | n/a | Checked on 2026-10-30, https://www.twilio.com/en-us/verify/pricing. Channel fee **to verify** |
| Vonage SMS, Tanzania | Not published. The page says "contact sales". | n/a | **To verify** (the pricing page refused access; https://www.vonage.com/communications-apis/messages/pricing/) |
| Bird (MessageBird) SMS and WhatsApp, Tanzania | Not published. Only US rates are shown and Tanzania needs "contact sales". Bird says Verify has no separate verification fee: you pay only for the messages. | n/a | Checked on 2026-10-30, https://bird.com/pricing and https://bird.com/pricing/sms. Tanzania rates **to verify** |
| Textlocal | Mainly a UK and India provider. Supabase lists it as "community supported". Delivery to Tanzania and its price are not confirmed. | n/a | **To verify** |
| Plivo (for comparison only, not built into Supabase; it would need the "Send SMS hook") | Vodacom US$0.2108, Airtel US$0.2754, tiGO US$0.3011, Halotel US$0.3011, Zantel US$0.3792, TTCL US$0.1695. Yas is not named (Tigo was renamed Yas). | Per network | Checked on 2026-10-30, https://www.plivo.com/sms/pricing/tz/ |

Note: the Plivo figures show that SMS prices to Tanzania differ by network, and that Twilio's flat rate is at the high end. Local Tanzanian bulk-SMS companies sell in TSh, but I found no published rates I could verify. Using one would also need the Supabase Send SMS hook (section 6).

## 3. Delivery notes: sender ID, TCRA, reliability

- **Sender names must be registered.** Twilio says Tigo, Zantel, Vodacom and Airtel require a registered alphanumeric sender name (for example "Kwetuly"). "Starting on June 16, 2025, messages with unregistered Sender IDs to these networks will be blocked." Halotel and other smaller networks accept unregistered names. Registration through Twilio takes about 4 weeks (international) or about 3 weeks (domestic). Source: https://www.twilio.com/en-us/guidelines/tz/sms, checked 2026-10-30.
- **No phone-number senders.** Tanzanian networks do not support numeric senders (long codes or short codes), and Tanzanians cannot reply to these messages. Same source.
- **Generic names are refused.** Names like "INFO", "Verify" or "Notify" are rejected, and the name must match the brand. Same source, and Telerivet (below).
- **Each network registers separately.** Yas also registers the message template. Airtel requires the brand name to appear in the message. Telerivet says there is currently no registration fee and it takes 2 to 4 weeks. This is a third-party source, so the fee is **to verify**: https://www.telerivet.com/blog/sending-sms-in-tanzania-tcra-sender-id-registration-the-pdpa-and-what-operators-need-to-knowtanzania-sms-compliance-tcra-sender-id-pdpa
- **Documents.** A Tanzanian SMS reseller lists a business registration or incorporation certificate, a TRA TIN certificate, and a request letter on company letterhead: https://billing.sakurahost.co.tz/knowledgebase/45/Understanding-SMS-Sender-IDs-and-How-to-Request-One-in-Tanzania.html (third party, to verify). Twilio's own Tanzania document list could not be read (access refused): https://support.twilio.com/hc/en-us/articles/360042501534. **Kwetuly cannot register a sender name until the company is registered.**
- **TCRA.** TCRA oversees telecoms under the Electronic and Postal Communications Act. Telerivet reports TCRA SMS monitoring since October 2024 and separate bulk-SMS rules around the 2025 election. I did not find an official TCRA document specifically about one-time codes. **Legal should confirm with a Tanzanian advocate.**
- **Data protection.** Phone numbers are personal data under the Personal Data Protection Act 2022, and Kwetuly may need to register with the PDPC. Pass to legal.
- **Reliability.** I found no published delivery-rate figures for Tanzania and invent none. Practical points:
  - Messages from unregistered names are blocked on the four large networks.
  - Long messages may not be joined correctly, so keep codes under 160 characters.
  - WhatsApp works only if the person has WhatsApp. Meta charges only for delivered messages, while Twilio Verify charges every SMS attempt.
  - **Plan a test on all four large networks before any launch.**
- **WhatsApp prerequisite.** Since 1 March 2024, Twilio requires your own WhatsApp Business sender (your own number and brand) to send WhatsApp codes: https://www.twilio.com/docs/verify/whatsapp. Automatic fallback from WhatsApp to SMS in Verify is a limited pilot only. Whether Meta business verification needs a registered company is **to verify**, but it is likely.

## 4. Monthly cost at 100, 1,000 and 10,000 sign-ins

Assumptions:
- 1.3 codes per sign-in.
- One SMS segment per code.
- Every sign-in ends in one successful verification (the US$0.05 Verify fee).
- Twilio Verify's Tanzania SMS channel fee equals US$0.4336 (to verify).
- Meta's WhatsApp authentication fee is US$0.0040 (to verify).
- No extra carrier fees, taxes or volume discounts.

These are estimates.

| Option | Price per code | 100 sign-ins (130 codes) | 1,000 sign-ins (1,300 codes) | 10,000 sign-ins (13,000 codes) |
| --- | --- | --- | --- | --- |
| A. Twilio Programmable SMS | US$0.4336 | US$56.37 | US$563.68 | US$5,636.80 |
| B. Twilio Verify, SMS | US$0.4336 + US$0.05 per success | US$61.37 | US$613.68 | US$6,136.80 |
| C. Twilio WhatsApp (Supabase "Twilio" provider, WhatsApp channel) | US$0.005 + US$0.0040 = US$0.009 | US$1.17 | US$11.70 | US$117.00 |
| D. Twilio Verify, WhatsApp | about US$0.009 + US$0.05 per success | about US$6.17 | about US$61.70 | about US$617.00 |
| E. Mix: 80% WhatsApp (option C), 20% SMS backup (option A) (the split is an estimate) | blended | about US$12.21 | about US$122.10 | about US$1,221.00 |
| F. Plivo SMS via Send SMS hook (comparison only; Vodacom rate to Halotel rate) | US$0.2108 to US$0.3011 | US$27.40 to US$39.14 | US$274.04 to US$391.43 | US$2,740.40 to US$3,914.30 |

How the mix in option E works at 1,000 sign-ins: 1,040 WhatsApp codes × US$0.009 = US$9.36, plus 260 SMS × US$0.4336 = US$112.74, for a total of US$122.10.

Fixed costs not included:
- Twilio account and number costs. A WhatsApp sender needs a phone number, and its monthly price is **to verify**.
- Engineering time.
- The Supabase plan (section 6).

**Business view.** Codes are paid for at every sign-in, but sign-ins do not earn money. At 1,000 sign-ins a month, SMS through Twilio (option A) costs about US$564 a month. That is likely more than early guide-package revenue in the soft-launch months (see `docs/business/soft-launch-business-plan.md`). WhatsApp (option C) costs about US$12 a month. Ways to cut the number of codes:
- Long sessions, so people stay signed in.
- Remembered devices.
- Phone codes only where they are really needed, mainly for guides and business owners in Tanzania.

## 5. Risk from fake sign-ups (SMS pumping), and the protections

**The risk.** Bots enter phone numbers, often numbers that pay the fraudster a share of each message, and trigger many codes. Kwetuly pays for every SMS sent, even when nobody signs in.

Two worst-case examples (estimates):
- **Supabase default limit.** Supabase's default project limit is 30 SMS per hour. A bot running all day at that limit sends 720 SMS a day × US$0.4336 = about US$312 a day, or about US$9,400 a month.
- **Raised limit.** If the limit is raised to support 10,000 sign-ins a month without other protection, the exposure grows in proportion.

| Protection | What it does | Source (checked 2026-10-30) |
| --- | --- | --- |
| Supabase rate limits | Default 30 SMS per hour per project. One code per user every 60 seconds. 30 code checks per 5 minutes per IP address. All can be changed. | https://supabase.com/docs/guides/auth/rate-limits |
| Captcha (Supabase supports hCaptcha and Cloudflare Turnstile) | Blocks most automated requests before any code is sent. Supabase recommends it to "limit SMS costs". | https://supabase.com/docs/guides/auth/phone-login |
| Twilio Geo Permissions | Only allow sending to +255 (plus any countries Walter chooses). Blocks international pumping, which is the most common kind. | https://www.twilio.com/docs/verify/preventing-toll-fraud/sms-fraud-guard |
| Twilio Verify Fraud Guard | Spots unusual SMS patterns and blocks the number prefixes involved. Levels: Basic, Standard (default), Max (under 2% of real users blocked by mistake). SMS only. Included in the Verify base fee. Only available with Verify, not plain Programmable SMS. | Same page, and https://www.twilio.com/en-us/verify/pricing |
| WhatsApp first | Meta charges only for delivered messages, and WhatsApp is not exposed to the fees paid to fraudulent SMS numbers. Much lower exposure. | https://developers.facebook.com/docs/whatsapp/pricing |
| Kwetuly's own rules (to build) | Accept only valid Tanzanian mobile number formats. Per-number daily cap. Alert when daily spend passes a threshold. Twilio spending alerts and a prepaid balance without automatic top-up. | The Twilio spending-alert and prepaid-balance details are **to verify** |
| Supabase test numbers | Fixed codes for testing, so tests send no real SMS. | https://supabase.com/docs/guides/auth/phone-login |

Remaining risk with all of the above in place: low to medium for SMS, low for WhatsApp. This is a judgment, not measured.

## 6. Does Supabase phone sign-in need a paid plan, custom SMTP or an SMS setup?

- **Plan.** I found nothing saying phone sign-in needs a paid plan. Supabase's pricing page lists only "Advanced MFA - Phone" as a paid add-on: US$75 a month for the first project, then US$10 a month per extra project, on Pro or Team. That add-on is for a phone **second factor**, not phone **sign-in**. Checked on 2026-10-30, https://supabase.com/pricing. Whether phone sign-in works fully on the Free plan is **to verify** in the dashboard; there is no need to sign up for anything to check this.
- **Custom SMTP.** Not needed for phone codes. SMTP is for email. Note that Supabase's built-in email is only meant for testing, so a custom SMTP sender (for example Resend, which we already use for alert emails) is needed anyway for email sign-in.
- **SMS provider: yes, you must bring your own.** Supabase does not send SMS itself and does not pay for it. You connect your own account with one of these:
  - Twilio, Twilio Verify, MessageBird, Vonage or Textlocal (community supported).
  - WhatsApp works **only** with Twilio or Twilio Verify.
  - The "Send SMS" hook lets you call any other provider, such as Africa's Talking or a local Tanzanian company. This needs backend work. The pricing page lists "Send custom email/SMS" hooks on Free and Pro.

  Sources: https://supabase.com/docs/guides/auth/phone-login and https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook, checked 2026-10-30.
- **Rate limit.** The default 30 SMS per hour must be raised before real volume (section 5).

## 7. Which provider

| Provider | For Kwetuly | Against |
| --- | --- | --- |
| **Twilio (WhatsApp) + Twilio Verify (SMS backup)** | The only Supabase-supported provider for WhatsApp. Published prices. Fraud Guard and Geo Permissions. Handles sender-name registration in its Console. | SMS is the most expensive (US$0.4336). Needs your own WhatsApp Business sender. Automatic WhatsApp-to-SMS fallback is a pilot only. |
| Vonage | Built into Supabase | No published Tanzania price. No WhatsApp through Supabase. |
| Bird / MessageBird | Built into Supabase. No separate verification fee. | No published Tanzania price. The Supabase connection is the older MessageBird one (still working with Bird: to verify). |
| Textlocal | Built into Supabase | Coverage of Tanzania not confirmed |
| Local Tanzanian or regional company via the hook | Possibly cheaper. Local support. | Custom backend work. Prices not verified. |

## 8. Recommendation

**No-go for phone sign-in at public launch.**

Reasons:
1. SMS to Vodacom, Airtel, Yas and Zantel needs a registered sender name. That needs company documents Kwetuly does not have yet, plus 3 to 4 weeks.
2. Twilio SMS costs about US$0.43 per code, which is high compared with early revenue.
3. Phone codes add a new fraud cost that we do not have today.
4. Email, Google and Apple sign-in already work.

**Then go, in this order, once the company is registered:**
1. Register a "Kwetuly" WhatsApp Business sender and a "Kwetuly" SMS sender name through Twilio.
2. Turn on phone sign-in **for guides and business owners first**, WhatsApp first, through Supabase's Twilio provider (about US$0.009 per code, to verify).
3. Offer SMS as a backup through Twilio Verify, with Fraud Guard on Standard and Geo Permissions set to Tanzania only.
4. Turn on captcha and per-number daily caps, raise the Supabase SMS limit only as far as needed, and set a daily spend alert.
5. Test on Vodacom, Airtel, Yas and Halotel before turning it on for everyone.
6. Ask for a Tanzania quote from Twilio sales and one local provider before volumes pass about 1,000 sign-ins a month. This needs Walter's approval because it is a contact.

## Decisions for Walter

1. **Phone sign-in at public launch: no-go (recommended).** Keep email, Google and Apple, and revisit after the company is registered.
2. **Provider when it comes: Twilio** (WhatsApp first, Twilio Verify SMS as backup) (recommended), rather than Vonage, Bird or Textlocal, because only Twilio offers WhatsApp in Supabase and it publishes its prices.
3. **Who gets phone sign-in first: guides and business owners in Tanzania only (recommended).** Travellers keep email, Google and Apple.
4. **Spending cap: set a monthly cap for sign-in messages, with a daily alert (recommended).** For example US$50 a month during the soft launch. This is my estimate, not a quote; Walter sets the figure.
5. **Approval for later contacts (when the time comes):** Twilio sales and one Tanzanian SMS provider for quotes, and sender-name registration. Recommended only after the company is registered; nobody contacts them until Walter says so.
6. **Ask legal** to confirm TCRA and PDPC requirements for one-time-code messages and for storing phone numbers (recommended, internal only).

## Sources (all checked 2026-10-30)
- [Twilio SMS pricing, Tanzania](https://www.twilio.com/en-us/sms/pricing/tz)
- [Twilio Verify pricing](https://www.twilio.com/en-us/verify/pricing)
- [Twilio WhatsApp pricing](https://www.twilio.com/en-us/whatsapp/pricing)
- [Twilio Tanzania SMS guidelines](https://www.twilio.com/en-us/guidelines/tz/sms)
- [Twilio Verify Fraud Guard](https://www.twilio.com/docs/verify/preventing-toll-fraud/sms-fraud-guard)
- [Twilio Verify WhatsApp](https://www.twilio.com/docs/verify/whatsapp)
- [Meta WhatsApp pricing](https://developers.facebook.com/docs/whatsapp/pricing)
- [SleekFlow WhatsApp rate table (third party)](https://sleekflow.io/blog/whatsapp-business-price)
- [Plivo SMS pricing, Tanzania](https://www.plivo.com/sms/pricing/tz/)
- [Bird pricing](https://bird.com/pricing) and [Bird SMS pricing](https://bird.com/pricing/sms)
- [Vonage Messages pricing](https://www.vonage.com/communications-apis/messages/pricing/) (could not be read)
- [Supabase phone login](https://supabase.com/docs/guides/auth/phone-login), [rate limits](https://supabase.com/docs/guides/auth/rate-limits), [Send SMS hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook), [pricing](https://supabase.com/pricing)
- [Telerivet: SMS in Tanzania, TCRA and PDPA (third party)](https://www.telerivet.com/blog/sending-sms-in-tanzania-tcra-sender-id-registration-the-pdpa-and-what-operators-need-to-knowtanzania-sms-compliance-tcra-sender-id-pdpa)
- [Sakura: Sender IDs in Tanzania (third party)](https://billing.sakurahost.co.tz/knowledgebase/45/Understanding-SMS-Sender-IDs-and-How-to-Request-One-in-Tanzania.html)
