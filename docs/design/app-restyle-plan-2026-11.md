# App restyle plan: clean, premium, minimal (2026-11)

Owner: designer. Status: **proposal, waiting for Walter**. Nothing in the code has changed yet.
Scope: `apps/mobile` only. The website follows later with the same rules.
Fixed: brand colours, 5px corners everywhere, light mode, no all caps, no arrows on buttons, all features, flows and texts.

---

## 1. Audit: what is wrong today

| # | Finding | Where | Effect |
| --- | --- | --- | --- |
| A1 | Several filled buttons compete on one screen. The `dark` (grey) variant is used as a second filled button. | `guide/[slug]` (grey "Book a call" plus green bottom bar), `group-trip/[id]` (green Join plus grey Open chat), `account/index` (5 filled buttons), `request/[id]` (5), `hub/index` (3) | No single main action |
| A2 | **Contrast fails:** white text on grey `#7F7F7F` is **4.0:1**. White text on leaf `#1D951A` is **3.9:1**. Both need 4.5:1 for normal-size text. | `Button variant="dark"`, active `Chip`, `Badge tone="night"`, Explore hero button and intro buttons (leaf), chat/assistant send buttons (leaf), tab bar tint (leaf on white for small labels) | Hard to read. Accessibility fail. |
| A3 | Hand-made buttons skip `Button`, so they have no pressed, disabled or loading styling | Explore hero, AI concierge tile, intro (2), chat, conversation and assistant send | Buttons don't match each other |
| A4 | The AI concierge tile is a **gold-filled** button, which breaks the rule that gold is for highlights only | `(explore)/index.tsx` (hidden behind a flag) | Breaks a brand rule |
| A5 | Explore shows "no group trips" while trips are still loading and when loading fails | `(explore)/index.tsx` group trips block | Wrong empty state, no error state |
| A6 | Loading is a bare spinner. Empty is one grey line with no next step. | `ScreenState` in `ui.tsx` | Looks unfinished |
| A7 | Text characters used as icons: `✓` (24), `✦` (9), `✕` (3) | badges, cards, `FormMessage`, guide filter "clear" | Mixed icon language |
| A8 | "A · B · C" joins are banned but appear about 54 times (`' · '`), 12 of them via `join(' · ')` | cards, guide header, group trip, tour facts | Breaks a brand rule, hard to scan |
| A9 | Icon squares come in 34, 36, 44 and 48. Glyph sizes are 14, 16, 20, 22 and 26. | tour, guide-checks, explore, intro | Inconsistent |
| A10 | Weight 800 is used 83 times, so every title shouts at the same level | all screens | Flat hierarchy |
| A11 | Sections are 24 apart and every section title is 20/800, so blocks run together | Explore, guide profile | Crowded |
| A12 | Inputs have no visible label and use the page colour with no border, so they disappear on the page background | `group-trip/[id]` join form (3 inputs, the message field has no a11y label), trips search | Accessibility fail, unclear |
| A13 | The `Button` outline is 2px, which reads as heavy next to 1px card borders | `ui.tsx` | Heavy |
| A14 | Disabled buttons use 50% opacity, so white text on faded green becomes unreadable | `Button` | Contrast fail |
| A15 | Plus Jakarta Sans is not loaded in the app (system font only), but the website uses it | `app.json` has `expo-font`, no font files | App and website don't look like the same brand |
| A16 | Account is a long stack of full-width buttons (about 15) | `account/index.tsx` | Clutter. It should be a settings-style list. |
| A17 | The iOS tab bar hides when scrolling down (`minimizeBehavior="onScrollDown"`) | `(tabs)/_layout.tsx` | Navigation is less obvious |
| A18 | Already good: 5 labelled native tabs, `BottomBar` for the thumb zone (guide, tour), cards with 1px borders, no shadows, one spacing scale | | Keep all of these |

---

## 2. Token changes (`apps/mobile/src/theme`)

All of these add to the current tokens. No brand colour changes and no new hex values. Only aliases are added.

### colors.ts
```ts
colors = { ...existing,
  border: '#e7e5e0',        // = separator, for card and input borders
  pressed: '#f7f6f3',       // = background, row/card pressed fill
  disabledFill: '#eeece7',  // = fill
  disabledLabel: '#5f6b66', // = secondaryLabel (5.1:1 on fill)
}
brand = { ...existing,
  primary: '#187a16',       // = forest, every filled action (white text 5.5:1)
  link: '#187a16',          // = leafDark, text links and text buttons
}
```
Surfaces: page `#f7f6f3` (off-white, same as the website), cards and inputs `#ffffff`, soft fill `#eeece7`, soft highlight mint `#e5f5e3`. Leaf `#1d951a` stays for icon squares, the progress bar and the tab indicator, and is **never used under small white text**.

### spacing.ts (scale unchanged, add semantic names)
```ts
export const layout = {
  screenX: 16,      // space.lg, screen edges
  sectionGap: 32,   // space.xxl, between sections (was 24)
  cardPadding: 16,  // space.lg, keep at 16: PhotoHeader uses -16 margins
  cardGap: 12,      // space.md, inside cards
  listGap: 12,      // between cards in lists (trips uses 14 today)
  inlineGap: 8,     // chips, badges, meta items
  titleGap: 12,     // section title to content
} as const;
```

### typography.ts (sizes unchanged, add line heights and calmer weights)
| Token | Size/line | Weight | Use |
| --- | --- | --- | --- |
| `display` | 38/44 | 800 | big numbers only |
| `title1` | 28/34 | 800 | hero title, price on detail |
| `title2` | 22/28 | 700 | detail page name/title (was 800) |
| `section` (new) | 20/26 | 700 | section titles (`SectionTitle`, was 800) |
| `cardTitle` (new) | 17/22 | 700 | card titles (was 800) |
| `body` | 16/24 | 400 | text |
| `callout` | 15/22 | 400 | long text |
| `label` | 14/20 | 600 | field labels, chips |
| `meta` (new) | 13/18 | 400, secondaryLabel | dates, places |
| `caption` | 12/16 | 400/600 | notes, badges |
| `price` (new) | 22/28 | 800, primary, tabular-nums | prices in cards |
| `link` (new) | 15/22 | 600, brand.link | text links |

Rule: use 800 only for `display`, `title1` and `price`. Everything else uses 700 or less.

### radius.ts
Unchanged (5 everywhere). Remove the one hard-coded `borderRadius: 5` in `contact/[guideId].tsx`.

### New: elevation.ts
```ts
export const elevation = {
  none: {},
  float: { boxShadow: '0 2px 8px rgba(43, 54, 49, 0.08)' }, // only for floating things: success toast, sticky search
} as const;
```
Default separation stays a 1px `colors.border`. Cards get no shadows.

### New: icons in theme
```ts
export const icon = { inline: 16, square: 20, action: 22 } as const;   // glyph sizes
export const iconBox = { sm: 32, md: 40, lg: 44 } as const;            // leaf squares, white glyph
```
Pairs: 32 box with a 18 to 20 glyph, 40 box with a 20 glyph, 44 box with a 22 glyph. Use SF weight `medium` on iOS (check the `SymbolView` `weight` prop in the SDK 58 docs).

---

## 3. Component changes (`ui.tsx`), all backwards compatible

**Button**: variants `primary | outline | text | danger` plus sizes `lg | md`.
| | primary | outline | text | danger (text) |
| --- | --- | --- | --- | --- |
| Background | `brand.primary` | `colors.card` | none | none |
| Border | none | 1px `brand.primary` (was 2px) | none | none |
| Text | white 16/700 | primary 16/700 | link 16/600 | `brand.danger` 16/600 |
| Height | lg 52, md 44 (minHeight) | same | 44 | 44 |
| Disabled | `disabledFill` bg with `disabledLabel` text (no opacity) | border `border`, text `disabledLabel` | text `disabledLabel` | same |
| Pressed | scale 0.98 plus opacity 0.9 | bg `pressed` | opacity 0.6 | opacity 0.6 |
- Keep `variant="dark"` as a **deprecated alias that renders `outline`**. This fixes A1 and A2 in all 6 places at once.
- Add `maxFontSizeMultiplier={1.4}` and `numberOfLines={2}` so long German or Polish labels wrap and are never cut off.
- Add an `icon?: GlyphName` option (leading, 20) for share and call buttons.

**IconButton** (new): 44x44 hit area, 5px corners, glyph 22, required `accessibilityLabel`. Tones: `plain` (link-colour glyph), `tonal` (mint bg, forest glyph), `primary` (forest bg, white glyph, for send buttons in chat, conversation and assistant).

**Card**: same as now (white, 1px border, 5px, 16 padding, 12 gap). Add `onPress` so the card highlights in `pressed` when tapped, and `tone="plain"` (no bg or border) for page sections.

**Chip**: visual height 36 plus `hitSlop` 4 top and bottom, which gives 44. Padding 12. Text 14/600 (was 13).
- Inactive: white, 1px `border`, label colour.
- **Active: mint bg, 1px `brand.primary` border, primary text, leading checkmark glyph 14.** It no longer uses grey with white text (A2), and the check is a second cue besides colour.

**Badge**: add `icon?: GlyphName` (12, before the label) to replace the `✓`/`✦` characters. Replace tone `night` with `neutral` (`colors.fill` bg, label text, 11:1). Other tones stay the same.

**Field**: white bg, 1px `border`, minHeight 48, label above (14/600). The border turns `brand.primary` on focus. With an error, the border turns `brand.danger` and the message shows below. Move the inline inputs in `group-trip/[id]`, trips search and chats to `Field` (or a `SearchField` with a magnifier glyph and a clear `IconButton`).

**New layout pieces**
- `Section({ title, action?: { label, onPress } })`: title row (`section` type) with an optional text button on the right, then content 12 below. Parents space sections 32 apart.
- `ListRow({ icon?, title, subtitle?, onPress, accessory? })`: minHeight 56, 16 padding, 32 leaf icon square, rows split by 1px lines inside one Card. This is for Account, Hub and the concierge entry.
- `DetailRow({ label, value })`: label in `meta`, value in `body`, stacked (not side by side, so long languages fit).
- `StatRow({ items: { value, label }[] })`: 2 or 3 equal cells with the value at 20/700 and the label in `meta`. Cells wrap below 340pt width.
- `EmptyState({ glyph, text, action? })`: 44 leaf square with a white glyph, text in `callout` secondary, optional outline button. Text uses the **existing** strings.
- `ErrorState`: the current error copy plus an outline "Try again".
- `Skeleton({ height, width })`: `colors.fill` block, 5px, pulse (section 5).
- `ScreenState` stays as the wrapper but renders `Skeleton`/`EmptyState`/`ErrorState`, so every screen improves without edits.
- `FormMessage`: replace the `✓ ` character with a checkmark glyph. On success, run `SuccessCheck` (section 5).

**Tab bar** (`(tabs)/_layout.tsx`, after the SDK 58 QA lands): `tintColor={brand.leafDark}` for 5.5:1 labels. Keep the mint indicator and the 5 tabs, labels and icons as they are. Whether to keep minimize-on-scroll is a question for Walter.

---

## 4. Sample screens (before and after)

### S1. Explore home: `src/app/(tabs)/(explore)/index.tsx`
**Main action:** "Find a guide" (`t.home.search`) in the hero.

| Order | Before | After |
| --- | --- | --- |
| Title | Large native "Kwetuly" | Same |
| 1 Hero | 260 photo, scrim 0.95 to 0.1, gold eyebrow, title 28/800, hand-made **leaf** button (3.9:1) | Photo 260, lighter scrim `linear-gradient(to top, rgba(58,58,58,0.85) 0%, rgba(58,58,58,0) 70%)`, gold eyebrow 15/700, title `title1`, **`<Button size="lg">`** (forest) that calls `router.push('/guides')`. **This is the only filled button on the screen.** |
| 2 Concierge (flag) | Gold-filled tile with `✦` | `ListRow` in a Card: 32 leaf square with a `sparkles`/`auto_awesome` glyph and the title `t.concierge.open`. No gold fill. |
| 3 What to do | Wrapped cloud of specialty chips plus a separate "Special trips" section with a second chip row | **One** `Section` titled `t.home.specialtyLabel`: row 1 is a horizontal chip scroll of specialties. Then a small `label` heading `t.guides.expertise` and row 2 with a horizontal chip scroll (women guides plus expertise). Rows scroll edge to edge with 16 inset. |
| 4 Group trips | Title plus "more" link. Shows `t.groups.none` while loading or on error (A5). | `Section` with `action={{ label: t.explore.more }}` (text button, 44 hit area). Loading: 1 skeleton card (160 photo block plus 2 lines). Error: `ErrorState` with retry. Empty: `EmptyState` (glyph `calendar`, `t.groups.none`). Data: up to 3 `GroupTripCard`, 12 apart. |
| 5 Everything | Tiles at 47% with `flexGrow`, so the odd last tile stretches. 44 square, glyph 22, min height 128. | 2-column grid with fixed width `(window − 32 − 12) / 2` and no `flexGrow`. 40 square with glyph 20, title `cardTitle` (16/700, up to 2 lines), tagline `caption` (2 lines), min height 120, tap highlight. |
| 6 Why Kwetuly | Same as now, hook 17/800 forest | Hook `cardTitle` in primary 700. The list card stays. |
| Spacing | gap 24 | `layout.sectionGap` 32, bottom padding 40 |

### S2. Guide profile: `src/app/guide/[slug].tsx`
**Main action:** "Ask {name}" in `BottomBar`. It stays, as the only filled button.

| Order | Before | After |
| --- | --- | --- |
| 1 Header card | Avatar 88, name 22/800, headline, stars, badges with `✓` text, meta `years · summits · group`, then 3 stacked full-width buttons (grey call, outline contact, outline share) | Avatar 88, name `title2`, headline `callout` secondary, rating row (stars, `4.8` 15/700, `(12)` meta). Badges: trust badge first, using the `icon` checkmark instead of `✓`. |
| 2 Facts | `· `-joined muted line plus the own-figures note | `StatRow`: `{years} / t.guides.years`, `{summits} / t.guides.summits`, `{max_group_size} / t.guides.groupUpTo`. Only cells with data show. The own-figures note goes below in `caption`. |
| 3 Secondary actions | 3 full-width buttons | One row with 2 equal **outline** `md` buttons: Book a call (with price, as now) and Contact. They wrap to 2 rows when the width is under 360 or the labels are long. **Share** becomes a header `IconButton` (`square.and.arrow.up` / `share`, label `t.share.share`). If the header API is awkward, it becomes a text button under the row. |
| 4 Checks | `GuideChecksCard` | Same, with the icon box set to `iconBox.sm` (32, was 36) |
| 5 About | Card plus title | Same, title `section`, body `callout` 15/22 |
| 6 Packages | `GuidePackages` | Same (inherits tokens) |
| 7 Specialties, languages, expertise, regions, certifications | One card with Badge groups | Same structure. Group titles `label`, 16 between groups. |
| 8 Reviews | Cards, outline "Write a review" | Same cards. "Write a review" becomes a **text** button. Loading uses a skeleton of 2 review cards. |
| Bottom | `BottomBar` primary | Same. Add `layout.sectionGap` bottom padding so the last card clears the bar. |

### S3. Group trip page: `src/app/group-trip/[id].tsx`
**Main action:** depends on state. There is exactly one filled button per state:
open → **Join** (BottomBar). Accepted → **Pay deposit** (inside `PayDeposit`, no BottomBar). Requested, organiser or closed → no filled button.

| Order | Before | After |
| --- | --- | --- |
| 1 Photo | Full-bleed 220 | Same |
| 2 Summary card | Specialty label, sample badge, title 22/800, `date · region`, price 28/800, spots bar, organiser link | Eyebrow specialty `label` in link colour. Sample badge. Title `title2`. Date range and region on **2 separate `meta` lines** (no `·`). Price `title1` in primary plus "per person" `meta`. `SpotsBar` with its text split into 2 items: `{left} spots left` and `{taken}/{max}` with an 8 gap and no `·`. Organiser stays a text link (44 hit area). |
| 3 About card | Description plus 4 muted sentences | Description `callout`. Then `DetailRow`s: `g10n.meeting`, `g10n.minPeople` (value `{n} {g10n.people}`), languages (comma list, label `t.guides.languages`), `g10n.includes`. Rows are 12 apart with a 1px line between. |
| 4 Join card (open) | Title, body, 3 placeholder-only inputs, green button inside the card | Title `section` plus body. **`Field`s with visible labels** `g10n.seats`, `t.profile.contact`, `g10n.message`, all with a11y labels. `ErrorText`. The **Join / Sign in to join** button moves to `BottomBar` (same `join()`, same loading state). Wrap the screen in `KeyboardAvoidingView` (iOS `padding`) so the bar sits above the keyboard. |
| 4 Accepted | `✓` text, contact, `PayDeposit` | `SuccessCheck` (32 leaf square, white check) plus `g10n.accepted` `cardTitle`. Contact `title3` selectable. `PayDeposit` keeps its own primary button. |
| 4 Requested | `✓` text plus outline Cancel | Status row with the check glyph and `g10n.requested`. Cancel becomes an **outline** button. |
| 4 Closed or organiser | Muted line | Same text inside `EmptyState` style (glyph `calendar.badge.exclamationmark` / `event_busy`) |
| Open chat | **Grey filled** button | **Outline** button with a chat glyph |
| Pay note | Muted | `caption`, last line of the card |
| Share | Full-width outline at the end | Header `IconButton` (same as S2) |
| Spacing | gap 16 | Cards 16 apart. Bottom padding 40 plus the bar height when the bar shows. |

No new copy in S1 to S3. If localization finds a stat label reads oddly without its number in front (for example `t.guides.groupUpTo` under "8"), we keep the old one-line form for that language.

---

## 5. Motion (Reanimated 4.7 plus worklets 0.13, Expo SDK 58)

All motion follows **Reduce Motion**. Use `useReducedMotion()`, and `.reduceMotion(ReduceMotion.System)` on layout animations (check the exact API in the SDK 58 and Reanimated 4.7 docs before coding). With Reduce Motion on, the end state shows at once.

| What | How | Timing |
| --- | --- | --- |
| Button press | scale 1 to 0.98, opacity 0.9 (Reanimated CSS `transition` on transform, or `withTiming`) | 100 ms in, 150 ms out |
| Chip toggle | bg and border colour transition plus `Haptics.selectionAsync()` | 150 ms |
| Skeleton | opacity 1 to 0.55 loop (`withRepeat`) | 900 ms each way |
| Content arrives | container `entering={FadeIn.duration(180)}` when loading turns into data (no per-row animation in FlatLists) | 180 ms |
| SpotsBar | width from 0 to value on mount, ease out | 400 ms |
| Success | `SuccessCheck`: square `ZoomIn` from 0.8, then check fade, plus `Haptics.notificationAsync(Success)` after join, request sent, review sent, message sent | 200 ms |
| Screens | native stack defaults (unchanged). Intro keeps fade. | |
`expo-haptics` is installed but not used yet, so it needs no new package. No bounce, no parallax, no confetti, no auto-playing carousels.

---

## 6. Risks and what qa-tester must check

| Risk | Mitigation | QA check |
| --- | --- | --- |
| Long languages (de, pl, fr) overflow 2-up buttons, stat cells and chips | Buttons wrap to 2 lines, the 2-up row stacks under 360pt, StatRow wraps, chips scroll | Every sample screen in **de and pl** at 320pt width (iPhone SE, small Android 360dp) with no clipped or sideways-scrolling text |
| Large text (Dynamic Type or Android font 130%+) | `maxFontSizeMultiplier` 1.4 on buttons, chips and badges only. Body text is not capped. | Largest accessibility size on iOS and Android: still readable, nothing hidden |
| Contrast | Filled buttons use forest only. No small white text on leaf or night. Active chip is mint and forest. | Measure: button text 5.5:1, chip active 4.9:1, meta 5.1:1, tab labels 5.5:1 |
| Touch targets | Chip hitSlop, IconButton 44, text buttons minHeight 44 | Every tappable item is at least 44x44pt (VoiceOver/TalkBack focus frame) |
| BottomBar plus keyboard on the group trip page | KeyboardAvoidingView. If it fails on Android, keep the button in the card. | Type in every field on iOS and Android: Join stays visible and tappable |
| `PhotoHeader` −16 margins depend on 16 card padding | Card padding stays 16 | Trip and tour cards: the photo fills the top edge |
| `dark` to `outline` alias changes 6 screens at once | Intended | Account, delete-account, partners, tour save: still clear which button is main |
| Removing `✓` characters drops meaning for screen readers | Badge label text is unchanged. The glyph is decorative (`accessible={false}`). | VoiceOver reads the badge text |
| Sample and test data labels must stay visible | Badges are kept | Sample guide/trip badge is still on every card and header |
| Overlap with the SDK 58 upgrade | Start only after its QA passes and it is committed | |
| Android `boxShadow` and Reanimated on the new architecture | Shadow is only used for floating elements | Pixel 4a class device: no jank on Explore scroll |

Also: tsc in apps/mobile, `npx expo lint`, and before/after screenshots on one iPhone and one Android for each sample.

---

## 7. Rollout after the samples are approved

0. Walter approves this plan and answers the questions below. SDK 58 work is committed and QA is green.
1. **Tokens and `ui.tsx`** (sections 2 and 3, backwards compatible) plus the tab tint. This changes every screen a little. Then QA.
2. **The 3 samples** (S1 to S3). Screenshots for Walter. **Approval gate.**
3. **Tab roots:** Guides, Trips (filters into Section and Field), Chats, Account (stacked buttons into `ListRow` groups with one primary), Hub.
4. **Detail pages:** tour, request, chat, conversation, assistant (send uses `IconButton primary`), call, contact, review, enquire, place, operator, business.
5. **Forms:** sign-in, profile-edit, group-trip/new, request/new, jobs-post, my-business, my-packages, security, delete-account (danger text button).
6. **The rest:** intro and welcome (leaf buttons into `Button`), places, news, merch, moments, partners, invest, soon, not-found.
7. **Font:** Plus Jakarta Sans in the app, if approved (needs a font package or bundled files plus a per-weight family map for Android).
8. **Website:** port the same rules to `apps/web` (frontend-engineer plus designer).
qa-tester runs after each stage. security-reviewer is not needed (no data, sign-in or money logic changes), unless the join-form move touches validation.

---

## 8. Questions for Walter

1. **Grey with white text is 4.0:1**, which fails the 4.5:1 rule for normal-size text. My suggestion is to stop using grey for buttons, active chips and small badges (they become outline, mint or a soft grey fill) and keep grey only for large surfaces with large text. The other option is to use the darker `shade #3a3a3a` where small white text is needed.
2. Should the app **load Plus Jakarta Sans** so it matches the website? Right now it uses the system font.
3. Are **chevrons on list rows** (the standard iOS "opens a page" mark) allowed, or do they count as arrows? The default in this plan is no chevrons.
4. Should **Share** become a small icon in the page header instead of a full-width button?
5. Should the **iOS tab bar** stay visible all the time? Right now it hides when you scroll down.
6. Should the AI concierge entry be a white row with a green icon square, so gold is no longer used as a button fill?
7. The brief was cut off after "Every major screen: clear page title, one primary action, ...". Please paste the rest.
