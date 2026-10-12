-- Check conversation membership from the row itself, so a newly created conversation
-- can be returned to its creator in the same statement.
drop policy "Participants and admins read conversations" on public.conversations;
drop policy "Participants mark conversations read" on public.conversations;

create policy "Participants and admins read conversations" on public.conversations
  for select to authenticated
  using (
    traveler_id = (select auth.uid())
    or exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid()))
    or private.is_admin());

create policy "Participants mark conversations read" on public.conversations
  for update to authenticated
  using (
    traveler_id = (select auth.uid())
    or exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid()))
    or private.is_admin());
