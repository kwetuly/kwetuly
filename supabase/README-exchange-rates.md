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

In a terminal (replace the project ref; type the secret yourself, do not save it in a file):

```
curl -X POST "https://<project-ref>.supabase.co/functions/v1/exchange-rates" \
  -H "x-exchange-rates-key: <EXCHANGE_RATES_SECRET>" -H "Content-Type: application/json" -d "{}"
```

A good answer looks like `{"ok":true,"saved":37,"suspect":0,"skipped":0,"dropped":7,"refused":0}`
(dropped = obsolete codes, GOLD and SDR). If BoT does not answer, the function tries 3 times over about
3 minutes and then answers `{"ok":false,"error":"timeout"}`; that is normal now and then.

Then check in the SQL editor: `select * from public.current_rates();`

## 5. Vault entries and the schedule

In the SQL editor (type the secret yourself where it says so):

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/exchange-rates', 'exchange_rates_url');
select vault.create_secret('<EXCHANGE_RATES_SECRET>', 'exchange_rates_key');
```

Then paste the commented block "Schedule" from the top of the migration, without the `--` at the
start of each line: it creates `private.run_exchange_rates_fetch()` and the job

```sql
select cron.schedule('exchange-rates', '0 7,13 * * *', 'select private.run_exchange_rates_fetch()');
```

07:00 and 13:00 UTC are 10:00 and 16:00 in Dar es Salaam. Check it with
`select * from cron.job where jobname = 'exchange-rates';`. The `pg_cron` and `pg_net` extensions are
already used by the other scheduled jobs.

## 6. Polish zloty (PLN)

BoT does not publish PLN. You decided (27 Nov 2026) that PLN estimates come only from an override you
set, with the National Bank of Poland as the source; the source name and rate date are shown with the
estimate. Until you set one, Polish visitors see no estimate. You set it on the admin screen
(`/[lang]/admin/rates`, slice S49), signed in with two-step sign-in: currency PLN, TZS per 1 zloty,
source name "National Bank of Poland", the https link to the NBP table, its date, and "valid until"
(at most 30 days). The SQL editor cannot do this, because the function needs a signed-in admin. An
override stops being used after its "valid until" date, so renew it at least once a month.

## What happens when something goes wrong

- BoT page changed (no table, or no good USD row): nothing is saved and every admin gets an email
  "Exchange rates not updated" (at most one every 12 hours).
- BoT not answering: logged; an email only if there was no good run for 48 hours.
- A currency moved more than 15% since the last stored rate: saved as "suspect" and not used; every admin
  gets "Exchange rates to check". On the admin screen choose "Use anyway" or "Ignore".
- Screens keep the last good BoT rate for 7 days, then hide the estimate for that currency.
- The switch `feature.local_prices` turns every estimate off at once.

## Undo

The undo steps are in the header of the migration. Start with `select cron.unschedule('exchange-rates');`
and delete the two Vault entries.

## Open points

- Legal: check that BoT's site terms allow automated reading and showing derived estimates.
- Edge Function time limit: three tries with 30 s and 120 s waits can take up to about 3.5 minutes.
  On a plan whose wall-clock limit is shorter, the last try is cut off; that only means a missed run.
