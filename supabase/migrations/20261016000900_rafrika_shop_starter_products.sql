-- The Rafrika Shop listing receives merchandise orders; two starter products without prices
-- ("price on request") until Rafrika sets them in /admin/shop.
insert into public.providers (owner_id, business_name, business_type, base_region, story, languages, verification_status, verified_at)
select id, 'Rafrika Shop', 'merch', 'Arusha', 'Official Rafrika merchandise.', array['en', 'sw'], 'approved', now()
from public.profiles where role = 'admin' and not exists (select 1 from public.providers where business_type = 'merch')
order by created_at limit 1;

insert into public.shop_products (name, description, sizes, sort_order)
select * from (values
  ('Rafrika t-shirt', 'Cotton t-shirt with the Rafrika logo.', array['S', 'M', 'L', 'XL', 'XXL'], 1),
  ('Rafrika cap', 'Cap with the Rafrika logo, good for sun on safari.', array[]::text[], 2)
) as v(name, description, sizes, sort_order)
where not exists (select 1 from public.shop_products);
