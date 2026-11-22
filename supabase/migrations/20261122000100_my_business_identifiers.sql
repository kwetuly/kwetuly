-- NOT APPLIED. Written by frontend-engineer on 2026-11-22 for backend-engineer and security-reviewer to review.
--
-- The owner of a business can save its TIN through the `identifiers` Edge Function (field business_tin),
-- but cannot read back the last 3 characters: my_identifiers() only returns the person's own numbers and
-- admin_business_identifiers_masked() is for admins. The member "Verification" screen (website and app)
-- calls this function to show "Saved, ending in 123" and treats a missing function as "nothing saved".
--
-- Returns only the last 3 characters and the date, never a cipher, and only for businesses the caller owns.
--
-- Undo: drop function public.my_business_identifiers();

create or replace function public.my_business_identifiers()
returns table (provider_id uuid, tin_last3 text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.provider_id, b.tin_last3, b.updated_at
  from public.business_identifiers b
  join public.providers p on p.id = b.provider_id
  where p.owner_id = (select auth.uid());
$$;

revoke all on function public.my_business_identifiers() from public, anon;
grant execute on function public.my_business_identifiers() to authenticated;
