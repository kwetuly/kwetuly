-- Let the notify Edge Function claim a batch safely, so two runs never send the same alert twice.
alter table public.notification_outbox add column locked_until timestamptz;

create or replace function public.claim_notifications(p_limit int default 50)
returns setof public.notification_outbox
language sql
security definer
set search_path = ''
as $$
  update public.notification_outbox o
  set attempts = o.attempts + 1, locked_until = now() + interval '2 minutes'
  where o.id in (
    select id from public.notification_outbox
    where status = 'pending' and attempts < 5 and (locked_until is null or locked_until < now())
    order by created_at
    limit p_limit
    for update skip locked)
  returning o.*;
$$;

-- Only the Edge Function (service role) may claim alerts.
revoke execute on function public.claim_notifications(int) from public, anon, authenticated;
grant execute on function public.claim_notifications(int) to service_role;
