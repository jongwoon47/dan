begin;
select plan(7);

select ok(
  to_regprocedure('public.search_nearby_demands(double precision,double precision,integer,integer)') is not null,
  'server-side nearby search exists'
);
select ok(
  has_function_privilege('authenticated', 'public.search_nearby_demands(double precision,double precision,integer,integer)', 'execute'),
  'authenticated users can execute the bounded nearby search'
);
select ok(
  not has_function_privilege('anon', 'public.search_nearby_demands(double precision,double precision,integer,integer)', 'execute'),
  'anonymous users cannot probe proximity'
);
select ok(
  (select prosecdef from pg_proc where oid =
    'public.search_nearby_demands(double precision,double precision,integer,integer)'::regprocedure),
  'RPC runs in a deliberately reviewed privileged context'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.demand_exact_geo'::regclass),
  'private demand coordinate table still has RLS'
);
select ok(
  not has_table_privilege('anon', 'public.demand_exact_geo', 'select'),
  'anonymous users cannot read exact coordinates'
);

select ok(
  not has_function_privilege('authenticated', 'public.approx_demand_distances(double precision,double precision,uuid[])', 'execute'),
  'authenticated clients cannot invoke the retired arbitrary-target distance oracle'
);

select * from finish();
rollback;
