# Logo and brand marks check (2026-10-24)

> **Replaced (2026-10-24):** the brand is now Kwetuly. This check of the old Rafrika marks is kept for history; the current marks and rules are in `docs/design/kwetuly/README.md`.

Walter approved keeping the name "Rafrika" on 2026-10-24. This is a check of the logo files we have today against the brand rules: green `#1D951A`, gold `#ffb627`, grey `#7F7F7F`, 5px corners, no all caps. No files were changed. Figma was not used.

## The mark today

There are two marks:

- **Icon:** a white lowercase "r" with a gold sun at the top right, on brand green. Used for the browser tab, the Apple home screen, the app icon and the splash screen.
- **Wordmark:** "rafrika" in lowercase, extra-bold Plus Jakarta Sans, with the dot of the i drawn as a gold sun. It is green on light backgrounds and white on the grey footer and menu.

Both use only brand colours. The pixels match exactly: `#1d951a` green, `#ffb627` gold, `#ffffff` white. Neither uses all caps.

## What exists and where

### Website (`apps/web`)

| What | File | Notes |
| --- | --- | --- |
| Browser tab icon, 64x64 PNG | `apps/web/src/app/icon.tsx` | Drawn in code from `apps/web/src/lib/brand-icon.tsx`, with rounded corners (22%) |
| Apple home-screen icon, 180x180 PNG | `apps/web/src/app/apple-icon.tsx` | Same drawing with square corners, because iOS rounds them |
| Wordmark | `apps/web/src/components/logo.tsx` | Used in the header (`apps/web/src/app/[lang]/layout.tsx`), the footer and the phone menu (`apps/web/src/components/site-nav.tsx`) |
| Share preview (Open Graph) | `apps/web/src/app/[lang]/layout.tsx` | An Unsplash photo of a safari car (Hu Chen), loaded from Unsplash. It has no logo or name on it |
| `favicon.ico`, web manifest, 192/512 icons | none | |
| `apps/web/public/*.svg` (next, vercel, file, globe, window) | Leftovers from the Next.js starter | Not Rafrika marks |

### App (`apps/mobile`)

| What | File | Notes |
| --- | --- | --- |
| App icon, 1024x1024 | `apps/mobile/assets/images/icon.png` | Used for iOS and as the general icon. Looks right |
| Android adaptive icon | `apps/mobile/assets/images/android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png` | Background is solid green, the foreground is the r and the sun, and the monochrome version is white. All of it sits inside Android's safe circle |
| Splash screen | `apps/mobile/assets/images/splash-icon.png` on `#1d951a` (`apps/mobile/app.json`) | Looks right |
| Web favicon for the app, 48x48 | `apps/mobile/assets/images/favicon.png` | Looks right |
| Wordmark on the welcome screen | `apps/mobile/src/app/intro.tsx` (around line 109) | Typed text "Rafrika" with a capital R in the system font, with a gold dot placed after the word. It does not match the website wordmark |
| Leftovers from the Expo starter | `apps/mobile/assets/expo.icon/` (a blue Expo Liquid Glass icon), `expo-logo.png`, `expo-badge*.png`, `react-logo*.png`, `logo-glow.png`, `tutorial-web.png`, `tabIcons/` | Nothing in `src` or `app.json` uses them. They should be removed before store builds so nobody picks up the Expo icon by mistake |

### Email (`supabase/functions/notify/index.ts`, around lines 147 to 156)

- The header is plain bold text "Rafrika" on grey `#7f7f7f`. There is no logo.
- **Off brand:** the button is the old orange `#ff6a2b`, not green. The card corners are 16px and the button corners are 15px, not 5px. The text colour is `#16211c`, not charcoal `#2b3631`.

## Do web and app match?

- **Colours and layout of the icon:** yes. The sun's size and position are the same on web and app.
- **The "r" in the icon:** no. The app icon has a heavy, extra-bold "r". The website icon is drawn with `next/og`, which only includes Geist Regular. That means the `fontWeight: 800` request has no effect, so the browser tab and Apple home-screen icons show a thin "r". I checked this by drawing the web icon with the same code. Users will see two slightly different logos.
- **Wordmark:** no. The website shows lowercase "rafrika" with the sun as the dot of the i. The app shows "Rafrika" with a capital R in the system font and a separate gold dot after the word. Email shows plain "Rafrika" with no sun.
- **Master file:** there is none. The logo only exists as code and as PNG exports, with no SVG or vector source. Every new asset would have to be rebuilt by hand, and that is how the differences above crept in.

## Does it work small?

I checked by shrinking `icon.png` to each size.

- **16 and 32px browser tab:** works. The "r" and the sun are still clear. At 16px the thin web "r" is weaker than the app's heavy "r".
- **110px circle (social profile picture):** works. The sun stays well inside the circle, about 70px from the edge at full size. The r and the sun sit a little high and to the right of centre (about 8 to 9%). That is fine in a square but slightly noticeable in a circle.
- **App icon (iOS mask, Android circle and squircle masks):** works. Everything is inside the safe areas.
- **Contrast:** green on white is about 3.9:1, which is fine for a large bold logo but would not be enough for small body text. The gold sun on green is about 2.2:1. It reads as a shape and is decoration only.
- **Google search favicon:** Google wants a square favicon whose size is a multiple of 48px (48, 96, 192 and so on). Ours are 64 and 180, so Google may not show our icon in results.
- **Android notification icon:** missing. `expo-notifications` in `app.json` has a colour but no small white `icon`, so Android may show a plain square in the status bar.

## Missing for launch

1. A master logo file in SVG (icon and wordmark, in a green version and a white version).
2. A square social profile picture, 1080x1080, safe inside a circle.
3. An Open Graph share image, 1200x630, with the wordmark. The current one is a 1200-wide Unsplash crop of uneven height, served from Unsplash, with no Rafrika name. It also has no alt text.
4. An email header logo: a PNG at least 2x (for example 280x64 shown at 140x32), white on grey. Mail apps do not show web fonts reliably, so it has to be an image.
5. Favicon at 48, 96 and 192px, plus a `favicon.ico` and a small web manifest with 192 and 512 icons.
6. A white Android notification icon, 96x96, transparent background.
7. Store artwork for later: Google Play feature graphic (1024x500) and store screenshots. This is not urgent until store submission.

## Recommended assets for Walter to approve

Everything below keeps today's design (green, white r, gold sun, lowercase wordmark). Nothing is a redesign.

1. **Make one master** (`docs/design/brand/` or `packages/shared/brand/`): `rafrika-icon.svg`, `rafrika-wordmark-green.svg` and `rafrika-wordmark-white.svg`, using the heavy Plus Jakarta Sans "r" from the app icon as the standard.
2. **Fix the thin web "r":** load Plus Jakarta Sans ExtraBold into `brand-icon.tsx`, or use the master SVG instead. Also centre the r and the sun a little better for circle crops. This is a small code change for `frontend-engineer`.
3. **Social profile picture:** 1080x1080 PNG, green background, r and sun centred.
4. **Share image:** 1200x630, either the wordmark on green or the wordmark over one of our own consented photos (for example `kibo-from-shira.jpg`, if its source is confirmed), served from our own site, with alt text.
5. **Email:** a logo image in the header, a green button, 5px corners and charcoal text in `notify/index.ts`. This touches a server function, so `backend-engineer` does it and `qa-tester` checks it.
6. **App welcome screen:** use the same wordmark as the website (lowercase, sun as the dot of the i) instead of "Rafrika" plus a separate dot.
7. **Small icons:** favicon at 48/96/192, `favicon.ico`, web manifest, and the Android notification icon.
8. **Clean up:** remove the Expo and Next.js starter images listed above.

Decisions for Walter:
- Wordmark: confirm lowercase "rafrika" with the sun as the dot of the i as the one official wordmark everywhere. Body text keeps "Rafrika".
- Approve the asset list above, and which photo (if any) goes on the share image.
- Figma: if there is a Figma file for the logo, send the link. Nothing was opened or edited there.
