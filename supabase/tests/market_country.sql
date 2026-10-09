begin;
select plan(16);

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
  to_regprocedure('public.search_nearby_demands_market(double precision,double precision,integer,integer,text,integer)') is not null,
  'country-scoped GPS query with pagination exists');
select ok(
  has_function_privilege('authenticated',
    'public.search_nearby_demands_market(double precision,double precision,integer,integer,text,integer)', 'execute'),
  'authenticated callers can search country-scoped proximity');
select ok(
  not has_function_privilege('anon',
    'public.search_nearby_demands_market(double precision,double precision,integer,integer,text,integer)', 'execute'),
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

select ok(
  to_regprocedure('public.search_live_demand(text,text,text,integer,integer,text)') is not null,
  'live demand search accepts an explicit country');
select ok(
  position(
    'country_code' in pg_get_viewdef('public.buy_demand_aggregates'::regclass, true)
  ) > 0,
  'BUY aggregates are country-scoped in SQL');
select ok(
  has_column('public', 'deal_snapshots', 'currency_code'),
  'deal snapshots retain the agreed currency');
select ok(
  not has_function_privilege('authenticated',
    'public.approx_demand_distances(double precision,double precision,uuid[])', 'execute'),
  'retired distance oracle stays revoked');
select ok(
  position(
    'consume_nearby_search_quota' in pg_get_functiondef(
      'public.search_nearby_demands_market(double precision,double precision,integer,integer,text,integer)'::regprocedure
    )
  ) > 0,
  'proximity RPC consumes a per-user rate quota');
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.demands'::regclass
      and not tgisinternal
      and tgname = 'trg_demands_market_write'
  ),
  'demand writes are gated to the pilot market');
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.responses'::regclass
      and not tgisinternal
      and tgname = 'trg_responses_market'
  ),
  'responses cannot attach to non-tradable markets');

select * from finish();
rollback;
