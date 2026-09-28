begin;

select plan(14);

select has_table('public', 'deal_evidence_challenges', 'evidence challenge table exists');
select has_table('public', 'user_verifications', 'verification table exists');
select has_function('public', 'issue_deal_evidence_challenge', array['uuid'], 'challenge RPC exists');
select has_function('public', 'cancel_deal', array['uuid','text'], 'structured BUY cancellation exists');
select has_function('public', 'get_my_verification', array[]::text[], 'verification status RPC exists');
select has_function('public', 'get_public_verification_badges', array['uuid'], 'public verification badge RPC exists');

select ok(
  position(
    'locked deal evidence is immutable'
    in pg_get_functiondef('public.upsert_deal_evidence(uuid,jsonb)'::regprocedure)
  ) > 0,
  'evidence RPC rejects mutation after locked snapshot'
);

select ok(
  position(
    'storage://dan-v1-evidence/%'
    in pg_get_functiondef('public.upsert_deal_evidence(uuid,jsonb)'::regprocedure)
  ) > 0,
  'evidence RPC requires private storage reference'
);

select ok(
  position(
    'BUY trade must use cancel_deal or dispute/refund flow'
    in pg_get_functiondef('public.close_match(uuid)'::regprocedure)
  ) > 0,
  'legacy close_match cannot bypass BUY lifecycle'
);

select ok(
  position(
    'dan.deal_snapshot.v1'
    in pg_get_functiondef('public.confirm_deal_snapshot(uuid,numeric,jsonb)'::regprocedure)
  ) > 0,
  'Deal Snapshot is built from canonical V1 payload'
);

select has_function(
  'public',
  'is_phone_verified_for_live_demand',
  array['uuid'],
  'privacy-safe verification predicate exists'
);

select ok(
  position(
    'is_phone_verified_for_live_demand'
    in pg_get_viewdef('public.buy_demand_aggregates'::regclass, true)
  ) > 0,
  'public Live Demand aggregate is verification-gated without reading verification rows'
);

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'dan-v1-evidence'
      and public = false
  ),
  'DAN evidence bucket is private'
);

select ok(
  position(
    '7 days'
    in pg_get_functiondef('public.enforce_live_buy_phone_verification()'::regprocedure)
  ) > 0,
  'Live BUY demand TTL is capped at seven days in the database'
);


select * from finish();
rollback;
