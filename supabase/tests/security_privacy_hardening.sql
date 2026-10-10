-- P0-02: geo scrub, SECURITY DEFINER EXECUTE boundary, quick-offer market gate.

begin;
select plan(9);

-- Intentional anon-callable SECURITY DEFINER helpers (discovery booleans only).
select ok(
  has_function_privilege(
    'anon',
    'public.marketplace_product_allowed(text)',
    'execute'
  ),
  'anon may call marketplace_product_allowed'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('public', p.oid, 'execute')
  ),
  'no public SECURITY DEFINER grants EXECUTE to PUBLIC role'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
      and p.proname not in (
        'marketplace_product_allowed',
        'is_phone_verified_for_live_demand'
      )
  ),
  'anon EXECUTE on SECURITY DEFINER limited to discovery allowlist'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'dan_private.enforce_demand_market_write()',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'dan_private.enforce_response_market()',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'dan_private.enforce_match_market()',
    'execute'
  ),
  'market trigger helpers are not client-executable'
);

select ok(
  not has_function_privilege('anon', 'public.accept_my_consents()', 'execute')
  and not has_function_privilege('anon', 'public.get_consent_requirements()', 'execute'),
  'anon cannot execute consent RPCs'
);

select ok(
  position(
    'assert_tradable_demand'
    in pg_get_functiondef(
      'public.upsert_quick_offer(uuid,numeric,uuid,text,integer,text,text)'::regprocedure
    )
  ) > 0,
  'upsert_quick_offer gates targets via assert_tradable_demand'
);

insert into auth.users (id, email) values
  ('cccccccc-1000-4000-8000-000000000001', 'geo-owner@example.test'),
  ('cccccccc-1000-4000-8000-000000000002', 'geo-peer@example.test');

-- Nested geo must be stripped before landing in public demands JSON.
insert into public.demands (
  id, user_id, type, title, description, category, budget, location, status,
  country_code, currency_code, expires_at, fulfillment_options
) values (
  'cccccccc-2000-4000-8000-000000000001',
  'cccccccc-1000-4000-8000-000000000001',
  'TASK', 'geo scrub', 'geo scrub', 'errand', 1000, 'Seoul', 'ACTIVE',
  'KR', 'KRW', now() + interval '7 days',
  '[{"mode":"MEETUP","place":{"publicLabel":"Seoul","geo":{"lat":37.5,"lng":127.0}}}]'::jsonb
);

select is(
  (
    select fulfillment_options::text like '%"geo"%'
    from public.demands
    where id = 'cccccccc-2000-4000-8000-000000000001'
  ),
  false,
  'trigger strips nested geo from fulfillment_options on insert'
);

select is(
  (
    select fulfillment_options -> 0 -> 'place' ->> 'publicLabel'
    from public.demands
    where id = 'cccccccc-2000-4000-8000-000000000001'
  ),
  'Seoul',
  'public place label is preserved after geo scrub'
);

-- Behavioral: quick offer cannot target a JP BUY demand.
select set_config('dan.allow_jp_market_write', 'on', true);

-- Reuse a seed catalog product (canonical_name unique).
do $$
declare
  v_product uuid;
begin
  select id into v_product from public.products order by created_at nulls last limit 1;
  if v_product is null then
    raise exception 'no product fixture available for quick-offer market test';
  end if;
  perform set_config('test.product_id', v_product::text, true);
end $$;

insert into public.demands (
  id, user_id, type, title, description, category, budget, location, status,
  country_code, currency_code, expires_at, fulfillment_options, product_id, max_price
) values (
  'cccccccc-2000-4000-8000-000000000002',
  'cccccccc-1000-4000-8000-000000000002',
  'BUY', 'jp buy', 'jp buy', 'camera', 100000, 'Tokyo', 'ACTIVE',
  'JP', 'JPY', now() + interval '7 days',
  '[{"mode":"MEETUP","place":{"publicLabel":"Tokyo"}}]'::jsonb,
  current_setting('test.product_id')::uuid,
  100000
);

insert into public.ownerships (
  id, user_id, product_id, condition, status
) values (
  'cccccccc-4000-4000-8000-000000000001',
  'cccccccc-1000-4000-8000-000000000001',
  current_setting('test.product_id')::uuid,
  'like_new',
  'OWNED'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-1000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

prepare jp_quick_offer as
  select public.upsert_quick_offer(
    'cccccccc-4000-4000-8000-000000000001'::uuid,
    90000,
    'cccccccc-2000-4000-8000-000000000002'::uuid,
    'meetup',
    null,
    '',
    null
  );

select throws_ok(
  'jp_quick_offer',
  '42501',
  'market not tradable',
  'quick offer rejects non-KR/KRW target demands'
);

reset role;

select * from finish();
rollback;
