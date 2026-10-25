# Setting up Resend so Kwetuly can send alert emails

Written 2026-10-25 by devops for Walter. About 30 minutes of clicking, then some waiting.

**What this does:** Kwetuly already queues alert emails (new enquiry, new message, offer accepted and so on), but it cannot send them yet because there is no email sender connected. Resend is that sender. When you finish, alerts will go out from `alerts@kwetuly.com`.

**What it does not touch:** your incoming mail. ImprovMX keeps forwarding mail sent to @kwetuly.com addresses to your Gmail. None of the records below replace or edit the ImprovMX records.

**Price:** Resend has a free plan and paid plans. Check the current prices at https://resend.com/pricing before you start. Nothing in this guide needs a paid plan.

**Golden rule:** the API key you make in Part 4 is a password. Never paste it into a chat with Claude or anyone else, never email it, never put it in a document. It goes in one place only: the Supabase secrets page (Part 5).

**One thing to do first (devops, with your approval):** the copy of the alert sender running on Supabase today is an older version that still says "Rafrika" in the emails. Devops needs your OK to update it (one deploy of the `notify` function) before you add the key in Part 5. You can do Parts 1 to 4 at any time.

---

## Part 1: Create the Resend account

1. Open https://resend.com and click **Sign up**.
2. Sign up with **kwetuly@gmail.com**. Use a strong password and save it in your password manager.
3. Open the confirmation email in kwetuly@gmail.com and click the link.
4. If Resend offers two-step sign-in (a code from an app on your phone), turn it on: **Settings → Security** (the menu name may differ slightly).
5. If Resend asks you to accept its terms, read them and accept them yourself.

## Part 2: Add the kwetuly.com domain in Resend

1. In Resend, click **Domains** in the left menu, then **Add Domain**.
2. Domain name: type `kwetuly.com`.
3. Region: choose **Ireland (eu-west-1)**.
   - Why: the region is where the emails are sent from. Ireland is the closest of Resend's four regions to Tanzania and to most of our travellers (Europe), so emails arrive a little faster.
   - You can only change the region later by deleting the domain and starting again, so pick it once.
   - Resend keeps your account data in the United States whichever region you pick. Note this in the privacy notice (legal will add it).
4. Click **Add**. Resend now shows a table of DNS records, usually three:

   | Type | Name (what Resend shows) | What it is for |
   | --- | --- | --- |
   | MX | `send` | Lets Resend handle bounced emails. It sits on `send.kwetuly.com`, not on `kwetuly.com`, so it does not affect ImprovMX. |
   | TXT | `send` | Says Resend is allowed to send for `send.kwetuly.com` (called SPF). It starts with `v=spf1`. |
   | TXT | `resend._domainkey` | A digital signature key (called DKIM). The value is long and starts with `p=`. |

5. Leave this Resend tab open. You will copy from it in Part 3.
6. If Resend offers an **Auto Configure** button for Vercel, do not use it. It asks to let Resend change your Vercel DNS, which is more access than it needs. Copying the three records by hand (below) takes five minutes.

## Part 3: Copy the records into Vercel

1. In a new tab, open https://vercel.com and sign in.
2. Make sure the team at the top left is **kwetuly**.
3. Click **Domains** (in the team menu), then click **kwetuly.com**.
4. Find **DNS Records**. You will see the records that are already there, including the two ImprovMX MX records and the ImprovMX TXT record. **Do not edit or delete these.**
5. Add the first Resend record (the MX):
   1. Click **Add** (or **Add Record**).
   2. **Name:** type only `send`. Never type `.kwetuly.com` here; Vercel adds it for you.
   3. **Type:** choose `MX`.
   4. **Value:** in Resend, click the copy button next to the MX value and paste it here. It will look like `feedback-smtp.eu-west-1.amazonses.com`.
   5. **Priority:** type the number Resend shows (normally `10`). This does not clash with ImprovMX's priority 10 because the two records are on different names (`send.kwetuly.com` and `kwetuly.com`).
   6. **TTL:** `60`.
   7. Click **Add** / **Save**.
6. Add the second Resend record (the SPF TXT):
   1. Click **Add**.
   2. **Name:** `send`
   3. **Type:** `TXT`
   4. **Value:** copy from Resend and paste. It looks like `v=spf1 include:amazonses.com ~all`. Do not add extra quote marks if Vercel already shows them.
   5. **TTL:** `60`
   6. Save.
7. Add the third Resend record (the DKIM TXT):
   1. Click **Add**.
   2. **Name:** `resend._domainkey`
   3. **Type:** `TXT`
   4. **Value:** use the copy button in Resend (the value is too long to type safely) and paste it.
   5. **TTL:** `60`
   6. Save.
8. Add a fourth record that Resend does not create but which helps your emails avoid the spam folder (called DMARC):
   1. Click **Add**.
   2. **Name:** `_dmarc`
   3. **Type:** `TXT`
   4. **Value:** `v=DMARC1; p=none; rua=mailto:dmarc@kwetuly.com`
   5. **TTL:** `60`
   6. Save.
   - What it does: tells other mail services "don't block anything yet, but send reports about mail using our name to dmarc@kwetuly.com". `p=none` means nothing is blocked, so it is safe to add now.
   - In ImprovMX, make sure mail to `dmarc@kwetuly.com` reaches you: either you already have a catch-all (`*`) alias, or add an alias `dmarc` that forwards to kwetuly@gmail.com. These reports are machine-made files; you do not need to read them, but devops can look at them later.
9. **Do not change** the existing root TXT record `v=spf1 include:spf.improvmx.com ~all`. Resend uses `send.kwetuly.com`, so the root record stays exactly as it is.

When you are done, the DNS list should have the old ImprovMX records unchanged plus four new ones: `send` (MX), `send` (TXT), `resend._domainkey` (TXT), `_dmarc` (TXT).

## Part 4: Verify the domain and make the API key

1. Go back to the Resend tab and click **Verify DNS Records** (or **Verify**).
2. It often goes green within minutes, but can take a few hours. If it still says pending after a day, tell devops; we can check the records from outside without needing your login.
3. Once the domain shows **Verified**, click **API Keys** in the left menu, then **Create API Key**.
4. **Name:** `supabase-notify`
5. **Permission:** choose **Sending access** (not Full access).
6. **Domain:** choose **kwetuly.com**.
7. Click **Add** / **Create**. Resend shows the key once. Leave this window open and go straight to Part 5. Do not save the key anywhere else, and never paste it into chat.

## Part 5: Put the settings into Supabase

1. In a new tab, open https://supabase.com/dashboard and sign in.
2. Open the Kwetuly project (its ID is `zsymxfommlxqqfywekuy`).
3. In the left menu click **Edge Functions**, then **Secrets** (it may be under **Manage secrets** or the project **Settings → Edge Functions**).
4. Add three secrets. The names must be typed exactly as shown, in capitals:

   | Name | Value |
   | --- | --- |
   | `RESEND_API_KEY` | Paste the key from the Resend window. |
   | `EMAIL_FROM` | `Kwetuly <alerts@kwetuly.com>` |
   | `SITE_URL` | `https://kwetuly.com` |

5. Click **Save** (or **Bulk save**).
6. Go back to Resend and close the key window. If you ever think the key was seen by someone else, delete it in Resend → API Keys and make a new one, then replace it in Supabase.

## Part 6: Tell devops you are done

Send a short message such as "Resend done, domain verified, secrets saved". Do not include the key. Devops will then:

- check, without seeing your key, that the next alert email goes out (the alert list in the database will show it as "sent", and Resend's **Emails** page will list it);
- tell you if any email bounced or failed.

### Good to know

- Alerts that were queued during testing before today were marked "skipped". They will **not** suddenly be sent when the key is added, so nobody gets old test emails.
- WhatsApp alerts are a separate step (they need a Meta Business account) and are not part of this guide.
- Later, once we have seen a few weeks of DMARC reports showing everything passes, devops will suggest changing `p=none` to `p=quarantine`. That is a small edit to the `_dmarc` record and needs your approval.
