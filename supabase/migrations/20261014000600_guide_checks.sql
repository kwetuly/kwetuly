-- Separate checks instead of one vague "Verified": an admin ticks each one after looking at the document.
-- Travellers see exactly what Rafrika checked; the documents themselves stay private.
alter table public.guides
  add column identity_checked_at timestamptz,   -- government ID / NIDA looked at
  add column licence_checked_at timestamptz,    -- guide licence or registration card looked at
  add column first_aid_checked_at timestamptz,  -- first-aid certificate looked at
  add column first_aid_valid_until date;        -- the certificate's expiry; the check is hidden after it

alter table public.guide_private
  add column first_aid_document_path text;      -- path in the private 'verification' bucket

-- Guides cannot verify themselves, change their plan, or set their own checks.
-- They may clear a check (the app does this when they upload a new document), never set one.
create or replace function public.guard_guide_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.verification_status := 'pending';
    new.verified_at := null;
    new.plan := 'msingi';
    new.plan_expires_at := null;
    new.identity_checked_at := null;
    new.licence_checked_at := null;
    new.first_aid_checked_at := null;
    new.first_aid_valid_until := null;
  else
    new.verification_status := old.verification_status;
    new.verified_at := old.verified_at;
    new.plan := old.plan;
    new.plan_expires_at := old.plan_expires_at;
    new.identity_checked_at := case when new.identity_checked_at is null then null else old.identity_checked_at end;
    new.licence_checked_at := case when new.licence_checked_at is null then null else old.licence_checked_at end;
    new.first_aid_checked_at := case when new.first_aid_checked_at is null then null else old.first_aid_checked_at end;
    new.first_aid_valid_until := case when new.first_aid_checked_at is null then null else old.first_aid_valid_until end;
  end if;
  return new;
end;
$$;
