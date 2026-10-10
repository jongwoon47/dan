-- Target-state asserts after full reset / forward apply through 20261010040000.
-- Validates market columns, JP write gate default (false), and list_pilot_regions
-- even when the full staging-drift simulator needs Docker + a tip-shaped DB.

begin;
select plan(8);

select has_column('public', 'demands', 'country_code',
  'demands.country_code present after market migration');
select has_column('public', 'demands', 'currency_code',
  'demands.currency_code present after market migration');

select ok(
  to_regprocedure('public.list_pilot_regions(text)') is not null,
  'list_pilot_regions(text) exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.list_pilot_regions(text)',
    'execute'
  ),
  'authenticated can execute list_pilot_regions'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.list_pilot_regions(text)',
    'execute'
  ),
  'anon cannot execute list_pilot_regions'
);

select ok(
  to_regprocedure('dan_private.jp_market_writes_allowed()') is not null,
  'jp_market_writes_allowed() exists'
);

select is(
  dan_private.jp_market_writes_allowed(),
  false,
  'JP market writes remain disabled by default'
);

select ok(
  exists (
    select 1 from dan_private.market_pilot_regions
    where country_code = 'JP' and enabled = true
  ),
  'JP pilot browse regions seeded (writes still gated)'
);

select * from finish();
rollback;
