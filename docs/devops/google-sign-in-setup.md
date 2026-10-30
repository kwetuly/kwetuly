# Turning on "Continue with Google" for Kwetuly

Written 2026-10-27 by backend-engineer for Walter. About 30 minutes of clicking. No waiting for Google in Testing mode.

**What this does:** the website and the app already have a "Continue with Google" button, hidden until Google is switched on in Supabase. When you finish this guide, the button appears on the sign-in and sign-up pages, and people can make a Kwetuly account with their Google account in two clicks.

**What it does not touch:** existing accounts, email/password sign-in, the coming-soon page, or anything in the database.

**Price:** nothing in this guide needs a paid plan. If Google Cloud offers a free trial or asks for a card, you do not need it for this; close that offer.

**Golden rule:** the **Client secret** you get in Part 4 is a password. Never paste it into a chat with Claude or anyone else, never email it, never put it in a document or a file on your computer. It goes in one place only: the Google page in Supabase (Part 5).

**Before you start:** make sure two-step sign-in is on for kwetuly@gmail.com (Google Account → **Security** → **2-Step Verification**). This Google account will own the sign-in setup for all Kwetuly users.

Google changes the look of its console from time to time. If a button has a slightly different name, look for the nearest match; the order of the steps stays the same.

---

## Part 1: Create the Google Cloud project

1. Open a Chrome window where you are signed in as **kwetuly@gmail.com** only (a separate Chrome profile is easiest). Check the round picture at the top right: it must say kwetuly@gmail.com.
2. Open https://console.cloud.google.com
3. If Google asks you to agree to the Google Cloud terms, read them and accept them yourself.
4. At the top left, click the project picker (it may say **Select a project**), then **New project**.
5. **Project name:** `Kwetuly`
6. **Organization / Location:** leave it as **No organization**.
7. Click **Create**. Wait a few seconds, then make sure the project picker at the top now says **Kwetuly**. Every step below must happen inside this project.

## Part 2: Set up the sign-in screen (Google Auth Platform)

This is the screen people see when they click "Continue with Google". Google calls it the consent screen.

1. In the search box at the top, type `Google Auth Platform` and open it. (Or open https://console.cloud.google.com/auth/overview with the Kwetuly project selected.)
2. You will see "Google Auth Platform not configured yet". Click **Get started**. A short form with four steps opens.
3. **App information**
   - **App name:** `Kwetuly`
   - **User support email:** choose **kwetuly@gmail.com** from the list.
     - Why not support@kwetuly.com: Google only accepts your own Google account's address, or a Google Group you manage. support@kwetuly.com is an ImprovMX forwarding address, not a Google account, so Google will not list it. kwetuly@gmail.com is the right choice.
   - Click **Next**.
4. **Audience:** choose **External** (anyone with a Google account, not only a company's staff). Click **Next**.
5. **Contact information:** type `kwetuly@gmail.com`. Google sends notices about the project here. Click **Next**.
6. **Finish:** read Google's API Services User Data Policy and tick the box to agree yourself. Click **Continue**, then **Create**.

New projects start in **Testing** mode. That is what we want for now. You can see it under **Audience → Publishing status: Testing**. Do **not** click **Publish app** yet (see Part 7).

### 2a. Branding (name and links)

1. In the left menu, click **Branding**.
2. Check **App name** says Kwetuly and **User support email** says kwetuly@gmail.com.
3. **App logo:** leave it empty for now. Adding a logo means Google must check the brand before it is shown, and it is not needed in Testing mode.
4. **App domain:** leave **Application home page**, **privacy policy link** and **terms of service link** empty for now. Those pages must load for the public first (Part 7).
5. **Authorized domains:** click **Add domain** and type `kwetuly.com`.
   - If Google later complains about the Supabase address, also add `zsymxfommlxqqfywekuy.supabase.co`. Usually Google accepts the Supabase address in Part 4 without this.
6. **Developer contact information:** `kwetuly@gmail.com`
7. Click **Save**.

### 2b. Audience (test users)

1. In the left menu, click **Audience**.
2. Check: **User type: External**, **Publishing status: Testing**.
3. Under **Test users**, click **Add users** and add these three, one per line:
   - `kwetuly@gmail.com`
   - `kismatidigital@gmail.com`
   - `walterpaulomushi@gmail.com`
4. Click **Save**.

Good to know: Google's help says that when an app only asks for name, email and profile (which is all Kwetuly asks for), the test-user list is **not** enforced, so other Google users can still sign in even in Testing mode. Add the three anyway. What keeps strangers off the website before launch is the coming-soon page, not this list.

### 2c. Data access (what Kwetuly may see)

1. In the left menu, click **Data Access**.
2. Click **Add or remove scopes**.
3. Tick only these three (type in the filter box to find them):
   - `openid`
   - `.../auth/userinfo.email` (see your email address)
   - `.../auth/userinfo.profile` (see your name and picture)
4. Tick nothing else. Any other scope makes Google ask for a long review.
5. Click **Update**, then **Save**.

## Part 3: Copy the Supabase callback address

1. In a new tab, open https://supabase.com/dashboard and sign in.
2. Open the Kwetuly project (ID `zsymxfommlxqqfywekuy`).
3. Left menu: **Authentication** → **Sign In / Providers** (it may be called **Providers**).
4. Scroll to **Google** and click it. A panel opens. Do not switch it on yet.
5. Find **Callback URL (for OAuth)**. It should be exactly:

   `https://zsymxfommlxqqfywekuy.supabase.co/auth/v1/callback`

   If Supabase shows something different, use what Supabase shows and tell backend-engineer. Click its copy button.
6. Leave this tab open.

## Part 4: Create the Google sign-in key (OAuth client)

1. Back in Google Auth Platform, click **Clients** in the left menu, then **Create client**.
2. **Application type:** **Web application**.
3. **Name:** `Kwetuly web (Supabase)`. Only you see this name.
4. **Authorized JavaScript origins:** click **Add URI** and type `https://kwetuly.com` (no slash at the end).
5. **Authorized redirect URIs:** click **Add URI** and paste the Supabase callback address from Part 3:
   `https://zsymxfommlxqqfywekuy.supabase.co/auth/v1/callback`
   Check there is no space before or after it.
6. Click **Create**.
7. Google shows a box with **Client ID** and **Client secret**.
   - Google now shows the secret **only once**, in this box. Keep the box open and go straight to Part 5.
   - Do not click **Download JSON** unless you must; if you do, delete the file after Part 5.
   - If you lose the secret, open the client again, add a new secret, and delete the old one.

## Part 5: Switch on Google in Supabase

1. Go to the Supabase tab with the Google panel open (Part 3).
2. Turn on **Enable Sign in with Google**.
3. **Client IDs:** in the Google box, click the copy button next to **Client ID**, then paste it here. It ends with `.apps.googleusercontent.com`.
4. **Client Secret (for OAuth):** copy the **Client secret** from the Google box and paste it here.
5. Leave **Skip nonce checks** off. Leave **Allow users without an email** off.
6. Click **Save**.
7. Go back to Google and close the box with the secret.
8. Check the redirect list: Supabase → **Authentication** → **URL Configuration**. **Redirect URLs** should already include `https://kwetuly.com/**` and `kwetuly://**` (set up on 2026-10-25). If either is missing, add it and Save. Do not remove anything there.

## Part 6: Test it

**Website (team-preview Chrome, the one that already got past the coming-soon page):**

1. Open https://kwetuly.com/en/login or https://kwetuly.com/en/join
2. A **Continue with Google** button should appear above the email form.
   - The website asks Supabase which buttons to show and remembers the answer for a while (up to about an hour). If the button is not there after an hour, tell devops; a fresh deploy shows it straight away.
3. Click it, choose **walterpaulomushi@gmail.com** (or another test address), and agree.
4. Google's screen will say you are going to **zsymxfommlxqqfywekuy.supabase.co**. That is expected (see "Good to know").
5. You land on the **Welcome** step: pick the account type, type your name and phone number, save. You are signed in.

**App:** the app checks Supabase every time the sign-in screen opens, so the button appears there straight away. Tapping it opens a Google page in a secure browser window and comes back to the app.

Then tell backend-engineer "Google sign-in on" (no keys in the message). security-reviewer and qa-tester check it next (see the team board).

## Part 7: Later, before the public launch (needs your approval)

In Testing mode it works, but Google calls the app unpublished. Before launch:

1. **Public pages:** Kwetuly needs a homepage, a **privacy policy** page and a **terms** page that anyone can open, with no coming-soon page in front of them. Today kwetuly.com shows "Coming soon" to everyone except the team, and there is no /privacy or /terms page yet. Either launch the site, or ask devops to let those pages through the coming-soon gate once legal's texts are approved.
2. **Prove you own kwetuly.com:** Google asks that the homepage is on a domain you have verified with Google (Google Search Console; it gives you a TXT record to add in Vercel DNS).
3. In **Branding**, fill in the homepage, privacy policy and terms links (all on kwetuly.com). The privacy policy must say how Kwetuly uses the Google name and email.
4. Optional: add the logo (square, 120 × 120 px, under 1 MB). The logo and app name are shown only after Google checks the brand (**Verify branding**, usually minutes, sometimes days; then **Publish branding**).
5. **Audience** → **Publish app** → confirm. Status changes to **In production**.

Because Kwetuly only asks for name, email and profile, Google's extra review (videos, security audits, user caps) is for sensitive scopes and should not apply. Check the **Verification Center** page in Google Auth Platform at that time for what Google asks then; Google's rules change.

## Good to know

- **The supabase.co address on Google's screen.** Google's screen names the address it sends people back to, which is `zsymxfommlxqqfywekuy.supabase.co`, not kwetuly.com. It works, but looks less trustworthy. Supabase fixes this with a **custom domain** (for example `auth.kwetuly.com`), which is a paid add-on on paid Supabase plans. Check the current price at https://supabase.com/pricing before deciding; if you buy it, backend-engineer updates this guide and the Google redirect address.
- **Same email, two ways in.** If someone already has a Kwetuly email/password account and later uses "Continue with Google" with the same address, Supabase joins them into one account. Nothing is lost.
- **The app does not need extra Google clients.** The app uses the same web sign-in through a secure browser window, so no separate Android or iOS keys are needed.
- **Apple.** Before the iPhone app goes into the App Store with a Google button, Apple's rules need "Sign in with Apple" too. That comes after the D-U-N-S number and the Apple Developer account.
- **If you think the secret was seen by someone:** Google Auth Platform → **Clients** → Kwetuly web (Supabase) → add a new secret, paste it into Supabase (Part 5), then delete the old secret in Google.
