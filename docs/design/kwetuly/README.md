# Kwetuly logo and icons (draft, 2026-10-24)

Draft for Walter to approve. Nothing in `apps/` has been replaced. Figma was not used.

Kwetuly (say "kweh-TOO-lee") comes from Kiswahili "kwetu", "our place, our home". The name is meant for all of Africa, starting in Tanzania.

## What I made

- **Wordmark:** "kwetuly" in lowercase Plus Jakarta Sans ExtraBold, the same font as the website. The gold sun rises out of the cup of the "u". The "u" is the last letter of "kwetu", so the sun sits at home. It also carries on the Rafrika idea of one gold sun in the word. The letters are converted to outlines, so the files look the same everywhere with no font needed.
- **Icon:** a white lowercase "k" on brand green, with the gold sun resting on the arm of the "k". It follows today's "r and sun" icon, but the whole mark is now centred, so it also works in circle crops. That fixes the off-centre point in `docs/design/logo-check-2026-10.md`.
- **Colours:** green `#1D951A`, gold `#ffb627`, white, and grey `#7F7F7F` behind the email header only. No other colours.
- **Corners:** the rounded icon uses 5px corners at 64px (80 at 1024) and scales them with the size. The app icon is square because iOS and Android round it themselves.
- **No caps, no arrows.** The word "Kwetuly" with a capital K is only used as the accessible name (`aria-label` and `<title>`), and stays that way in body text.

Both suns are decoration. Gold on green is about 2.2:1 and gold on white is about 1.8:1, so the name must never depend on the sun to be read. Green on white is about 3.9:1, which is fine for a big bold logo but not for small text.

## Master SVGs (this folder)

| File | Use |
| --- | --- |
| `kwetuly-wordmark-green.svg` | Wordmark on light backgrounds (header) |
| `kwetuly-wordmark-white.svg` | Wordmark on green or grey (footer, menu, email) |
| `kwetuly-icon.svg` | App icon, 1024, square, full bleed |
| `kwetuly-icon-rounded.svg` | Browser tab and other places that show a square tile |
| `kwetuly-mark-white.svg` | "k" and sun with no background (splash, Android foreground) |
| `kwetuly-mark-green.svg` | "k" and sun in green, for light backgrounds |
| `kwetuly-mark-mono-white.svg` | All white (Android monochrome, notifications) |

## PNG exports (`png/`) and where they would go

These are drawn from the same shapes with sharp. Each file name says its target. Copy them over only after Walter approves.

### App (`apps/mobile/assets/images/`)

| Draft file | Target | Size |
| --- | --- | --- |
| `png/mobile-icon.png` | `apps/mobile/assets/images/icon.png` | 1024 |
| `png/mobile-android-icon-foreground.png` | `apps/mobile/assets/images/android-icon-foreground.png` | 1024, mark inside the safe circle |
| `png/mobile-android-icon-background.png` | `apps/mobile/assets/images/android-icon-background.png` | 1024, solid green |
| `png/mobile-android-icon-monochrome.png` | `apps/mobile/assets/images/android-icon-monochrome.png` | 1024, white |
| `png/mobile-splash-icon.png` | `apps/mobile/assets/images/splash-icon.png` | 512, on green `#1d951a` |
| `png/mobile-favicon.png` | `apps/mobile/assets/images/favicon.png` | 48 |
| `png/mobile-notification-icon.png` | `apps/mobile/assets/images/notification-icon.png` (new) | 96, white on transparent. It also needs `"icon": "./assets/images/notification-icon.png"` under `expo-notifications` in `apps/mobile/app.json` |

### Website (`apps/web`)

| Draft file | Target | Notes |
| --- | --- | --- |
| `png/web-favicon.ico` | `apps/web/src/app/favicon.ico` (new) | 16, 32 and 48 in one file |
| `png/web-icon-48.png` | `apps/web/src/app/icon.png` | Replaces `icon.tsx` and its thin "r". Delete `icon.tsx` at the same time, because Next.js can't have both |
| `png/web-apple-icon.png` | `apps/web/src/app/apple-icon.png` | 180, square. Replaces `apple-icon.tsx` |
| `png/web-icon-96.png`, `png/web-icon-192.png` | `apps/web/public/icons/icon-96.png`, `icon-192.png` (new) | 48, 96 and 192 cover Google's favicon rule (multiples of 48) |
| `png/web-icon-512.png` | `apps/web/public/icons/icon-512.png` (new) | For a new `apps/web/src/app/manifest.ts` with the 192 and 512 icons |
| `png/web-icon-16.png`, `png/web-icon-32.png` | Already inside the `.ico`. Keep as spares | |
| `kwetuly-wordmark-green.svg`, `kwetuly-wordmark-white.svg` | `apps/web/public/brand/` (new) | Header and footer. Or keep `apps/web/src/components/logo.tsx` as live text and move its sun from the "i" to the "u" |
| `png/og-image-1200x630.png` | `apps/web/src/app/[lang]/opengraph-image.png` plus `opengraph-image.alt.txt` ("Kwetuly") | Replaces the Unsplash share photo. White wordmark on green, with no slogan until one is approved |

### Email and social

| Draft file | Target | Notes |
| --- | --- | --- |
| `png/email-header-280x64.png` | `apps/web/public/email/kwetuly-email-header.png` (new), linked from `supabase/functions/notify/index.ts` | Show it at 140x32. White on grey `#7F7F7F` (about 4.0:1, fine for a logo). The button colour, corner and text-colour fixes from the logo check still apply |
| `png/social-avatar-1080.png` | Upload by hand to TikTok, Instagram and others, with Walter's approval | Mark centred and safe inside the circle |

Still missing: Google Play feature graphic (1024x500) and store screenshots. These can wait until store submission.

## Decisions for Walter

1. Approve the wordmark: lowercase "kwetuly" with the sun rising from the "u".
2. Approve the icon: white "k" with the gold sun on its arm.
3. Approve copying the files to the targets above. That work goes to `frontend-engineer` for web and app, and `backend-engineer` for email, with `qa-tester` checking. It should happen together with the code-wide rename, not before.
4. If there is a Figma file for the brand, send the link. Nothing was opened or edited there.
