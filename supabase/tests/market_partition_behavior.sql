begin;
select plan(4);

insert into auth.users (id, email) values
  ('bbbbbbbb-1000-4000-8000-000000000001', 'market-kr@example.test'),
  ('bbbbbbbb-1000-4000-8000-000000000002', 'market-jp@example.test');

-- Default path: JP writes fail closed (no GUC bypass).
prepare jp_insert as
  insert into public.demands (
    id, user_id, type, title, description, category, budget, location, status,
    country_code, currency_code, expires_at, fulfillment_options
  ) values (
    'bbbbbbbb-2000-4000-8000-000000000099',
    'bbbbbbbb-1000-4000-8000-000000000002',
    'TASK', 'jp probe', 'jp probe', 'errand', 1000, 'Tokyo', 'ACTIVE',
    'JP', 'JPY', now() + interval '7 days',
    '[{"mode":"MEETUP","place":{"publicLabel":"Tokyo"}}]'::jsonb
  );

select throws_ok(
  'jp_insert',
  '42501',
  'japan market writes are not enabled',
  'pilot rejects JP demand writes without explicit bypass'
);

-- Reviewed bypass may create a JP fixture for isolation checks.
select set_config('dan.allow_jp_market_write', 'on', true);

insert into public.demands (
  id, user_id, type, title, description, category, budget, location, status,
  country_code, currency_code, expires_at, fulfillment_options
) values
(
  'bbbbbbbb-2000-4000-8000-000000000001',
  'bbbbbbbb-1000-4000-8000-000000000001',
  'TASK', 'kr task', 'kr task', 'errand', 5000, 'Seoul', 'ACTIVE',
  'KR', 'KRW', now() + interval '7 days',
  '[{"mode":"MEETUP","place":{"publicLabel":"Seoul"}}]'::jsonb
),
(
  'bbbbbbbb-2000-4000-8000-000000000002',
  'bbbbbbbb-1000-4000-8000-000000000002',
  'TASK', 'jp task', 'jp task', 'errand', 5000, 'Tokyo', 'ACTIVE',
  'JP', 'JPY', now() + interval '7 days',
  '[{"mode":"MEETUP","place":{"publicLabel":"Tokyo"}}]'::jsonb
);

select is(
  (select count(*)::integer
     from public.demands
    where id = 'bbbbbbbb-2000-4000-8000-000000000002'
      and country_code = 'JP'
      and currency_code = 'JPY'),
  1,
  'reviewed bypass can create a JP fixture for isolation tests'
);

-- Responses cannot attach to JP demands during the pilot.
prepare jp_response as
  insert into public.responses (
    demand_id, responder_id, status, message
  ) values (
    'bbbbbbbb-2000-4000-8000-000000000002',
    'bbbbbbbb-1000-4000-8000-000000000001',
    'OPEN', 'hello'
  );

select throws_ok(
  'jp_response',
  '42501',
  'market not tradable',
  'trade lifecycle rejects non-KR markets'
);

insert into public.responses (
  demand_id, responder_id, status, message
) values (
  'bbbbbbbb-2000-4000-8000-000000000001',
  'bbbbbbbb-1000-4000-8000-000000000002',
  'OPEN', 'hello kr'
);

select ok(
  exists (
    select 1 from public.responses
    where demand_id = 'bbbbbbbb-2000-4000-8000-000000000001'
      and responder_id = 'bbbbbbbb-1000-4000-8000-000000000002'
  ),
  'KR market responses still succeed'
);

select * from finish();
rollback;
