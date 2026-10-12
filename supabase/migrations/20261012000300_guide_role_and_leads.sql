-- Guides sign up with their own role, and leads can point at a guide.
alter type public.user_role add value if not exists 'guide';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, full_name, phone, role, preferred_language)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone'),
    case when requested in ('traveler', 'provider', 'investor', 'guide')
         then requested::public.user_role else 'traveler' end,
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'en')
  );
  return new;
end;
$$;

alter table public.leads add column guide_id uuid references public.guides (id) on delete set null;
create index leads_guide_id_idx on public.leads (guide_id, created_at desc);

drop policy "Providers, travelers and admins read relevant leads" on public.leads;
create policy "Providers, guides, travelers and admins read relevant leads" on public.leads
  for select to authenticated
  using (
    traveler_id = (select auth.uid())
    or exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = (select auth.uid()))
    or exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid()))
    or private.is_admin());
