# Exchange rates: setup steps for Walter

Slice S48. Kwetuly reads the Bank of Tanzania (BoT) indicative rates twice a day and uses them only for
the grey "about" estimate next to a TZS or USD price. Nobody is charged in these rates.

Pieces:

- Migration `supabase/migrations/20261203030000_exchange_rates.sql`: the rates table, the logs,
  `public.current_rates()` and the admin functions.
- Edge Function `supabase/functions/exchange-rates`: reads
  `https://www.bot.go.tz/ExchangeRate/excRates?lang=en`, checks every row and saves it.
- Tests: `supabase/checks/exchange_rates_tests.sql` (database) and
  `npx vitest run --root supabase/functions/exchange-rates` (page reader, against a saved copy of the real
  BoT table of 27 Nov 2026).

Do the steps in this order, on a test project first. Never paste a secret into chat, an issue, a
commit or a file in the repository.

## 1. Paste the migration

1. Supabase dashboard, SQL editor: paste all of `20261203030000_exchange_rates.sql` and run it.
2. On a test project only: paste and run `supabase/checks/exchange_rates_tests.sql`. The last line
   must say `all passed`. It ends with ROLLBACK, so it leaves nothing behind.
3. Security advisors (dashboard, Advisors): no new warnings about `exchange_rates`.

## 2. Make the secret

You need one random secret of at least 32 characters, `EXCHANGE_RATES_SECRET`. Make it on your own
computer, for example in a terminal:

```
openssl rand -hex 32
```

Keep it in your password manager. It goes in two places (steps 3 and 5), nowhere else.

## 3. Deploy the function and add its secret

1. Deploy (from the repository root, with the Supabase CLI logged in to the right project):
   `supabase functions deploy exchange-rates`. `supabase/config.toml` already turns the gateway's JWT
   check off for this function only; the function checks the secret, or an admin's own token, itself.
2. Dashboard, Edge Functions, Secrets: add `EXCHANGE_RATES_SECRET` with the value from step 2.
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are already there by default.

## 4. Try one run by hand

In PowerShell (replace the project ref). The secret is typed at a hidden prompt, so it is neither
shown on screen nor kept in the command history:

```powershell
$s = Read-Host -AsSecureString "Exchange rates secret"
$k = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
Invoke-RestMethod -Method Post -Uri "https://<project-ref>.supabase.co/functions/v1/exchange-rates" `
  -Headers @{ "x-exchange-rates-key" = $k } -ContentType "application/json" -Body "{}"
Remove-Variable s, k
```

The function answers at once with `{"accepted":true}` (HTTP 202) and does the work in the background,
in at most about 2 minutes (3 tries of up to 20 s, with 15 s and 45 s waits). A wrong or missing key
gives 403. Then, in the SQL editor:

```sql
select run_at, ok, rows_saved, rows_suspect, rows_skipped, rows_dropped, rows_refused, error_code
  from private.exchange_fetch_log order by run_at desc limit 5;
select * from public.current_rates();
```

A good first run shows `ok = true`, about 36 rows saved and 8 dropped (obsolete codes, GOLD, SDR and
IRR). If BoT did not answer, `error_code` is `timeout` or `network`; that is normal now and then.

## 5. Vault entries and the schedule

The migration already created `private.run_exchange_rates_fetch()` (it calls the function with the key
from Vault) and `private.exchange_rates_watchdog()` (it emails admins when no fetch has worked for 48
hours). Neither runs until you schedule it. In the SQL editor, paste these four lines exactly, after
replacing `<project-ref>` and typing the secret from step 2 in place of `<EXCHANGE_RATES_SECRET>`:

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/exchange-rates', 'exchange_rates_url');
select vault.create_secret('<EXCHANGE_RATES_SECRET>', 'exchange_rates_key');
select cron.schedule('exchange-rates', '0 7,13 * * *', 'select private.run_exchange_rates_fetch()');
select cron.schedule('exchange-rates-watchdog', '30 8 * * *', 'select private.exchange_rates_watchdog()');
```

07:00 and 13:00 UTC are 10:00 and 16:00 in Dar es Salaam; the watchdog runs daily at 11:30 there.
The SQL editor keeps a history of what you ran: after running the lines, clear the secret from that
history (or run the second line on its own and delete it from the history). Check the jobs with
`select jobname, schedule from cron.job where jobname like 'exchange-rates%';`. The `pg_cron` and
`pg_net` extensions are already used by the other scheduled jobs.

## 6. Polish zloty (PLN)

BoT does not publish PLN. You decided (27 Nov 2026) that PLN estimates come only from an override you
set, with the National Bank of Poland as the source; the source name and rate date are shown with the
estimate. Until you set one, Polish visitors see no estimate. You set it on the admin screen
(`/[lang]/admin/rates`, slice S49), signed in with two-step sign-in: currency PLN, TZS per 1 zloty,
source name "National Bank of Poland", the https link to the NBP table, its date, and "valid until"
(at most 30 days). The first PLN rate has nothing to compare with, so the screen asks you to
confirm it once more; later PLN rates are compared with the last one, and a change of more than 25%
also asks. The SQL editor cannot do this, because the function needs a signed-in admin. An
override stops being used after its "valid until" date, so renew it at least once a month.

## What happens when something goes wrong

- BoT page changed (no table, or no good USD row): nothing is saved and every admin gets an email
  "Exchange rates not updated" (at most one every 12 hours).
- BoT page not updated for more than 7 days ("stale"), moved (redirect) or saving failed: email at
  once, at most one every 12 hours.
- BoT not answering: logged; an email only if there was no good run for 48 hours. The daily watchdog
  sends the same email if no fetch worked for 48 hours, even when the function never ran.
- A currency moved more than 15% since the last stored rate: saved as "suspect" and not used; every admin
  gets "Exchange rates to check". On the admin screen choose "Use anyway" or "Ignore".
- Screens keep the last good BoT rate for 7 days, then hide the estimate for that currency.
- The switch `feature.local_prices` turns every estimate off at once.

## Undo

The undo steps are in the header of the migration. Start with `select cron.unschedule('exchange-rates');`
and `select cron.unschedule('exchange-rates-watchdog');`, then follow the order there, and delete the
two Vault entries.

## API for S49 (admin rates screen)

"Fetch now": call the function from the server (a Next server action that passes the signed-in
admin's own access token as `Authorization: Bearer ...`), never from the browser. Answers:

| Status | Body | Meaning |
| --- | --- | --- |
| 202 | `{"accepted":true}` | Started; the result appears in `admin_exchange_fetch_log` within about 2 minutes |
| 429 | `{"error":"too_soon"}` | An admin asked less than 2 minutes ago |
| 403 | `{"error":"forbidden"}` | Not an admin, or no two-step session |
| 503 | `{"error":"not_configured"}` | Function secrets missing |
| 405 | `{"error":"method"}` | Not a POST |

Override (`public.admin_set_rate_override(p_currency, p_tzs_per_unit, p_source_name, p_source_url,
p_rate_date, p_valid_until, p_note, p_confirm_far)`):

- `{"saved":true,"id":"..."}`: saved.
- `{"saved":false,"needs_confirm":true,"reason":"far"|"first","reference_rate":...,"diff_pct":...}`:
  nothing saved. `far` = more than 25% from the reference; `first` = nothing to compare with
  (`reference_rate` and `diff_pct` are null). To confirm, send the whole form again unchanged, with
  `p_confirm_far = true`, within 10 minutes. Any changed field (rate, source, link, dates, note) asks
  again.
- Input errors raise SQLSTATE 22023 with a plain English message; 42501 = not an admin with two-step.

Other admin functions: `admin_end_rate_override(p_id)`, `admin_review_suspect_rate(p_id, p_use)`
("Use anyway" = true, "Ignore" = false), `admin_exchange_rates(p_currency, p_limit)`,
`admin_exchange_fetch_log(p_limit)`, `admin_exchange_rate_actions(p_limit)`. Public:
`current_rates()`. Read `exchange_rates` only with explicit columns (`note` and `entered_by` are not
granted, so `select *` fails).

## Open points

- Legal (security L8, for Walter): check that BoT's site terms allow automated reading and showing derived estimates.
