# Kwetuly hosting plan: GitHub, Vercel, domain, email

Written by devops, 2026-10-24. **This is a plan only.** Nothing in it has been done yet. No accounts, remotes, deploys, DNS records or secrets have been created or changed. Walter does every step himself, signed in to his own accounts.

What we have today:
- The code is in a local git repo on branch `main` with no remote. It has 89 commits. `docs/team/board.md` has an uncommitted change.
- The website is `apps/web` (Next.js 16.4, npm workspaces, `package-lock.json` at the repo root). It uses the shared package `@kwetuly/shared` from `packages/shared`.
- The database and sign-in are Supabase project `zsymxfommlxqqfywekuy`.
- kwetuly.com was bought on Vercel today, in the team "kwetuly", on the Hobby plan. Its DNS is therefore managed by Vercel.

Marks used below: **[check]** means I am not fully sure and Walter should confirm it on the screen or pricing page before relying on it. **[code]** means an engineer needs to change code; that is not part of this plan.

---

## 0. Checks before anything goes online (done by devops today, read-only)

- No `.env` files are tracked by git. `.env*.local` and `*.local.md` are git-ignored, which includes `supabase/test-accounts.local.md`.
- I searched the tracked files and the full git history for secret-shaped strings: Supabase secret keys, Anthropic keys, JWTs, Resend and PostHog keys, private keys, and `..._SECRET=` or `..._KEY=` lines. **Nothing was found.** This search only catches known patterns. It is a quick check, not a guarantee.
- `.mcp.json` is tracked. It contains only the Supabase project ref, which is not a secret; the same ref is already in `next.config.ts`.
- **Still to do before the push:** commit `docs/team/board.md` or leave it out (Walter decides). Then run `git status` and make sure nothing unexpected is staged.

---

## 1. Create a private GitHub repo and push

Use **Walter's personal GitHub account**, not a GitHub organization. **[check]** As far as I know, Vercel Hobby can't deploy from private repos owned by a GitHub organization; that needs Pro. A personal account avoids the problem. The repo can be moved to an organization later.

**Option A: website plus terminal**
1. Go to https://github.com/new and sign in.
2. Owner: your personal account. Repository name: `kwetuly`. Visibility: **Private**.
3. Leave "Add a README", ".gitignore" and "license" all **off**. The repo must be empty.
4. Click **Create repository**.
5. In a terminal at `C:\Users\walte\Projects\rafrika`:
   ```bash
   git status                      # should be clean (or only what you intend)
   git ls-files | grep -i "\.env"  # must print nothing
   git remote add origin https://github.com/<your-github-username>/kwetuly.git
   git push -u origin main
   ```
   Git for Windows opens a browser window for GitHub sign-in the first time. Sign in there and never paste a token into chat.

**Option B: GitHub CLI** (needs `gh` installed and `gh auth login` done by Walter)
```bash
gh repo create kwetuly --private --source . --remote origin --push
```

Check afterwards: on github.com, the repo shows the lock icon (Private), and no `.env.local` file appears anywhere in it.

---

## 2. Import into Vercel (team "kwetuly")

1. Go to https://vercel.com, sign in, and pick the team **kwetuly** in the team switcher at the top left.
2. Click **Add New...** and then **Project**.
3. Under "Import Git Repository", click **Continue with GitHub**. When GitHub asks, install the Vercel GitHub app and choose **Only select repositories**, then pick `kwetuly`. This is a permission grant, so Walter does it.
4. Click **Import** next to `kwetuly`.
5. Configure:
   - **Project Name:** `kwetuly-web`
   - **Framework Preset:** Next.js (it should be detected automatically)
   - **Root Directory:** click **Edit** and choose `apps/web`
   - **Build Command:** leave the default (`next build`)
   - **Output Directory:** leave the default
   - **Install Command:** leave the default. Vercel finds the root `package-lock.json` and the `workspaces` list and installs the whole workspace, so `@kwetuly/shared` resolves. `next.config.ts` already has `transpilePackages: ["@kwetuly/shared"]`.
   - **Environment Variables:** add them now (see section 3). If they are missing, the first build may work but sign-in will not.
6. Click **Deploy**. The first deployment is a production deployment on a `*.vercel.app` address.
7. After the deploy, open **Settings → Build and Deployment**:
   - **Node.js Version:** pick **24.x** to match the local Node v24.20. **[check]** Use 22.x if 24.x isn't offered.
   - **Root Directory:** keep "Include files outside of the Root Directory in the Build Step" **enabled**, because the build needs `packages/shared`. **[check]** It should be on by default for monorepos.
   - **Skip deployment** for unaffected projects can stay on. Then commits that only touch `apps/mobile` won't rebuild the site.
8. **Settings → Git:** Production Branch = `main`. Every other branch and pull request gets a Preview deployment.
9. **Settings → Deployment Protection:** turn on **Vercel Authentication** for Preview deployments, so only Walter can open previews. **[check]** I believe this is available on Hobby.

If the build fails at install with "cannot find @kwetuly/shared", set **Install Command** to `cd ../.. && npm ci` as a fallback and redeploy. Only use this if the default fails.

**[code]** Not a blocker: a later commit could add `"engines": { "node": "24.x" }` to the root `package.json` to pin Node in code.

---

## 3. Environment variables (names only)

There is **no `.env.example`** in the repo. I took these names from the code (`process.env.*` in `apps/web`) and from the key names in `apps/web/.env.local`. I read the names only, never the values. **[code]** Someone should add an `apps/web/.env.example` with names and empty values.

Add them in Vercel under **Project → Settings → Environment Variables**. Copy each value from `apps/web/.env.local` yourself. Never paste values into chat or commit them.

| Name | Production | Preview | Secret? | Notes |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | no (public) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | yes | no (public, safe with RLS) | publishable key, **not** the secret or service key |
| `RECOVERY_COOKIE_SECRET` | yes | yes | **yes, mark Sensitive** | Server-only. **Only in Vercel and `apps/web/.env.local`.** Never prefix it with `NEXT_PUBLIC_`. Use a separate random value of 32+ characters per environment, generated on your computer (`openssl rand -base64 48`). Without it, password reset is turned off; the code fails closed. |
| `NEXT_PUBLIC_SITE_URL` | `https://kwetuly.com` | see note | no | Used for the sitemap and auth email links. **[code]** The code default becomes `https://kwetuly.com` with the 2026-10-24 rename. If you leave it unset on Preview, preview sign-up and reset emails will point at the live kwetuly.com. Short term: set Preview to the project's stable preview address (shown on the deployment page) or accept that auth emails don't work on previews. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | `support@kwetuly.com` once section 6 works | same | no | "Contact" links stay hidden while this is empty |
| `NEXT_PUBLIC_INDEXING` | **leave unset** | leave unset | no | Set to `on` only at public launch, then redeploy. While unset, robots.txt blocks search engines and every page says noindex. |
| `NEXT_PUBLIC_POSTHOG_KEY` | optional | optional | no (public) | Analytics. Leave it out until data-analyst and Walter decide. |
| `NEXT_PUBLIC_POSTHOG_HOST` | optional | optional | no | Goes with the key |
| `ANTHROPIC_API_KEY` | optional | no | **yes, Sensitive** | Setting it switches on the AI concierge, which costs money per use. The business plan says "off or capped". Leave it unset until Walter decides. |

- Do **not** add `SIGNUP_INVITE_CODES`. It is still in `.env.local`, but the website code no longer reads it; invite codes moved into the database (migration `20261016001500_invite_codes.sql`). It can be removed from `.env.local` later.
- `NEXT_PUBLIC_*` values are baked in at build time. After changing one, **redeploy**.
- Never add a Supabase service or secret key to the website project. The code doesn't use one.

**Not Vercel:** the Supabase Edge Function `notify` reads its own secrets. Set them in **Supabase dashboard → Edge Functions → Secrets** (Walter only): `RESEND_API_KEY`, `EMAIL_FROM` (set to `Kwetuly <alerts@kwetuly.com>`; the code default becomes kwetuly.com with the 2026-10-24 rename), `SITE_URL` (`https://kwetuly.com`), and later `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE` and optionally `EXPO_ACCESS_TOKEN`.

The mobile app's `EXPO_PUBLIC_*` variables belong to EAS, not Vercel. They are planned separately.

---

## 4. Add kwetuly.com and www

**Recommendation: `kwetuly.com` (apex) is the main address, and `www.kwetuly.com` redirects to it with a 308.**
- It is shorter and matches the brand, the handles and the email addresses.
- Vercel's docs generally recommend www as the main address, because apex domains need A records while www can use a CNAME. That matters most when DNS is hosted somewhere else. Here Vercel runs the DNS itself and serves the apex over Anycast, so the difference is small.
- If Walter prefers to follow Vercel's default, the reverse (apex redirects to www) also works. Pick one before launch and don't switch later, because search engines and auth redirect lists depend on it.

Steps:
1. Vercel → project `kwetuly-web` → **Settings → Domains → Add Domain**. Enter `kwetuly.com` and click Add.
2. Vercel offers to add `www.kwetuly.com` too. Accept the option where **www redirects to kwetuly.com**.
3. If it isn't offered: add `www.kwetuly.com`, click **Edit** on it, set **Redirect to** = `kwetuly.com` with status **308 Permanent**, and Save.
4. Both should show "Valid Configuration". Because the domain was bought on Vercel, Vercel creates the DNS records itself, with nothing to type.
5. Check: `https://www.kwetuly.com/` should land on `https://kwetuly.com/`, and the padlock should show a valid certificate.

The custom domain always follows the latest production deployment of `main`.

---

## 5. Supabase sign-in URLs for kwetuly.com

The site sends people to `/auth/confirm` (sign-up confirmation, magic link, password reset). The app uses the scheme `kwetuly://auth-callback` for social sign-in.

1. Supabase dashboard → project `zsymxfommlxqqfywekuy` → **Authentication → URL Configuration**.
2. **Site URL:** `https://kwetuly.com`
3. **Redirect URLs:** add these. Write down what is there now before changing anything, and **don't remove the localhost entries**.
   - `https://kwetuly.com/**`
   - `http://localhost:3000/**` (keep for local development)
   - `https://*-kwetuly.vercel.app/**` for Vercel previews. **[check]** After the first deploy, compare this with the real preview address on the deployment page and adjust the pattern.
   - `kwetuly://**` for the app. The scheme was renamed from `rafrika` on 2026-10-24; if an existing `rafrika://**` entry is there, remove it once no development build on a phone still uses the old scheme.
   - No `www` entry is needed, because www always redirects to the apex.
4. Click Save.
5. **Authentication → Email Templates:** look for any hard-coded "rafrika.com" or "Rafrika" text and change it to Kwetuly. **[check]** I couldn't see the templates from here.
6. If Google or Apple sign-in is switched on (see `apps/web/src/lib/auth-providers.ts`): Supabase's callback address (`https://zsymxfommlxqqfywekuy.supabase.co/auth/v1/callback`) stays the same. The home page, privacy and terms links and the authorised domains on Google's consent screen and Apple's settings need `kwetuly.com`. **[check]** I don't know which providers are on.
7. Recommended before real users: **Authentication → Emails → SMTP Settings** with Resend as custom SMTP, so sign-in emails come from `no-reply@kwetuly.com` instead of Supabase's built-in test mailer, which has a very low hourly limit. **[check]** These are the Resend SMTP details as I understand them; confirm in Resend's docs:
   - Host `smtp.resend.com`
   - Port 465
   - Username `resend`
   - Password: a Resend API key, which Walter pastes himself

   This needs section 7 done first.

Test: on https://kwetuly.com, request a password reset for a test account. The email link should open `https://kwetuly.com/auth/confirm...` and let you set a new password.

---

## 6. Free email forwarding for support@kwetuly.com (ImprovMX)

Vercel doesn't forward email. ImprovMX's free plan: **1 domain, 25 aliases, 500 forwarded emails a day, no sending (SMTP) on the free plan**. Paid plans start at US$9/month, or US$50/year for "Light". (Source: improvmx.com/pricing, checked 2026-10-24.)

1. Walter signs up at https://improvmx.com and adds the domain `kwetuly.com`.
2. Create aliases that forward to Walter's own inbox:
   - `support@kwetuly.com`
   - `payments@kwetuly.com` (the board mentions it)
   - optionally `hello@kwetuly.com` and `dmarc@kwetuly.com`, the last one for reports, see section 7
3. Add the DNS records in Vercel: **team kwetuly → Domains → kwetuly.com → DNS Records → Add**. For records on the root domain, leave Name empty (or type `@` if the form asks for it).

| Type | Name | Value | Priority |
| --- | --- | --- | --- |
| MX | (empty / @) | `mx1.improvmx.com` | 10 |
| MX | (empty / @) | `mx2.improvmx.com` | 20 |
| TXT | (empty / @) | `v=spf1 include:spf.improvmx.com ~all` | (none) |

(Source: improvmx.com/guides/generic-dns-configuration.)

4. In ImprovMX, click to check the DNS. Both should turn green. This can take a few minutes, sometimes longer.
5. Test: from a different email account, write to support@kwetuly.com and check that it arrives.

**Limit to know about:** on the free plan, replies go out **from Walter's own address**, not from support@kwetuly.com. Replying as support@ needs a paid ImprovMX plan or another mail service. Walter decides if and when.

**Only one SPF record is allowed on the root domain.** If anything later needs to send as `@kwetuly.com` straight from the root domain, add its `include:` to this same record. Don't create a second SPF record.

---

## 7. Resend sender records for alerts@kwetuly.com, and how they fit with ImprovMX

1. Walter signs in at https://resend.com (free plan: 3,000 emails a month, 100 a day). Go to **Domains → Add Domain** and enter `kwetuly.com`. Pick the region Resend suggests.
2. Resend shows a **Records** tab with the exact records. **Copy them exactly as Resend shows them**, because the values (especially the DKIM key) are unique to our account. From Resend's docs and my understanding, it normally asks for:
   - a **DKIM** TXT record named `resend._domainkey` on the root domain **[check the name on screen]**
   - a **Return-Path** on the subdomain **`send`** (`send.kwetuly.com`): an **MX** record (pointing at an Amazon SES feedback host, usually priority 10) and a **TXT SPF** record (`v=spf1 include:amazonses.com ~all`) **[check both values on screen]**
3. Add each record in **Vercel → Domains → kwetuly.com → DNS Records**. Name = only the part before `.kwetuly.com`, for example `send` or `resend._domainkey`.
4. In Resend, click **Verify**.

**How this fits with ImprovMX:**
- ImprovMX's MX and SPF records sit on the **root** `kwetuly.com`. They decide where *incoming* mail for support@ goes.
- Resend's MX and SPF records sit on the **`send` subdomain**. They are only used for bounces of *outgoing* alerts, and SPF is checked against that Return-Path subdomain.
- Different names, so **no clash**. The root keeps exactly one SPF record (ImprovMX's); `send` has its own.
- `alerts@kwetuly.com` passes DMARC through Resend's DKIM signature for kwetuly.com, not through the root SPF.
- Don't add `include:amazonses.com` to the root SPF unless Resend specifically asks for it.

5. Add DMARC once both work, starting in report-only mode:

| Type | Name | Value |
| --- | --- | --- |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@kwetuly.com` |

   After a few weeks of clean reports, tighten it to `p=quarantine`. That is a separate decision for Walter.

6. Set the Supabase Edge Function secrets `RESEND_API_KEY` and `EMAIL_FROM=Kwetuly <alerts@kwetuly.com>` (section 3) yourself in the Supabase dashboard.
7. Test: queue one test alert to your own address. Check that it arrives and that "show original" in Gmail shows **SPF pass, DKIM pass, DMARC pass**.

**Option (Resend recommends it):** send from a subdomain such as `alerts@mail.kwetuly.com`, which keeps any sending reputation problems away from the main domain. The board asked for `alerts@kwetuly.com`, so the plan above uses the root. Walter can choose.

**Reply-to:** alerts@ shouldn't receive replies. **[code]** The `notify` function could set `reply_to: support@kwetuly.com`. Without that, a reply to alerts@ bounces, unless an `alerts` alias is added in ImprovMX.

---

## 8. Paid plans: when and how

| Service | Plan | Cost | When |
| --- | --- | --- | --- |
| Vercel | Hobby | free | Now, while building and testing. Hobby is for **non-commercial use only**. |
| Vercel | **Pro** | **US$20 per seat per month** (1 seat = Walter) | **Before the public launch or the first real booking, payment or business badge fee, whichever comes first.** An invite-only soft launch that takes real money is commercial use. |
| Supabase | Free | free | Now. Free projects pause after a week without activity and have no automatic daily backups. **[check]** |
| Supabase | **Pro** | **US$25 per month** (per organization; includes compute credit for one small project) **[check]** | **At launch**, before real traveller, guide or business data. It gives daily backups, kept 7 days **[check]**, and no pausing. Point-in-time recovery is an extra paid add-on. |
| Domain | kwetuly.com | US$11.25 per year | Bought 2026-10-24. Renewal date is in Vercel → Domains. |
| ImprovMX | Free | free | Now |
| Resend | Free | free; Pro US$20/month if the limit of 100 emails a day is hit | Now |

**Total at launch:** about US$45/month, plus the domain. That matches the business plan's figure of "about US$46/month".

How Walter upgrades:
- **Vercel:** team kwetuly → **Settings → Billing** → **Upgrade to Pro**. Check that the seat count is 1. Then, under Billing, set a spend alert or limit.
- **Supabase:** Organization → **Billing → Change subscription plan → Pro**. Keep the **Spend Cap** on. Afterwards, check that **Database → Backups** shows daily backups.

**[check]** Rollback limit: as far as I know, Vercel's Instant Rollback on Hobby can only go back to the *previous* production deployment, while Pro can go back to any earlier one. That is one more reason to be on Pro before launch.

---

## 9. Order Walter can follow

1. Section 1: GitHub repo and push.
2. Section 3: prepare the variable values (generate a new `RECOVERY_COOKIE_SECRET` for production).
3. Section 2: Vercel import with the variables. The first deploy goes to `*.vercel.app`.
4. Section 4: domain and www redirect.
5. Section 5: Supabase URLs. Test password reset on kwetuly.com.
6. Section 6: ImprovMX. Test support@. Then set `NEXT_PUBLIC_SUPPORT_EMAIL` and redeploy.
7. Section 7: Resend records, DMARC, the Edge Function secrets, and custom SMTP in Supabase (section 5, step 7).
8. Section 8: upgrade before launch or the first real money.

Tell devops after each step and I will check what can be checked from outside: DNS lookups, the redirect, page responses. I won't say something works until I have checked it.

---

## 10. Gaps and open decisions (not solved by this plan)

- **Staging:** there is only one Supabase project, so Vercel Preview deployments would use the **real database**. Proposal: a second, free Supabase project for staging, with Preview variables pointing at it, migrations from `supabase/migrations` and only `is_sample` seed data. Until then, keep previews behind Vercel Authentication (section 2, step 9). Walter decides.
- **Monitoring is not running.** Nothing is set up yet: no error reporting (with personal data removed), no uptime checks, no alerts. That is a separate plan for after the first deploy.
- **Rename code changes [code]:** all for frontend-engineer and backend-engineer in the rename step (old names listed so they can be found; being done in the 2026-10-24 rename).
  - default `SITE_URL` in `apps/web/src/lib/site.ts` (rafrika.com)
  - `EMAIL_FROM`, `SITE_URL` and the WhatsApp template defaults in `supabase/functions/notify/index.ts`
  - the app scheme `rafrika` in `apps/mobile/app.json`
  - the cookie name `rafrika_recovery`
  - package names `@rafrika/*`. Changing these affects `transpilePackages` and the lockfile, so rebuild and test after.
- **Release rollback plan:** a website release is undone with Vercel → Deployments → previous production deployment → **Instant Rollback**, or by reverting the commit on `main`. Database migrations don't roll back with it; each migration needs its own written undo step before release. This goes into `docs/team/release-checklist.md` with qa-tester.
