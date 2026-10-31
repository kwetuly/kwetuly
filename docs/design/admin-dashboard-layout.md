# Admin dashboard: phone-first layout (phase 1)

Designer, 2026-10-31. Paper only, no code changed. Follows the board item "2026-10-31 Admin dashboard", step 1 (b).
Status: proposal, waiting for Walter ("readiness rules and layout").

The "ready" rule per kind belongs to operations-manager (step 1 a). Where this file names a rule, it repeats the
safeguards already on the board (decision 2) so the card can be drawn; operations-manager's list wins.

## What exists today (apps/web/src/app/[lang]/admin/page.tsx)

- One long page: a title, then a row of 9 outline buttons (Shared media, Message safety, Commissions, News,
  Business listings, Merchandise, Places, Invite codes, and a grey "Tours & operators"). On a phone they wrap into
  4-5 lines of buttons before any content.
- Below, in this order: pending guides, packages, businesses (plus badge requests and the badge fee), jobs, group
  trips, payments, latest trip requests, inbox (enquiries and sign-ups), latest reviews.
- Every item has its own Approve / Reject. No counts at the top, no approve-all, no filter or search.
- Small brand slips to fix while building: "HIDDEN" in capitals (reviews); "→" between dates on group trips
  (use "to" or an en dash); empty sections show a bare "—" (should say what it means, see Empty states).

## Building blocks to reuse (no new design system)

| Need | Reuse | Note |
| --- | --- | --- |
| Green main button | `.btn` (globals.css) | Approve, Approve selected |
| Second button | `.btn-outline` | Reject, Cancel, Clear filters |
| Card | `.card` | Use `p-4` on phones instead of `p-6` |
| Field | `.field`, `.label` | Search box, selects |
| Small labels | `.badge` (mint/forest) and the sample pill from `guide-card.tsx` (gold border, sand background, charcoal text) | Sample label must look the same as on public cards |
| Button that shows "Sending…" and blocks double taps | `SubmitButton` (`components/submit-button.tsx`) | For Approve, Reject, Approve selected, Confirm |
| Bottom bar on phones | Pattern of `StickyCta` (`components/sticky-cta.tsx`): fixed, white/95, top border, safe-area padding | New small client component, same look; it is a form bar, not a link |
| Result note | `SavedNote` (`components/saved-note.tsx`) | Result line after a batch, disappears on the next edit |
| Icons | `Icon` / lucide-react (`components/icon.tsx`) | Same set as the site. Size 20 inside a 36px green square, stroke 2 |
| Loading | The existing `animate-pulse rounded-[5px] bg-surface` block | One per tile and per card |
| Masked phone | `maskPhone()` already in admin page.tsx | Move to a shared admin helper and reuse on the users list |
| Confirm once | Not `ConfirmSubmitButton` (browser pop-up cannot list names) | Use a real confirm screen, below |

Rules used everywhere below: green `#1D951A` for every action and every icon square (white icon); gold `#ffb627`
only for highlights (sample label, "waiting long" marker, count badges); grey `#7F7F7F` only for dark surfaces with
white text; charcoal `#2b3631` text; mint `#E5F5E3` soft backgrounds; 5px corners; sentence case; no arrows on
buttons; tap targets at least 44px; no sideways scrolling at 360px.

---

## 1. Admin home (/admin)

Goal: in one glance on a phone, "what is waiting for me, and how long". One main action: "Review waiting items".

### Phone (360-430px)

```
+------------------------------------------+
| Kwetuly                       [menu]     |  site nav as today
+------------------------------------------+
| Admin                                    |  h1, 24px bold
| 31 Oct, 09:40 (Dar es Salaam)            |  muted, small
|                                          |
| +--------------------------------------+ |
| |  Review waiting items (27)           | |  .btn, full width, 48px
| +--------------------------------------+ |  the one main action
|                                          |
| Waiting for you                          |  h2, 18px bold
| +-----------------+ +-----------------+  |
| | [#] Guides      | | [#] Businesses  |  |  tile = whole card is the link
| |  6              | |  3              |  |  count 28px bold charcoal
| |  oldest 4 days  | |  oldest 1 day   |  |  muted; gold dot if past
| +-----------------+ +-----------------+  |  the service level
| +-----------------+ +-----------------+  |
| | [#] Packages    | | [#] Group trips |  |
| |  9              | |  2              |  |
| |  oldest 2 days  | |  1 needs a call |  |  gold text line if a
| +-----------------+ +-----------------+  |  phone call is needed
| +-----------------+ +-----------------+  |
| | [#] Jobs        | | [#] Documents   |  |
| |  1              | |  to re-check 2  |  |
| +-----------------+ +-----------------+  |
| +-----------------+ +-----------------+  |
| | [#] Badge       | | [#] Payments    |  |
| |     requests 1  | |  to pay out 0   |  |
| +-----------------+ +-----------------+  |
| +-----------------+ +-----------------+  |
| | [#] Message     | | [#] Trips to    |  |
| |     reports 0   | |  re-check 4     |  |
| +-----------------+ +-----------------+  |
|                                          |
| New since yesterday                      |  h2; read-only counts
| Enquiries 5 · Trip requests 2 ·          |  one wrapped line of
| Sign-ups 3                               |  links, 44px rows
|                                          |
| Manage                                   |  grouped menu (below)
| ...                                      |
+------------------------------------------+
```

`[#]` = 36px green square, 5px corners, white lucide icon size 20.

Tiles:
- Two columns on phones (each about 160px wide at 360px), three on tablet, four on desktop. Minimum height 96px,
  so the whole tile is a large tap target.
- Tile content, top to bottom: icon square and queue name (16px semibold), count (28px bold), one muted line
  (oldest age, or the one thing that blocks, e.g. "1 needs a call").
- Count 0: tile stays, count shows "0", line reads "Nothing waiting", tile background stays white, number muted.
  Tiles do not jump around when counts change; the order is fixed (most often used first).
- Past the service level (operations-manager sets it, e.g. 2 days): a small gold dot before the age line plus the
  words "waiting long". Never red for "waiting"; red is kept for errors.
- Each tile links to /admin/review with that kind already filtered (e.g. `/admin/review?kind=guide`), or to the
  existing page for queues that are not in review (payments to `#payments` on the old page for now, message
  reports to /admin/messages, trips to re-check to /admin/trips).
- Screen reader text per tile: "Guides, 6 waiting, oldest 4 days".

Suggested icons (lucide, all already in the site's set or in lucide-react):

| Tile | Icon | Meaning |
| --- | --- | --- |
| Guides | `user-round` | a person |
| Businesses | `store` | a shop |
| Packages | `backpack` | a trip offer |
| Group trips | `users-round` | a group |
| Jobs | `briefcase` | work |
| Documents to re-check | `file-check` (add to icon.tsx) | papers |
| Badge requests | `badge-check` | the badge itself |
| Payments | `wallet` (add) | money |
| Message reports | `messages-square` | messages |
| Trips to re-check | `route` | a route |

### Grouped menu (replaces the row of 9 buttons)

On phones: a list of groups, each a heading with rows. Each row is a full-width link, 48px high, icon square
(28px, icon 16) on the left, label, and a muted short hint underneath when helpful. No chevrons or arrows at the
end of the row; the whole row is the link and it has an underline on focus/hover.

```
| Manage                                   |
|                                          |
| Approvals                                |  h3, 14px semibold, muted
| [#] Review waiting items                 |  /admin/review
| [#] Tours and operators                  |  /admin/trips, /admin/operators
| [#] Business listings                    |  /admin/listings
|                                          |
| People                                   |
| [#] Users                                |  /admin/users (new, read-only)
| [#] Invite codes                         |  /admin/invites
| [#] Message safety                       |  /admin/messages
|                                          |
| Money                                    |
| [#] Payments                             |  #payments on the old page
| [#] Commissions                          |  /admin/commissions
| [#] Badge fee                            |  the fee box in businesses
|                                          |
| Content                                  |
| [#] News                                 |  /admin/news
| [#] Places                               |  /admin/places
| [#] Shared media                         |  /admin/media
| [#] Merchandise                          |  /admin/shop
|                                          |
| Inbox                                    |
| [#] Enquiries and sign-ups               |  #inbox on the old page
| [#] Latest reviews                       |  #reviews on the old page
| [#] Trip requests                        |  #requests on the old page
```

- Desktop (1024px+): the same groups shown as a left side column (240px) next to the tiles, so all admin pages are
  one tap away. Same labels, same icons, current page in mint background with forest text.
- The old long page stays reachable as "All sections (old page)" at the bottom of the menu until phase 2 moves each
  section; nothing is lost while we move.
- Tours and operators is a normal row now (today it is the only grey button, which made it look like the main
  action).

### Home states

- Loading: tiles render with the pulse block in place of the number; the menu shows at once (it has no data).
- Error loading a count: tile shows "Could not load" in muted text and the tile still links to the queue. One line
  at the top: "Some counts could not load. Pull down or reload to try again."
- Everything at 0: main button text becomes "Nothing waiting. Look at all items" (outline style, since there is no
  urgent action), and a mint note "All caught up. New items will show here."

---

## 2. Review page (/admin/review)

One list for guides, businesses, packages, group trips and jobs. One main action at a time: per card it is
"Approve"; with ticks it becomes the bottom bar "Approve selected (n)".

### Page top (phone)

```
+------------------------------------------+
| Admin / Review                           |  small muted breadcrumb (link)
| Waiting items (27)                       |  h1, 24px bold
| 19 ready to approve · 8 need something   |  muted line
|                                          |
| +--------------------------------------+ |
| | [search] Search by name              | |  .field, type=search, 48px
| +--------------------------------------+ |
| [All 27][Guides 6][Businesses 3][Pack... |  kind chips; they WRAP to a
| [Group trips 2][Jobs 1]                  |  second line, no sideways scroll
|                                          |
| Show  [Ready and not ready v]            |  select: Ready only / Not ready
|       [Real and sample v]                |  select: Real only / Sample only
|       [Oldest first v]                   |  select: Newest first
| Clear filters                            |  text link, only when filtered
+------------------------------------------+
```

- Chips: 40px high plus 4px gap row (44px tap area), 5px corners. Selected chip = green background, white text;
  others = white with a line border, charcoal text. Count inside the chip.
- Filters live in the URL (`?kind=guide&ready=1&sample=0&sort=oldest&q=`), so a tile link opens the right view and
  reload keeps it. Filters are a normal GET form with a green "Show" button for no-JS; with JS they apply on change.
- On desktop the three selects sit in one row next to the search box.

### One card per item

```
+------------------------------------------+
| [ ]  Guide · 4 days waiting              |  tick box 24px in a 44px tap
|      Asha Mrema               [Sample]   |  area; name 18px bold
|      Arusha · Safari, Mountain           |  muted 14px, one line
|                                          |
|      Ready                               |  mint box, forest text
|      [ok] ID checked                     |
|      [ok] Licence checked                |
|      [ok] Registration number given      |
|                                          |
|      Open details                        |  text link (expands, see below)
|                                          |
|      +-----------------+ +------------+  |
|      |    Approve      | |  Reject    |  |  .btn + .btn-outline, 44px,
|      +-----------------+ +------------+  |  side by side, equal height
+------------------------------------------+

+------------------------------------------+
|      Group trip · 1 day waiting          |  no tick box: not ready
|      Kili in March                       |  (an empty 44px gutter keeps
|      Traveller organiser · Moshi         |   names lined up)
|                                          |
|      Missing before you can approve      |  sand box with gold left
|      [!] Phone not confirmed yet.        |  border, charcoal text
|          Call the organiser, then press  |
|          "Phone confirmed".              |
|      [ok] Dates and price given          |
|                                          |
|      +--------------------------------+  |
|      |       Phone confirmed          |  |  .btn-outline (the fix step)
|      +--------------------------------+  |
|      +-----------------+ +------------+  |
|      |    Approve      | |  Reject    |  |  Approve disabled, with the
|      +-----------------+ +------------+  |  reason read out (see below)
+------------------------------------------+
```

Card parts, in this order:
1. Kind and age line, 14px semibold muted: "Guide · 4 days waiting". Age in plain words ("today", "1 day",
   "3 weeks"). Past the service level, a gold dot and "waiting long".
2. Name, 18px bold, links to the public or preview page in a new tab (as group trips do today).
3. Labels on the right of the name: Sample (same gold-border sand pill as public cards, words "Sample");
   "Approved guide: new document" for re-checks (mint badge); "Changed since you opened this" only after a
   failed batch (see result line).
4. One muted summary line (region and type; for packages the guide's name and price; for jobs company and role).
5. Readiness box:
   - Ready: mint background, forest text, heading "Ready", list of what passed with a small check icon
     (lucide `check`, size 16).
   - Not ready: sand background (`#fff8ee`) with a 4px gold left border, heading "Missing before you can approve",
     each missing item with a small `circle-alert` icon in charcoal and one sentence that says what to do next.
     What already passed is listed under it with check icons, so Walter sees how close it is.
   - Never only colour: the heading words "Ready" / "Missing" carry the meaning.
6. "Open details": a `<details>` that shows today's full content for that kind (documents with their tick boxes
   and the "Save checks" button for guides, description, includes, contact, licence link for businesses, the note
   box for packages). The per-document ticks stay one by one inside details, as the board requires.
7. Buttons: Approve (green) and Reject (outline), equal width, 44px high, side by side even at 360px (each about
   140px). Both use `SubmitButton` so a second tap does nothing.
   - On a not-ready card Approve is disabled (opacity 60%) and has `aria-describedby` pointing at the missing list.
     Walter may still open details and fix the cause (e.g. Phone confirmed, Save checks); the card then turns ready.
   - Reject keeps today's behaviour per kind (packages keep their note box, inside details). No "reject all".
8. Tick box: only on ready cards. 24px box, green when ticked (`accent-leaf`), label "Select Asha Mrema" for screen
   readers; the whole left gutter (44px wide, full card height) toggles it. Ticked card gets a 2px green border.

Sample items: they show the sample pill and are included in "Approve all ready" only when the filter is "Sample
only" or "Real and sample" and the confirm screen lists them under their own heading "Sample (test data)". Before
launch Walter rejects or deletes them instead, so I propose the default filter "Real only" (decision for Walter,
see end).

### Sticky bottom bar

Shown on all screen sizes while at least one ready item is on the page (on desktop it sits at the bottom of the
content column, still sticky). Same look as `StickyCta`: white 95%, top border, safe-area padding. The page gets
bottom padding the height of the bar so the last card is never hidden.

```
Nothing ticked:
+------------------------------------------+
| +--------------------------------------+ |
| |  Approve all ready on this page (19) | |  .btn, full width, 48px
| +--------------------------------------+ |
+------------------------------------------+

Some ticked:
+------------------------------------------+
| 3 selected · Clear                       |  14px; "Clear" is a text button
| +--------------------------------------+ |
| |  Approve selected (3)                | |  .btn, full width, 48px
| +--------------------------------------+ |
| Approve all ready on this page (19)      |  text button, forest, 44px tall
+------------------------------------------+
```

- Only one green button at a time: with ticks, "Approve selected" is green and "Approve all ready" drops to a text
  button; with no ticks, "Approve all ready" is the green button.
- "On this page" means the filtered list on screen, at most 50 items per page (the board's limit). If more than 50
  are ready, the list pages at 50 and the bar says "Approve all ready on this page (50)"; a muted line under the
  list says "12 more ready on the next page".
- No ready items on the page: the bar is hidden (no disabled green button sitting there).
- Neither button approves straight away; both open the confirm screen.

### Confirm screen

A full page step (`/admin/review/confirm`, or the same page with `?confirm=1` and the chosen ids posted), not a
browser pop-up, because it must list names and work with one hand. On desktop it can be a centred panel 560px wide.

```
+------------------------------------------+
| Approve 19 items?                        |  h1, 24px bold
|                                          |
| Each one goes live and the owner gets    |  plain sentence
| the usual "approved" notice.             |
|                                          |
| Guides (6)                               |  h2 16px bold, grouped by kind
|  Asha Mrema                              |  plain list, 15px, 40px rows
|  Baraka Lyimo                            |
|  ...                                     |
| Packages (9)                             |
|  Ngorongoro day trip · Asha Mrema        |
|  ...                                     |
| Sample (test data) (2)                   |  only if samples are included;
|  Sample Lodge                            |  gold-border sand box
|                                          |
| Kwetuly checks each one again before     |  muted note
| approving. Anything that changed is      |
| left waiting.                            |
+------------------------------------------+
| +--------------------------------------+ |  sticky bar again
| |  Yes, approve 19                     | |  .btn, SubmitButton,
| +--------------------------------------+ |  pending "Approving…"
| +--------------------------------------+ |
| |  Go back                             | |  .btn-outline, keeps ticks
| +--------------------------------------+ |
+------------------------------------------+
```

- Long lists (over 10 in a kind) collapse to the first 10 plus "Show all 14 guides" (a `<details>`), so the
  confirm buttons stay near the thumb; the count in the heading is always the full number.
- Buttons stacked full width on phones (no mis-tap between them), side by side on desktop.

### Result line

Back on /admin/review, at the top of the list, in a `SavedNote` with `role="status"`:

```
All approved:
+------------------------------------------+
| [ok] 19 approved.                        |  mint box, forest text
+------------------------------------------+

Some not:
+------------------------------------------+
| 18 approved, 1 not approved.             |  sand box, gold left border
| Kili in March: phone not confirmed.      |  one line per item, name in
| Show this item                           |  bold; link scrolls to card
+------------------------------------------+

Nothing approved:
+------------------------------------------+
| None approved. They changed since you    |  sand box
| opened the page: Asha Mrema (no longer   |
| waiting). Reload the page to see them.   |
+------------------------------------------+
```

Item reasons, plain words: "no longer waiting", "ID not checked yet", "skills still to prove", "phone not
confirmed", "changed by the owner since you opened the page", "could not save, try again". The cards that failed
stay in the list with the label "Changed since you opened this". Server errors for the whole batch use the red
error box already used on the page ("Could not approve. Nothing was changed. Please try again.").

### Review page states

- Loading: three card skeletons (pulse blocks: one line, one title, one box, two buttons).
- Empty, no filters: mint card "Nothing is waiting. New guides, businesses, packages, group trips and jobs show
  here." plus outline link "Back to admin".
- Empty with filters: "Nothing matches these filters." plus green "Clear filters" button (it is the only action).
- Search with no match: "No waiting item called "xyz". Check the spelling or clear the search."

---

## 3. Users list (/admin/users), read-only

No edit buttons, no role changes in phase 1. No main green action on this page (search is the only control), so
the "Show" button of the search form is the green one.

```
+------------------------------------------+
| Admin / Users                            |
| Users (412)                              |  h1
| +----------------------------+ +------+  |
| | [search] Name or email     | | Show |  |  .field + .btn (44px)
| +----------------------------+ +------+  |
| [All][Travellers][Guides][Businesses]    |  chips, wrap
| [Admins]                                 |
| [Phone confirmed v]  [Newest first v]    |  selects
|                                          |
| +--------------------------------------+ |
| | Asha Mrema                           | |  16px semibold
| | Guide · joined 12 Oct 2026           | |  muted 14px
| | Phone 2557XX…678 · confirmed         | |  masked; "confirmed" in forest
| +--------------------------------------+ |  with check icon, or "not
| +--------------------------------------+ |  confirmed" in muted charcoal
| | John Smith                           | |
| | Traveller · joined 30 Oct 2026       | |
| | No phone                             | |
| +--------------------------------------+ |
|  ...                                     |
| Showing 1-50 of 412                      |
| +-----------------+ +-----------------+  |
| |  Previous       | |  Next           |  |  .btn-outline, 44px; words only
| +-----------------+ +-----------------+  |
+------------------------------------------+
```

- Phones: one row card per user (no table, so no sideways scroll). Desktop (768px+): a table with columns Name,
  Role, Joined, Phone, Phone confirmed; table has a caption "Users" for screen readers.
- Masked phone with the existing `maskPhone()` format (`2557XX…678`). Never the full number, never email on the row
  (email is searchable but only the name shows; the security-reviewer decides whether search by email is allowed).
- Sample accounts (if any) carry the same sample pill.
- Rows are not links in phase 1 (no profile page for admins yet), so they do not look tappable: no hover colour,
  no underline.
- Empty search: "No user matches "xyz"." Loading: five row skeletons. Error: "Could not load users. Reload the
  page to try again."
- Dates in Dar es Salaam time, "12 Oct 2026" style, as elsewhere in admin.

---

## Readability and size checks (for frontend-engineer and qa-tester)

- Test widths 360, 390, 430, 768, 1280. No sideways scroll at 360 (the chip rows wrap, the card buttons fit:
  2 x 140px + gap inside a 328px card body).
- Tap targets: tick area 44 x full card height; chips 44 incl. gap; menu rows 48; bar buttons 48; card buttons 44.
- Text sizes: body 15-16px, never under 14px except the breadcrumb (14px).
- Contrast: charcoal on white, mint, sand: well over 4.5:1. Muted `#5f6b66` on white about 5.6:1, fine.
  Forest `#187a16` text on mint: fine.
- Contrast flag (brand, not changed here): white 16px text on green `#1D951A` measures about 3.9:1 and white on
  grey `#7F7F7F` about 4.0:1, both under 4.5:1 for normal-size text. Today's `.btn` uses `#1D951A` with 16px
  semibold. Options for Walter below. The icon squares are fine (icons need 3:1).
- Keyboard: tick boxes, chips, Approve/Reject and the bar are reachable in order; the existing green focus outline
  applies; after a batch, focus moves to the result line.
- The bar never covers the last card (bottom padding equal to the bar height plus safe area).

## Out of scope for phase 1 (shown so the layout leaves room)

- "Reject selected", "Needs more info", a Decided tab, reasons for every reject: phase 2. The card has room for a
  third button row inside details; the bar has room for a second outline button.
- Admin Alerts tile (link changes): phase 2, after its migration. Reserve a tile slot in the "Waiting for you"
  grid.
- Orders and enquiries with "Show contact": phase 3.
- No admin in the iPhone/Android app (board decision 4). This web layout is the phone admin.

## Decisions for Walter

1. Approve this layout (home tiles, grouped menu, review cards, bottom bar, confirm screen, result line, users list).
2. Default filter on /admin/review: "Real only" (proposed), so sample items are never batch-approved by accident.
3. Tile order and which queues get a tile (operations-manager's queue list may add or drop some).
4. Contrast of white text on brand green and grey (affects the whole site and app, not only admin). Options:
   (a) keep as is; (b) use the darker green `#187a16` (already in the theme as forest/leaf-dark, about 5.4:1) for
   button backgrounds while keeping `#1D951A` for icon squares and accents; (c) make button text 18.7px bold
   (counts as large text, 3:1 is enough). Designer recommends (b). Not changed without Walter's approval.
5. Two new icons in `icon.tsx` (`file-check`, `wallet`) from the same lucide set.
