-- Referral commissions: a business (curio shop, hotel...) pays Rafrika an agreed share of sales
-- that came through a guide's referral code; part of it can go to the guide. Each business has its
-- own written agreement, recorded here by an admin.

-- Travellers see a commission note only on businesses with an active agreement.
alter table public.providers add column has_referral_agreement boolean not null default false;

create or replace function public.guard_provider_admin_fields()
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
    new.listing_fee_paid_until := null;
    new.badge_checks := '{}';
    new.badge_checked_at := null;
    new.badge_valid_until := null;
    new.has_referral_agreement := false;
  else
    new.verification_status := old.verification_status;
    new.verified_at := old.verified_at;
    new.listing_fee_paid_until := old.listing_fee_paid_until;
    new.badge_checks := old.badge_checks;
    new.badge_checked_at := old.badge_checked_at;
    new.badge_valid_until := old.badge_valid_until;
    new.has_referral_agreement := old.has_referral_agreement;
  end if;
  return new;
end;
$$;

-- One agreement per business. Shares are percentages of the sale amount.
create table public.business_agreements (
  provider_id uuid primary key references public.providers (id) on delete cascade,
  rafrika_pct numeric(5, 2) not null default 0 check (rafrika_pct between 0 and 100),
  guide_pct numeric(5, 2) not null default 0 check (guide_pct between 0 and 100),
  signed_on date,
  notes text check (char_length(notes) <= 2000),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (rafrika_pct + guide_pct <= 100)
);

create trigger business_agreements_updated_at
  before update on public.business_agreements
  for each row execute function public.set_updated_at();

alter table public.business_agreements enable row level security;

create policy "Admins manage agreements" on public.business_agreements
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "Businesses read their own agreement" on public.business_agreements
  for select to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = (select auth.uid())));

-- Keep the public flag in step with the agreement.
create or replace function public.sync_referral_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.providers set has_referral_agreement = false where id = old.provider_id;
    return old;
  end if;
  update public.providers set has_referral_agreement = new.active where id = new.provider_id;
  return new;
end;
$$;

revoke execute on function public.sync_referral_flag() from public, anon, authenticated;

create trigger business_agreements_flag
  after insert or update or delete on public.business_agreements
  for each row execute function public.sync_referral_flag();

-- Each guide's personal code that travellers show at the business.
create table public.referral_codes (
  guide_id uuid primary key references public.guides (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6,10}$'),
  created_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;

create policy "Guides and admins read codes" on public.referral_codes
  for select to authenticated
  using (exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid())) or private.is_admin());

-- A guide gets (or creates) their code. Codes are random so they cannot be guessed from names.
create or replace function public.my_referral_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guide uuid;
  v_code text;
begin
  select id into v_guide from public.guides where owner_id = auth.uid() and verification_status = 'approved';
  if v_guide is null then
    return null;
  end if;
  select code into v_code from public.referral_codes where guide_id = v_guide;
  if v_code is not null then
    return v_code;
  end if;
  loop
    v_code := 'RF' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    begin
      insert into public.referral_codes (guide_id, code) values (v_guide, v_code);
      return v_code;
    exception when unique_violation then
      -- try another code
    end;
  end loop;
end;
$$;

revoke execute on function public.my_referral_code() from public, anon;
grant execute on function public.my_referral_code() to authenticated;

-- Sales a business reports for a referral code. The guide is looked up from the code.
create type public.referral_sale_status as enum ('reported', 'invoiced', 'paid');

create table public.referral_sales (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  code text not null check (char_length(code) <= 10),
  guide_id uuid references public.guides (id) on delete set null,
  sale_date date not null default current_date,
  amount_tzs numeric(14, 2) not null check (amount_tzs > 0),
  note text check (char_length(note) <= 500),
  status public.referral_sale_status not null default 'reported',
  reported_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index referral_sales_provider_idx on public.referral_sales (provider_id, sale_date desc);
create index referral_sales_guide_idx on public.referral_sales (guide_id, sale_date desc);

-- The code decides the guide; businesses cannot set the guide or mark sales paid themselves.
-- Only the code lookup runs with extra rights (businesses cannot read referral_codes); the trigger
-- itself runs as the caller, so the admin check below sees who is really making the change.
create or replace function private.guide_for_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select guide_id from public.referral_codes where code = upper(trim(p_code));
$$;

revoke execute on function private.guide_for_code(text) from public, anon;
grant execute on function private.guide_for_code(text) to authenticated;

create or replace function public.prepare_referral_sale()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.code := upper(trim(new.code));
  new.guide_id := private.guide_for_code(new.code);
  if not private.is_trusted() then
    new.reported_by := auth.uid();
    if tg_op = 'INSERT' then
      new.status := 'reported';
    else
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

create trigger referral_sales_prepare
  before insert or update on public.referral_sales
  for each row execute function public.prepare_referral_sale();

alter table public.referral_sales enable row level security;

create policy "Businesses, their guides and admins read sales" on public.referral_sales
  for select to authenticated
  using (
    exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = (select auth.uid()))
    or exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid()))
    or private.is_admin());
create policy "Businesses report their own sales" on public.referral_sales
  for insert to authenticated
  with check (exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = (select auth.uid())) or private.is_admin());
create policy "Admins update sales" on public.referral_sales
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "Businesses delete unbilled sales and admins delete any" on public.referral_sales
  for delete to authenticated
  using (
    (status = 'reported' and exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = (select auth.uid())))
    or private.is_admin());
