-- Dry run for section D of migration 20261025000000_brand_rename_kwetuly.sql. READ-ONLY.
-- Run it as an admin (SQL editor) BEFORE the migration. It lists one row per value that the migration
-- would change: table, row id and column. It never prints the text itself (it may be personal).
-- Keep the targets, column rules and match pattern identical to section D of the migration.
-- The whole check runs in a read-only transaction and ends with a rollback, so it cannot change data.

begin;
set transaction read only;

with targets(tbl, pk, row_filter, cols) as (
  values
    ('trips',          'id',  'true', ''),
    ('trip_stops',     'id',  'true', ''),
    ('places',         'id',  'true', ''),
    ('travel_news',    'id',  'source_name is null', 'title,body'),
    -- Kwetuly's own sentence inside a sourced item: "Rafrika never applies for visas on your behalf."
    ('travel_news',    'id',  'source_name is not null and body like ''%never applies for visas%''', 'body'),
    ('tour_operators', 'id',  'true', 'description'),
    ('shop_products',  'id',  'true', ''),
    ('site_settings',  'key', 'true', ''),
    ('providers',      'id',  'is_sample or (business_type = ''merch'' and owner_id in (select p.id from public.profiles p where p.role = ''admin''))', ''),
    ('guides',         'id',  'is_sample', ''),
    ('guide_packages', 'id',  'guide_id in (select g.id from public.guides g where g.is_sample)', '')
),
eligible as (
  select t.tbl, t.pk, t.row_filter, c.column_name
  from targets t
  join information_schema.columns c on c.table_schema = 'public' and c.table_name = t.tbl
  where c.is_generated = 'NEVER'
    and c.column_name !~ '(url|path|website|email|phone)'
    and c.column_name !~ '^(source|licence)_'
    and c.column_name <> 'slug'
    and (t.cols = '' or c.column_name = any (string_to_array(t.cols, ',')))
    and (c.data_type in ('text', 'character varying', 'jsonb')
         or (c.data_type = 'ARRAY' and c.udt_name in ('_text', '_varchar')))
)
select e.tbl as table_name, m.row_id, e.column_name
from eligible e
cross join lateral xmltable(
  '/table/row' passing query_to_xml(
    format('select %I::text as row_id from public.%I where (%s) and %I::text ~ ''\m(Rafrika|RAFRIKA|rafrika)\M|#RafrikaGuides''',
           e.pk, e.tbl, e.row_filter, e.column_name),
    true, false, '')
  columns row_id text path 'row_id'
) m
order by 1, 2, 3;

-- Values the migration does NOT touch (user-written text, links, contact columns, joined words) are
-- counted, without their text, by the final report block of the migration.

rollback;
