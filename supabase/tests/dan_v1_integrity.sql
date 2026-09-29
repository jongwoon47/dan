begin;

select plan(70);

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

select has_table(
  'public',
  'marketplace_restricted_terms',
  'operator-managed marketplace restriction registry exists'
);

select has_function(
  'public',
  'marketplace_product_allowed',
  array['text'],
  'marketplace product policy predicate exists'
);

select has_trigger(
  'public',
  'products',
  'trg_product_marketplace_policy',
  'restricted product names are blocked at catalog write time'
);

select has_trigger(
  'public',
  'demands',
  'trg_buy_demand_product_policy',
  'restricted products cannot become BUY demand'
);

select is(
  public.marketplace_product_allowed('권총'),
  false,
  'obviously restricted weapon product is denied'
);

select is(
  public.marketplace_product_allowed('Herman Miller Embody Chair'),
  true,
  'ordinary secondhand product remains allowed'
);

select ok(
  position(
    'sell_intent_id'
    in coalesce((
      select qual
      from pg_policies
      where schemaname = 'public'
        and tablename = 'sell_intents'
        and policyname = 'sell_intents_select_open_or_own'
    ), '')
  ) > 0,
  'matched buyers keep read access to their Quick Offer'
);

select ok(
  position(
    'sell_intent_id'
    in coalesce((
      select qual
      from pg_policies
      where schemaname = 'public'
        and tablename = 'ownerships'
        and policyname = 'ownerships_select_own_or_open_sell'
    ), '')
  ) > 0,
  'matched buyers keep read access to offer ownership condition'
);

select ok(
  position(
    'sell_intent_id'
    in coalesce((
      select qual
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname = 'dan_v1_evidence_select_parties'
    ), '')
  ) > 0,
  'matched buyers can read private Quick Offer media'
);

select ok(
  position(
    'marketplace_product_allowed'
    in coalesce((
      select qual
      from pg_policies
      where schemaname = 'public'
        and tablename = 'products'
        and policyname = 'products_select_all'
    ), '')
  ) > 0,
  'restricted products disappear from catalog discovery immediately'
);

select ok(
  position(
    'marketplace_product_allowed'
    in coalesce((
      select qual
      from pg_policies
      where schemaname = 'public'
        and tablename = 'demands'
        and policyname = 'demands_select_public_or_own'
    ), '')
  ) > 0,
  'restricted BUY demand disappears from public discovery immediately'
);

select ok(
  position(
    'marketplace_product_allowed'
    in pg_get_viewdef('public.buy_demand_aggregates'::regclass, true)
  ) > 0,
  'restricted products are removed from Live Demand aggregates immediately'
);

select ok(
  position(
    'provider reference required'
    in pg_get_functiondef('public.settlement_mark_paid(uuid,text)'::regprocedure)
  ) > 0,
  'payment completion requires a provider reference'
);

select ok(
  position(
    'payment_status = ''REFUNDED'''
    in pg_get_functiondef('public.settlement_mark_refunded(uuid)'::regprocedure)
  ) > 0,
  'refund transition is retry-safe'
);

select ok(
  position(
    'cancelled_by = auth.uid()'
    in pg_get_functiondef('public.cancel_deal(uuid,text)'::regprocedure)
  ) > 0,
  'deal cancellation is retry-safe for the cancelling participant'
);

select ok(
  position(
    'v_existing.opened_by = auth.uid()'
    in pg_get_functiondef('public.open_deal_dispute(uuid,text,text)'::regprocedure)
  ) > 0,
  'duplicate dispute submission returns the existing dispute'
);

select ok(
  position(
    'v_match.status = ''COMPLETED'''
    in pg_get_functiondef('public.confirm_match_completion(uuid)'::regprocedure)
  ) > 0,
  'completion confirmation is retry-safe after completion'
);

select ok(
  position(
    'price incompatible'
    in pg_get_functiondef('public.seller_connect_match(uuid)'::regprocedure)
  ) > 0,
  'seller connect revalidates price compatibility'
);

select ok(
  position(
    'trade method incompatible'
    in pg_get_functiondef('public.seller_connect_match(uuid)'::regprocedure)
  ) > 0,
  'seller connect revalidates fulfillment compatibility'
);

select ok(
  position(
    'target demand mismatch'
    in pg_get_functiondef('public.seller_connect_match(uuid)'::regprocedure)
  ) > 0,
  'seller connect revalidates targeted demand'
);

select ok(
  position(
    'condition incompatible'
    in pg_get_functiondef('public.seller_connect_match(uuid)'::regprocedure)
  ) > 0,
  'seller connect revalidates condition compatibility'
);

select ok(
  position(
    'v_match.status = ''CONNECTED'''
    in pg_get_functiondef('public.seller_connect_match(uuid)'::regprocedure)
  ) > 0,
  'seller connect is retry-safe after connection'
);

select ok(
  position(
    'return v_existing'
    in pg_get_functiondef('public.upsert_deal_evidence(uuid,jsonb)'::regprocedure)
  ) > 0
  and position(
    'challengeCode'
    in pg_get_functiondef('public.upsert_deal_evidence(uuid,jsonb)'::regprocedure)
  ) > 0,
  'evidence submission is retry-safe for the committed challenge'
);

select ok(
  position(
    '/deal-evidence/%'
    in pg_get_functiondef('public.upsert_deal_evidence(uuid,jsonb)'::regprocedure)
  ) > 0,
  'deal evidence media must live in the seller private evidence path'
);

select has_function(
  'public',
  'ensure_ownership',
  array['uuid','text'],
  'retry-safe ownership RPC exists'
);

select ok(
  not has_table_privilege('authenticated', 'public.ownerships', 'INSERT'),
  'authenticated clients cannot bypass ownership creation RPC'
);

select has_trigger(
  'public',
  'sell_intents',
  'trg_sell_intent_marketplace_policy',
  'Quick Offer edits remain marketplace-policy gated'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'matches'
      and indexname = 'matches_active_demand_sell_uidx'
      and indexdef ilike '%BUYER_INTERESTED%'
      and indexdef ilike '%CONNECTED%'
  ),
  'only active demand/sell pairs are unique so closed history can rematch'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'sell_intents'
      and indexname = 'sell_intents_active_ownership_uidx'
      and indexdef ilike '%OPEN%'
      and indexdef ilike '%MATCHED%'
  ),
  'one physical ownership cannot have two active or committed offers'
);

select ok(
  position(
    'status = ''CLOSED'''
    in pg_get_functiondef('public.confirm_match_completion(uuid)'::regprocedure)
  ) > 0
  and position(
    'status = ''RELEASED'''
    in pg_get_functiondef('public.confirm_match_completion(uuid)'::regprocedure)
  ) > 0,
  'completed BUY closes demand/offer and releases sold ownership'
);

select ok(
  position(
    'update public.demands'
    in pg_get_functiondef('public.expire_unpaid_deals()'::regprocedure)
  ) = 0,
  'payment timeout does not silently republish buyer demand'
);

select ok(
  position(
    'now() + interval ''7 days'''
    in pg_get_functiondef('public.reopen_demand_after_trade_close(uuid)'::regprocedure)
  ) > 0,
  'explicit BUY reopen restores a fresh seven-day demand window'
);

select * from finish();
rollback;
