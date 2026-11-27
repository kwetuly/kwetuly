# Wave 1: paste order for Walter

Branch `claude/wave1`. These are the migrations on this branch that are newer than `823165a`
(main after the reservations merge). None of them has been applied anywhere. Walter pastes each one
himself, first on a test project, then on live.

Before you start: the reservations migrations (`20261122200000_reservation_setup.sql`,
`20261122300000_reservations.sql`, `20261123000000_business_chat.sql`) must already be on the project.

For every step: paste the migration in the SQL editor and run it, then (test project only) run its
checks file, then open the security advisors (Database, Advisors) and look for new warnings.
The checks files insert test rows inside a transaction and end with a rollback, but they are written
for a local or test project only: never run them on live.

| # | Migration | Size | Checks file (test project only) |
| --- | --- | --- | --- |
| 1 | `migrations/20261126000000_feature_switch_admin.sql` | 32,184 bytes | `checks/feature_switch_admin_tests.sql` (15,873 bytes) |
| 2 | `migrations/20261126000060_interest_signups_owner.sql` | 13,885 bytes | `checks/interest_signups_owner_tests.sql` (12,367 bytes) |
| 3 | `migrations/20261126000100_media_uploads.sql` | 52,855 bytes | `checks/media_uploads_tests.sql` (25,285 bytes) |
| 4 | `migrations/20261126000200_profile_links.sql` | 23,536 bytes | `checks/profile_links_tests.sql` (26,925 bytes) |

`20261126000050_host_switches.sql` is gone on purpose: the `feature.vip_hosts` and
`feature.investment_hosts` rows are now in step 1.

## 1. Feature switches (W1-1): first

Paste `20261126000000_feature_switch_admin.sql` before anything else in this wave. It seeds every
`feature.*` switch (host sign-up, profile links, cover photos and the rest), and the admin page
`/admin/features` reads it. Safe to run twice.

If a test project ran an earlier draft of this file (feature rows with "legal" or "team_only" keys),
first run the one-line `update public.site_settings ...` shown in the file's header.

## 2. Host sign-up owner and rate limit (W1-3): before deploying the website

Paste `20261126000060_interest_signups_owner.sql` before the new website goes live. The admin
sign-up list (`/admin/all`) reads the new `user_id` column, so with the new website and without this
migration that list shows empty. The hosts pages themselves work before and after.

## 3. Photo uploads (S4): paste alone

`20261126000100_media_uploads.sql` is about 53 KB. Paste it on its own, in a fresh SQL editor tab,
with nothing else in the same run. It uses `pg_cron`, `pg_net` and Vault, which the project already
uses for the other sweeps. It also seeds `feature.cover_gallery` (on) if step 1 has not, and while
that switch is off it refuses new cover and gallery photos (profile and product photos are not
switched).

Deploy steps around it, in this order:

1. Edge Function secret (Supabase dashboard, Edge Functions, Secrets): add `MEDIA_SWEEP_SECRET`, a
   random value of at least 32 characters (for example `openssl rand -base64 48`). Walter makes and
   enters it himself and keeps a copy in his password manager. It never goes into a file or a chat.
2. Deploy the two Edge Functions:
   `npx supabase functions deploy media-finish` and `npx supabase functions deploy media-sweep`.
   `supabase/config.toml` already sets `verify_jwt = true` for media-finish (called with the
   person's own token) and `verify_jwt = false` for media-sweep (called with the sweep secret).
3. Paste the migration (alone), then run `checks/media_uploads_tests.sql` on the test project.
4. Vault secrets (SQL editor). Walter types the real values himself:
   ```sql
   select vault.create_secret('https://<project>.supabase.co/functions/v1/media-sweep', 'media_sweep_url');
   select vault.create_secret('<the same value as MEDIA_SWEEP_SECRET>', 'media_sweep_key');
   ```
   Until both exist, the hourly job (`kwetuly-media-sweep`, minute 23) only marks unfinished uploads
   and calls nothing, so nothing breaks if this step comes a little later.
5. First runs: call media-sweep with `{"dry_run": true}` and check the counts in the function log
   before letting the hourly run delete files.

The website `/dashboard/photos` and the app's photos screen need media-finish deployed before guides
use them.

## 4. Profile links (S5)

Paste `20261126000200_profile_links.sql`. It does not depend on steps 1 to 3, but keep this order.

Optional and read-only: the file's header has a `select id, business_name, website from
public.providers where ...` query. It lists business websites already on live that the new rules
would refuse if typed in today (chat links, short links, phone numbers). Nothing fails because of
them; an admin may want to correct or clear them with the owner. It changes nothing.

## After all four

- Security advisors once more on the whole project.
- Then deploy the website and the app build from this branch.
