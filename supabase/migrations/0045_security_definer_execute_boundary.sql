-- DAN remote hardening before public staging.
-- SECURITY DEFINER functions should never inherit PostgreSQL's default PUBLIC EXECUTE.
-- Explicitly expose only the RPCs required by authenticated users, public read helpers,
-- or trusted service-role operations.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.signature);
  end loop;
end
$$;

-- Public discovery helpers. These expose booleans only and are used by
-- public discovery/RLS paths.
grant execute on function public.marketplace_product_allowed(text) to anon, authenticated;
grant execute on function public.is_phone_verified_for_live_demand(uuid) to anon, authenticated;

-- Authenticated application RPCs.
grant execute on function public.accept_response(uuid) to authenticated;
grant execute on function public.approx_demand_distances(double precision,double precision,uuid[]) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.cancel_deal(uuid,text) to authenticated;
grant execute on function public.close_demand(uuid) to authenticated;
grant execute on function public.close_match(uuid) to authenticated;
grant execute on function public.confirm_deal_snapshot(uuid,numeric,jsonb) to authenticated;
grant execute on function public.confirm_match_completion(uuid) to authenticated;
grant execute on function public.decline_response(uuid) to authenticated;
grant execute on function public.ensure_ownership(uuid,text) to authenticated;
grant execute on function public.ensure_product(text,text) to authenticated;
grant execute on function public.express_buyer_interest(uuid,uuid) to authenticated;
grant execute on function public.get_my_verification() to authenticated;
grant execute on function public.get_public_profile_trust(uuid) to authenticated;
grant execute on function public.get_public_verification_badges(uuid) to authenticated;
grant execute on function public.interaction_blocked_with(uuid) to authenticated;
grant execute on function public.is_dan_admin(uuid) to authenticated;
grant execute on function public.issue_deal_evidence_challenge(uuid) to authenticated;
grant execute on function public.mark_activity_read(uuid) to authenticated;
grant execute on function public.mark_messages_read(uuid) to authenticated;
grant execute on function public.open_deal_dispute(uuid,text,text) to authenticated;
grant execute on function public.reopen_demand_after_trade_close(uuid) to authenticated;
grant execute on function public.seller_connect_match(uuid) to authenticated;
grant execute on function public.send_message(uuid,text) to authenticated;
grant execute on function public.submit_user_report(uuid,text,text) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.update_demand(
  uuid,text,text,numeric,jsonb,timestamptz,timestamptz,
  text,text,text,numeric,text,text,text,timestamptz,timestamptz,timestamptz,integer
) to authenticated;
grant execute on function public.upsert_buy_demand(
  uuid,text,text,text,numeric,text,text,text,timestamptz
) to authenticated;
grant execute on function public.upsert_buy_demand(
  uuid,text,text,text,numeric,text,text,text,timestamptz,jsonb
) to authenticated;
grant execute on function public.upsert_deal_evidence(uuid,jsonb) to authenticated;
grant execute on function public.upsert_demand_exact_geo(uuid,double precision,double precision) to authenticated;
grant execute on function public.upsert_quick_offer(uuid,numeric,uuid,text,integer,text,text) to authenticated;
grant execute on function public.upsert_response(uuid,text,numeric,text) to authenticated;
grant execute on function public.withdraw_response(uuid) to authenticated;

-- Authenticated admin UI RPC. Authorization is still checked inside the function.
grant execute on function public.admin_update_risk_flag(uuid,text) to authenticated;

-- Trusted backend/provider operations only.
grant execute on function public.expire_unpaid_deals() to service_role;
grant execute on function public.ops_attribute_cancel_fault(uuid,text) to service_role;
grant execute on function public.ops_resolve_deal_dispute(uuid,text,text,text) to service_role;
grant execute on function public.ops_set_user_verification(uuid,boolean,boolean,boolean,text,text,text) to service_role;
grant execute on function public.settlement_mark_paid(uuid,text) to service_role;
grant execute on function public.settlement_mark_refunded(uuid) to service_role;

-- Remove mutable search_path warnings from trigger/helper functions.
alter function public.enforce_response_not_self() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.users_blocked(uuid,uuid) set search_path = public;
alter function public.prevent_locked_deal_snapshot_mutation() set search_path = public;
