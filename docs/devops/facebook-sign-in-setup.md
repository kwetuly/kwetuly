# Turning on "Continue with Facebook" for Kwetuly

Written 2026-10-30 by backend-engineer for Walter, after his decision that day to add Facebook next to Google. About 30 minutes of clicking. No waiting for Meta in Development mode.

**What this does:** the website and the app already have a "Continue with Facebook" button, hidden until Facebook is switched on in Supabase. When you finish this guide, the button appears on the sign-in and sign-up pages, next to Google. In Development mode only people you add to the Meta app can use it; everyone else can use it once the app is Live (Part 7).

**What it does not touch:** existing accounts, Google sign-in, email/password sign-in, the coming-soon page, the WhatsApp alerts app in Meta, or anything in the database. No code change is needed (checked 2026-10-30, see "Good to know").

**Price:** nothing in this guide costs money. If Meta offers ads credit or asks for a card, you do not need it for this; close that offer.

**Golden rule:** the **App secret** you see in Part 4 is a password. Never paste it into a chat with Claude or anyone else, never email it, never put it in a document or a file on your computer. It goes in one place only: the Facebook page in Supabase (Part 5).

**Before you start:**
- Meta's developer site works through a **personal Facebook account**. Use the Facebook account you already used for the WhatsApp template work (the one that is a developer on Meta for Developers). Make sure two-factor authentication is on for it (Facebook → **Settings and privacy** → **Accounts Center** → **Password and security** → **Two-factor authentication**). This account will own the sign-in setup for all Kwetuly users.
- Decide the contact address: use **kwetuly@gmail.com**.

Meta changes the look of its developer dashboard often. If a button has a slightly different name, look for the nearest match; the order of the steps stays the same. Labels in this guide that Meta's own pages did not confirm are marked *(label not confirmed)*.

---

## Part 1: Create the Meta app

Make a **new** app for sign-in. Do not add Facebook Login to the WhatsApp app: Meta does not let every use case sit together in one app, use cases cannot be removed later, and keeping them apart means a problem with one never switches off the other.

1. Open a Chrome window where you are signed in to the Facebook account from "Before you start" (a separate Chrome profile is easiest).
2. Open https://developers.facebook.com/apps/creation/
   - If Meta asks you to register as a developer first, follow its steps yourself (it may ask to confirm a phone number or email). You probably did this already for WhatsApp.
3. **App details**
   - **App name:** `Kwetuly`. This name is shown to people on the Facebook sign-in screen. (Meta does not allow "Facebook", "FB" or "Meta" in the name.)
   - **App contact email:** `kwetuly@gmail.com`
   - Click **Next**.
4. **Use cases:** tick **Authenticate and request data from users with Facebook Login**. Tick nothing else. Click **Next**.
5. **Business:** choose **I don't want to connect a business portfolio yet**. Click **Next**.
   - Why: sign-in with name and email does not need a business portfolio. If the app is connected to one, you must manage who can test it in Business Manager instead of in the app, which is more clicking. It can be connected later if Meta ever asks.
6. **Requirements:** read what Meta lists and click **Next**.
7. **Overview:** check the name, email and use case, then click **Go to dashboard**. If Meta asks you to re-enter your Facebook password, do it yourself.

New apps start in **Development** mode. That is what we want for now. Do **not** switch to Live yet (see Part 7).

## Part 2: Ask only for name and email

1. In the left menu, click **Use cases**.
2. Click **Customize** on **Authenticate and request data from users with Facebook Login**.
3. Under **Permissions**, check the list:
   - `public_profile` is there already (Meta adds it to every app). It gives the name and profile picture.
   - Next to `email`, click **Add**. It should then say **Ready for testing**.
4. Add nothing else. Any other permission needs Meta's review and is not needed by Kwetuly.

## Part 3: Copy the Supabase callback address and give it to Meta

1. In a new tab, open https://supabase.com/dashboard and sign in.
2. Open the Kwetuly project (ID `zsymxfommlxqqfywekuy`).
3. Left menu: **Authentication** → **Sign In / Providers** (it may be called **Providers**).
4. Scroll to **Facebook** and click it. A panel opens. Do not switch it on yet.
5. Find **Callback URL (for OAuth)**. It should be exactly:

   `https://zsymxfommlxqqfywekuy.supabase.co/auth/v1/callback`

   If Supabase shows something different, use what Supabase shows and tell backend-engineer. Click its copy button. Leave this tab open.
6. Back in Meta, still in the Facebook Login use case, click **Settings** (under Facebook Login) *(label not confirmed; in some versions it is in the left menu under **Facebook Login** → **Settings**)*.
7. Check these switches:
   - **Client OAuth login:** Yes
   - **Web OAuth login:** Yes
   - **Enforce HTTPS:** Yes
   - **Use Strict Mode for redirect URIs:** Yes
   - **Login with the JavaScript SDK:** No *(the switch names in this step are not confirmed on Meta's current pages)*
8. **Valid OAuth Redirect URIs:** paste the Supabase callback address:
   `https://zsymxfommlxqqfywekuy.supabase.co/auth/v1/callback`
   Check there is no space before or after it. Add nothing else here.
9. Click **Save changes**.

## Part 4: Fill in the basic settings and find the App ID

1. In the left menu, click **App settings** → **Basic**.
2. **App domains:** type `kwetuly.com`.
3. **Contact email:** `kwetuly@gmail.com`
4. **Privacy Policy URL**, **Terms of Service URL**, **User data deletion**, **App icon**: leave them empty for now. Those pages must open for the public first (Part 7).
5. **Category:** choose **Travel and local** if it is offered *(category names not confirmed)*; otherwise the nearest match.
6. Click **Save changes** at the bottom.
7. At the top of this page you see **App ID** (a long number) and **App secret** (hidden dots with a **Show** button).
   - Do not click **Show** yet. You click it in Part 5, straight away paste it into Supabase, and then leave the page.
   - Meta asks for your Facebook password when you click **Show**. Type it yourself.
   - If you ever think the secret was seen, use **Reset** next to it (see "Good to know").

## Part 5: Switch on Facebook in Supabase

1. Go to the Supabase tab with the Facebook panel open (Part 3).
2. Turn on **Enable Sign in with Facebook** (it may say **Facebook enabled**).
3. **Facebook client ID:** copy the **App ID** from Meta's Basic settings page and paste it here.
4. **Facebook secret:** in Meta, click **Show** next to **App secret**, copy it, and paste it here.
5. Leave **Allow users without an email** off. (A few Facebook accounts were made with a phone number and have no email; those people use email sign-up instead. Kwetuly needs an email for bookings.)
6. Click **Save**.
7. Go back to Meta and leave the Basic settings page (click another menu item) so the secret is hidden again.
8. Check the redirect list: Supabase → **Authentication** → **URL Configuration**. **Redirect URLs** should already include `https://kwetuly.com/**` and `kwetuly://**` (set up on 2026-10-25). If either is missing, add it and Save. Do not remove anything there.

## Part 6: Add the testers and test it

In Development mode, Meta only lets people with a role on the app sign in. Everyone else gets a Meta error page. That is expected until Part 7.

### 6a. Add the testers

1. In Meta, left menu: **App roles** → **Roles**.
2. You are already **Administrator**.
3. Click **Add People** *(label not confirmed)*, choose **Testers**, and type the Facebook name or profile of each person who should test (for example your second Facebook account, if you have one, and the team testers). Meta finds people by their Facebook account, not by email.
4. Each person must accept the invitation themselves: on https://developers.facebook.com/requests (or in a notification), click **Confirm**. Until they accept, sign-in fails for them.

### 6b. Test plan

**Website (team-preview Chrome, the one that already got past the coming-soon page):**

1. Open https://kwetuly.com/en/login or https://kwetuly.com/en/join
2. A **Continue with Facebook** button should appear with Google's.
   - The website asks Supabase which buttons to show and remembers the answer for a while (up to about an hour). If the button is not there after an hour, tell devops; a fresh deploy shows it straight away.
3. **New account (tester).** Click it, sign in to Facebook as a tester, and click **Continue as ...**. Facebook's screen says Kwetuly will get your **name, profile picture and email**. Nothing else must be listed; if it is, stop and tell backend-engineer.
4. You land on the **Welcome** step: pick the account type, check the name, type your phone number, save. You are signed in.
5. **Same email as an existing account.** Sign out. Use a tester whose Facebook email is the same as an existing, confirmed Kwetuly email account. After Facebook, you should land in that same account (same trips, same messages), not a new empty one.
6. **Cancel.** Click **Continue with Facebook**, then **Cancel** on Facebook's screen. You come back to the sign-in page with a short error message, not a blank page.
7. **Not a tester.** In a private window, try with a Facebook account that is not on the Roles list. Meta should refuse it while the app is in Development mode. This proves the switch is still off for the public.

**App (Android):** the app checks Supabase every time the sign-in screen opens, so the button appears there straight away. Tapping it opens a Facebook page in a secure browser window and comes back to the app. Repeat steps 3, 4 and 6.

**App (iPhone):** the iPhone app shows no Google or Facebook button at all until Sign in with Apple is switched on too (Apple's rule). Seeing no Facebook button on iPhone is correct for now.

Then tell backend-engineer "Facebook sign-in on" (no keys in the message). security-reviewer and qa-tester check it next (see the team board). qa-tester can also test it on localhost if `http://localhost:3000/**` is in the Supabase redirect list; ask backend-engineer before adding it.

## Part 7: Later, before the public launch (needs your approval)

In Development mode it works only for people on the Roles list. Before launch:

1. **Public pages:** Kwetuly needs a **privacy policy** page and a page that tells people **how to delete their data**, both open to anyone with no coming-soon page in front of them. Today kwetuly.com shows "Coming soon" to everyone except the team, and there is no /privacy or /terms page yet. Either launch the site, or ask devops to let those pages through the coming-soon gate once legal's texts are approved. Meta's crawler must be able to open the privacy page; a broken or blocked link counts against the app.
   - The privacy policy must say what Kwetuly gets from Facebook (name, picture, email), what it is used for, and how to ask for deletion. The draft in `docs/legal/privacy-policy.md` already mentions Facebook; legal and the advocate finish it.
   - For data deletion Meta accepts either an **instructions page** (a URL that explains how to ask Kwetuly to delete the account, for example by email to support) or a **callback** (code that Meta calls). The instructions page is enough to start and needs no code. A callback would be a later backend task.
2. In **App settings** → **Basic**, fill in:
   - **Privacy Policy URL** (on kwetuly.com)
   - **Terms of Service URL** (on kwetuly.com)
   - **User data deletion:** choose **Data deletion instructions URL** and paste the page address
   - **App icon:** the Kwetuly logo, square, 1024 × 1024 px *(size from Meta's dashboard hint at the time of writing, not confirmed on Meta's pages)*
   - **Category** (Part 4)
   - Click **Save changes**.
3. **Use cases** → Facebook Login → **Customize**: if Meta shows **Increase access** next to `public_profile` or `email`, follow it. Meta's Facebook Login overview says apps may ask for `email` and `public_profile` "without submitting for review", so a full App Review should not be needed.
4. **Business verification:** Meta's pages tie business verification to permissions with Advanced Access and to some products, not to plain name-and-email sign-in. Kwetuly is not registered as a company yet, so it cannot verify anyway. **Not confirmed:** whether Meta will ask for it when you publish. If the publish step asks for it, stop and tell chief-of-staff; it then waits for the company registration.
5. **Publish** (in the left menu, or the **App mode** switch at the top: Development → Live). Meta checks everything above first and lists anything missing.

Check the **Requirements** / **Publish** page in the Meta dashboard at that time for what Meta asks then; Meta's rules change.

## Good to know

- **The supabase.co address.** Facebook sends people back to `zsymxfommlxqqfywekuy.supabase.co`, which a careful person may notice in the address bar. Supabase fixes this with a **custom domain** (for example `auth.kwetuly.com`), a paid add-on. Check https://supabase.com/pricing before deciding; if you buy it, backend-engineer updates this guide, the Google guide and both redirect addresses.
- **Same email, two ways in.** If someone already has a Kwetuly account with a confirmed email and later uses "Continue with Facebook" with the same address, Supabase joins them into one account. Nothing is lost. Supabase only does this when the email is verified on both sides; if the earlier email account was never confirmed, Supabase may drop that unconfirmed login and keep the Facebook one *(Supabase's docs say it removes "unconfirmed identities"; the exact result for an unconfirmed password account was not tested)*. The same applies between Google and Facebook: one email, one Kwetuly account.
- **No email on Facebook.** Facebook accounts made with only a phone number send no email. With **Allow users without an email** off (Part 5), these people get an error and should use email sign-up. qa-tester checks the message is understandable.
- **What Kwetuly receives.** Supabase asks Facebook only for `email` (plus `public_profile`, which every app gets) and reads the name, email and profile picture. The name fills the Welcome step; the phone number is always typed by the person, never taken from Facebook.
- **The app does not need a separate Facebook setup.** The app uses the same web sign-in through a secure browser window, so no Android key hashes or iOS bundle settings are needed in Meta.
- **Apple.** Before the iPhone app goes into the App Store with Google or Facebook buttons, Apple's rules need "Sign in with Apple" too. That comes after the D-U-N-S number and the Apple Developer account.
- **Code check, 2026-10-30.** `apps/web/src/lib/auth-providers.ts` and `apps/mobile/src/lib/social.ts` already list `facebook` and show the button when Supabase reports it on; the web button (`apps/web/src/components/social-sign-in.tsx`) has the Facebook mark; the sign-in action, the `/auth/confirm` page and the database's name handling already cover Facebook. No code change is needed.
- **If you think the secret was seen by someone:** Meta → **App settings** → **Basic** → **App secret** → **Reset**, then paste the new secret into Supabase (Part 5) straight away. Facebook sign-in fails for the minutes in between.

## Sources (checked 2026-10-30)

- Supabase, Login with Facebook: https://supabase.com/docs/guides/auth/social-login/auth-facebook
- Supabase, Identity linking: https://supabase.com/docs/guides/auth/auth-identity-linking
- Supabase Auth source, Facebook provider (default scope `email`; reads name, email, picture): https://github.com/supabase/auth/blob/master/internal/api/provider/facebook.go
- Meta, Create an app: https://developers.facebook.com/documentation/development/create-an-app
- Meta, Facebook Login use case (email and public_profile, Ready for testing, Increase access): https://developers.facebook.com/docs/development/create-an-app/facebook-login-use-case
- Meta, Facebook Login overview (email and public_profile without review; data deletion): https://developers.facebook.com/docs/facebook-login/overview
- Meta, App modes (Development: role users only; Live): https://developers.facebook.com/docs/development/build-and-test/app-modes
- Meta, App roles (testers, business portfolio roles): https://developers.facebook.com/docs/development/build-and-test/app-roles
- Meta, Data deletion callback / instructions URL: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
- Meta, Privacy policy expectations: https://developers.facebook.com/documentation/development/terms-and-policies/privacy-policy
