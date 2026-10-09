begin;
select plan(9);

select has_column('public', 'demands', 'country_code',
  'demands must persist an explicit market country');
select has_column('public', 'demands', 'currency_code',
  'demands must persist the stored budget currency');
select ok(
  (select column_default like '%KR%' from information_schema.columns
   where table_schema='public' and table_name='demands' and column_name='country_code'),
  'existing requests default to Korean market');
select ok(
  (select column_default like '%KRW%' from information_schema.columns
   where table_schema='public' and table_name='demands' and column_name='currency_code'),
  'existing budgets remain KRW');
select ok(
  to_regprocedure('public.search_nearby_demands_market(double precision,double precision,integer,integer,text)') is not null,
  'country-scoped GPS query exists');
select ok(
  has_function_privilege('authenticated',
    'public.search_nearby_demands_market(double precision,double precision,integer,integer,text)', 'execute'),
  'authenticated callers can search country-scoped proximity');
select ok(
  not has_function_privilege('anon',
    'public.search_nearby_demands_market(double precision,double precision,integer,integer,text)', 'execute'),
  'anonymous clients cannot probe country-scoped proximity');
select ok(
  not has_function_privilege('authenticated',
    'public.search_nearby_demands(double precision,double precision,integer,integer)', 'execute'),
  'obsolete country-blind GPS function is not callable');
select ok(
  exists (select 1 from pg_constraint
    where conrelid = 'public.demands'::regclass
      and conname = 'dan_demand_market_currency_pair'),
  'server enforces consistent KR/KRW and JP/JPY pair');

select * from finish();
rollback;
