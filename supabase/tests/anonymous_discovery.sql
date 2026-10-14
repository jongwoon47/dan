begin;
select plan(4);

select ok(not has_function_privilege('anon', 'public.interaction_blocked_with(uuid)', 'execute'),
  'anonymous discovery does not expose the authenticated block RPC');

set local role anon;
select lives_ok('select id from public.demands limit 1',
  'anonymous users can read public demand discovery');
select lives_ok('select product_id from public.buy_demand_aggregates limit 1',
  'anonymous users can read live demand aggregates');
reset role;

select ok((select relrowsecurity from pg_class where oid = 'public.demands'::regclass),
  'demand RLS remains enabled');
select * from finish();
rollback;
