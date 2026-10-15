-- "Delete my account" (required by the App Store and Google Play, and by data-protection law).
-- Deleting the auth user removes the profile and everything that hangs off it (guide profile,
-- messages, chats, reviews, requests, saved tours...) through the existing ON DELETE rules.
-- Payment records are kept for the accounts, with the person removed from them.

alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint payments_user_id_fkey;
alter table public.payments
  add constraint payments_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

-- Files people uploaded: they may delete their own photos and documents, so the app can remove
-- them before the account goes (storage files are not removed by SQL).
create policy "Owners delete their avatars" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text);

create policy "Owners delete their verification documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'verification' and owner_id = (select auth.uid())::text);

-- The signed-in person's own uploaded files, so they can be removed before deletion.
create or replace function public.my_uploaded_files()
returns table (bucket_id text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name
  from storage.objects o
  where o.owner_id = (select auth.uid())::text
    and o.bucket_id in ('avatars', 'verification', 'chat-media');
$$;

revoke all on function public.my_uploaded_files() from public, anon;
grant execute on function public.my_uploaded_files() to authenticated;

-- Deletes the signed-in person's account. Only ever acts on auth.uid(), never on an argument.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
