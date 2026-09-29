begin;

select plan(38);

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

select ok(
  position(
    'Fujifilm X100VI'
    in pg_get_functiondef('public.enforce_live_buy_phone_verification()'::regprocedure)
  ) = 0,
  'Live BUY demand is not restricted to a camera SKU allowlist'
);

select ok(
  position(
    'serial fragment required'
    in pg_get_functiondef('public.upsert_deal_evidence(uuid,jsonb)'::regprocedure)
  ) = 0,
  'serial fragment is optional for product-agnostic evidence'
);

select has_function(
  'public',
  'expire_unpaid_deals',
  array[]::text[],
  'payment timeout recovery RPC exists'
);

select ok(
  position(
    '6 hours'
    in pg_get_functiondef('public.set_buy_payment_window()'::regprocedure)
  ) > 0,
  'snapshot lock opens a six-hour payment window'
);

select has_function(
  'public',
  'canonical_product_key',
  array['text'],
  'server product canonicalization exists'
);

select has_function(
  'public',
  'ensure_product',
  array['text','text'],
  'atomic product ensure RPC exists'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'products_insert_authenticated'
  ),
  'ordinary clients cannot bypass canonical product creation'
);

select is(
  public.canonical_product_key('아이폰 15 프로'),
  'iphone15pro',
  'Hangul iPhone alias canonicalizes to the shared catalog key'
);

select is(
  public.canonical_product_key('소니 A7 IV'),
  'sonya7iv',
  'Hangul brand alias canonicalizes to the shared catalog key'
);

select has_column(
  'public',
  'sell_intents',
  'trade_method',
  'Quick Offer stores seller fulfillment method'
);

select ok(
  position(
    'trade method incompatible'
    in pg_get_functiondef('public.express_buyer_interest(uuid,uuid)'::regprocedure)
  ) > 0,
  'buyer interest enforces fulfillment compatibility'
);

select ok(
  position(
    'target demand mismatch'
    in pg_get_functiondef('public.express_buyer_interest(uuid,uuid)'::regprocedure)
  ) > 0,
  'targeted Quick Offers cannot leak to another demand'
);

select has_function(
  'public',
  'upsert_quick_offer',
  array['uuid','numeric','uuid','text','integer','text','text'],
  'Quick Offer write RPC exists'
);

select has_trigger(
  'public',
  'sell_intents',
  'trg_sell_intent_ownership_consistency',
  'sell intent ownership consistency trigger exists'
);

select ok(
  position(
    'ownership product mismatch'
    in pg_get_functiondef('public.enforce_sell_intent_ownership_consistency()'::regprocedure)
  ) > 0,
  'sell intent product cannot diverge from owned product'
);

select ok(
  not has_table_privilege('authenticated', 'public.sell_intents', 'INSERT'),
  'authenticated clients cannot directly insert Quick Offers'
);

select ok(
  not has_table_privilege('authenticated', 'public.sell_intents', 'UPDATE'),
  'authenticated clients cannot directly update Quick Offers'
);

select has_function(
  'public',
  'block_user',
  array['uuid'],
  'idempotent block RPC exists'
);

select has_function(
  'public',
  'unblock_user',
  array['uuid'],
  'unblock RPC exists'
);

select has_function(
  'public',
  'submit_user_report',
  array['uuid','text','text'],
  'rate-limited report RPC exists'
);

select ok(
  not has_table_privilege('authenticated', 'public.blocks', 'INSERT'),
  'authenticated clients cannot directly insert blocks'
);

select ok(
  not has_table_privilege('authenticated', 'public.blocks', 'DELETE'),
  'authenticated clients cannot directly delete blocks'
);

select ok(
  not has_table_privilege('authenticated', 'public.reports', 'INSERT'),
  'authenticated clients cannot directly spam reports'
);

select ok(
  position(
    'interaction_blocked_with'
    in coalesce((
      select qual
      from pg_policies
      where schemaname = 'public'
        and tablename = 'sell_intents'
        and policyname = 'sell_intents_select_open_or_own'
    ), '')
  ) > 0,
  'blocked users are filtered from open Quick Offer visibility'
);

select * from finish();
rollback;
