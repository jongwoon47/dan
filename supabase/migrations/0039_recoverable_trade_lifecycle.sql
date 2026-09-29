-- Recoverable BUY lifecycle.
-- Historical CLOSED matches stay immutable history, but do not permanently
-- block a fresh buyer/seller attempt after the underlying demand/offer reopen.

drop index if exists public.matches_demand_sell_uidx;
create unique index if not exists matches_active_demand_sell_uidx
  on public.matches (demand_id, sell_intent_id)
  where sell_intent_id is not null
    and status in ('BUYER_INTERESTED','SELLER_ACCEPTED','CONNECTED');

drop index if exists public.sell_intents_open_ownership_uidx;
create unique index if not exists sell_intents_active_ownership_uidx
  on public.sell_intents (ownership_id)
  where status in ('OPEN','MATCHED');

create or replace function public.express_buyer_interest(
  p_demand_id uuid,
  p_sell_intent_id uuid
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demand public.demands%rowtype;
  v_sell public.sell_intents%rowtype;
  v_own public.ownerships%rowtype;
  v_existing public.matches%rowtype;
  v_match public.matches%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_demand
  from public.demands
  where id = p_demand_id
  for update;

  if not found then raise exception 'demand not found'; end if;
  if v_demand.user_id <> auth.uid() then
    raise exception 'only demand owner can express interest';
  end if;
  if v_demand.type <> 'BUY' or v_demand.status <> 'ACTIVE' then
    raise exception 'demand not active buy';
  end if;
  if v_demand.expires_at is not null and v_demand.expires_at <= now() then
    raise exception 'demand expired';
  end if;

  select * into v_sell
  from public.sell_intents
  where id = p_sell_intent_id
  for update;

  if not found or v_sell.status <> 'OPEN' then
    raise exception 'sell intent not open';
  end if;
  if v_sell.target_demand_id is not null
     and v_sell.target_demand_id <> v_demand.id then
    raise exception 'target demand mismatch';
  end if;
  if v_sell.product_id <> v_demand.product_id then
    raise exception 'product mismatch';
  end if;
  if v_sell.user_id = v_demand.user_id then
    raise exception 'self match forbidden';
  end if;
  if v_demand.max_price < v_sell.minimum_price then
    raise exception 'price incompatible';
  end if;
  if public.users_blocked(auth.uid(), v_sell.user_id) then
    raise exception 'blocked';
  end if;

  if coalesce(v_demand.trade_method, 'any') <> 'any'
     and coalesce(v_sell.trade_method, 'any') <> 'any'
     and v_demand.trade_method <> v_sell.trade_method then
    raise exception 'trade method incompatible';
  end if;

  select * into v_own
  from public.ownerships
  where id = v_sell.ownership_id;

  if not found or v_own.status <> 'OWNED' then
    raise exception 'ownership not owned';
  end if;

  if coalesce(v_demand.condition_preference, 'any') <> 'any' then
    if (
      case v_own.condition
        when 'sealed' then 3
        when 'like_new' then 2
        when 'lightly_used' then 1
        else 0
      end
    ) < (
      case v_demand.condition_preference
        when 'sealed' then 3
        when 'like_new' then 2
        when 'lightly_used' then 1
        else 0
      end
    ) then
      raise exception 'condition incompatible';
    end if;
  end if;

  select * into v_existing
  from public.matches
  where demand_id = p_demand_id
    and sell_intent_id = p_sell_intent_id
    and status in ('BUYER_INTERESTED','SELLER_ACCEPTED','CONNECTED','DECLINED')
  order by created_at desc
  limit 1
  for update;

  if found then
    if v_existing.status = 'BUYER_INTERESTED' then return v_existing; end if;
    if v_existing.status = 'DECLINED' then
      raise exception 'offer was declined for this demand';
    end if;
    raise exception 'match already active in status %', v_existing.status;
  end if;

  insert into public.matches (
    demand_id,
    sell_intent_id,
    product_id,
    buyer_id,
    seller_id,
    status,
    deal_stage,
    payment_status
  )
  values (
    p_demand_id,
    p_sell_intent_id,
    v_demand.product_id,
    v_demand.user_id,
    v_sell.user_id,
    'BUYER_INTERESTED',
    'BUYER_INTERESTED',
    'NOT_STARTED'
  )
  returning * into v_match;

  perform public.insert_activity(
    v_sell.user_id,
    auth.uid(),
    'BUYER_INTEREST',
    v_demand.id,
    null,
    v_match.id
  );

  return v_match;
end;
$$;

revoke all on function public.express_buyer_interest(uuid, uuid) from public;
grant execute on function public.express_buyer_interest(uuid, uuid) to authenticated;

create or replace function public.cancel_deal(
  p_match_id uuid,
  p_reason text
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_peer uuid;
  v_actor_is_buyer boolean;
  v_product_name text;
  v_product_allowed boolean := false;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then raise exception 'match not found'; end if;
  if auth.uid() <> v_match.buyer_id and auth.uid() <> v_match.seller_id then
    raise exception 'forbidden';
  end if;

  if v_match.status = 'CLOSED'
     and v_match.deal_stage = 'CANCELLED'
     and v_match.cancelled_by = auth.uid() then
    return v_match;
  end if;

  if v_match.status <> 'CONNECTED' then
    raise exception 'trade not cancellable';
  end if;
  if p_reason not in (
    'BUYER_CHANGED_MIND',
    'SELLER_CHANGED_MIND',
    'SELLER_CHANGED_TERMS',
    'BUYER_NO_PAYMENT',
    'ITEM_UNAVAILABLE',
    'MUTUAL_CANCEL',
    'SYSTEM_CANCEL',
    'RISK_CANCEL'
  ) then
    raise exception 'invalid cancel reason';
  end if;
  if v_match.payment_status = 'PAID' then
    raise exception 'paid trade must use dispute/refund flow';
  end if;

  v_actor_is_buyer := auth.uid() = v_match.buyer_id;
  v_peer := case
    when v_actor_is_buyer then v_match.seller_id
    else v_match.buyer_id
  end;

  if v_match.product_id is not null then
    select canonical_name into v_product_name
    from public.products
    where id = v_match.product_id;
    v_product_allowed :=
      v_product_name is not null
      and public.marketplace_product_allowed(v_product_name);
  end if;

  update public.matches
  set
    status = 'CLOSED',
    deal_stage = 'CANCELLED',
    cancel_reason = p_reason,
    cancelled_by = auth.uid(),
    cancel_fault_party = null,
    updated_at = now()
  where id = p_match_id
  returning * into v_match;

  if v_match.sell_intent_id is not null then
    update public.sell_intents
    set
      status = case
        when v_actor_is_buyer and v_product_allowed then 'OPEN'
        else 'CLOSED'
      end,
      updated_at = now()
    where id = v_match.sell_intent_id
      and status = 'MATCHED';
  end if;

  -- Seller cancellation should not strand a buyer who still wants the item.
  -- Buyer cancellation remains opt-in to reopen because the buyer explicitly
  -- chose to stop this purchase.
  if not v_actor_is_buyer then
    update public.demands
    set
      status = case when v_product_allowed then 'ACTIVE' else 'CLOSED' end,
      expires_at = case
        when v_product_allowed then now() + interval '7 days'
        else expires_at
      end,
      updated_at = now()
    where id = v_match.demand_id
      and type = 'BUY'
      and status = 'MATCHED';
  end if;

  perform public.insert_activity(
    v_peer,
    auth.uid(),
    'MATCH_TRADE_CLOSED',
    v_match.demand_id,
    null,
    v_match.id
  );

  return v_match;
end;
$$;

revoke all on function public.cancel_deal(uuid, text) from public;
grant execute on function public.cancel_deal(uuid, text) to authenticated;

create or replace function public.expire_unpaid_deals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.matches%rowtype;
  v_count integer := 0;
  v_product_name text;
  v_product_allowed boolean;
begin
  for v_row in
    select *
    from public.matches
    where status = 'CONNECTED'
      and deal_stage = 'PAYMENT_PENDING'
      and payment_status = 'PENDING'
      and payment_due_at is not null
      and payment_due_at <= now()
    for update skip locked
  loop
    v_product_allowed := false;
    if v_row.product_id is not null then
      select canonical_name into v_product_name
      from public.products
      where id = v_row.product_id;
      v_product_allowed :=
        v_product_name is not null
        and public.marketplace_product_allowed(v_product_name);
    end if;

    update public.matches
    set
      status = 'CLOSED',
      deal_stage = 'CANCELLED',
      cancel_reason = 'BUYER_NO_PAYMENT',
      cancel_fault_party = 'BUYER',
      updated_at = now()
    where id = v_row.id;

    -- Do not automatically republish a buyer who just failed to pay.
    -- The buyer may explicitly reopen from the closed trade.
    if v_row.sell_intent_id is not null then
      update public.sell_intents
      set
        status = case when v_product_allowed then 'OPEN' else 'CLOSED' end,
        updated_at = now()
      where id = v_row.sell_intent_id
        and status = 'MATCHED';
    end if;

    perform public.insert_activity(
      v_row.buyer_id,
      null,
      'MATCH_TRADE_CLOSED',
      v_row.demand_id,
      null,
      v_row.id
    );
    perform public.insert_activity(
      v_row.seller_id,
      null,
      'MATCH_TRADE_CLOSED',
      v_row.demand_id,
      null,
      v_row.id
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.expire_unpaid_deals() from public;
grant execute on function public.expire_unpaid_deals() to service_role;

create or replace function public.settlement_mark_refunded(
  p_match_id uuid
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
begin
  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then raise exception 'match not found'; end if;
  if v_match.payment_status = 'REFUNDED' then return v_match; end if;
  if v_match.payment_status <> 'PAID' then
    raise exception 'payment not paid';
  end if;

  update public.matches
  set
    status = 'CLOSED',
    payment_status = 'REFUNDED',
    deal_stage = 'REFUNDED',
    updated_at = now()
  where id = p_match_id
  returning * into v_match;

  if v_match.sell_intent_id is not null then
    update public.sell_intents
    set status = 'CLOSED', updated_at = now()
    where id = v_match.sell_intent_id
      and status = 'MATCHED';
  end if;

  perform public.insert_activity(
    v_match.buyer_id,
    null,
    'MATCH_TRADE_CLOSED',
    v_match.demand_id,
    null,
    v_match.id
  );
  perform public.insert_activity(
    v_match.seller_id,
    null,
    'MATCH_TRADE_CLOSED',
    v_match.demand_id,
    null,
    v_match.id
  );

  return v_match;
end;
$$;

revoke all on function public.settlement_mark_refunded(uuid) from public;
grant execute on function public.settlement_mark_refunded(uuid) to service_role;

create or replace function public.confirm_match_completion(
  p_match_id uuid
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_demand public.demands%rowtype;
  v_is_buyer boolean;
  v_peer uuid;
  v_both boolean;
  v_ownership_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then raise exception 'match not found'; end if;
  if auth.uid() <> v_match.buyer_id and auth.uid() <> v_match.seller_id then
    raise exception 'forbidden';
  end if;
  if v_match.status = 'COMPLETED' then return v_match; end if;
  if v_match.status <> 'CONNECTED' then
    raise exception 'invalid transition from % to COMPLETED', v_match.status;
  end if;

  select * into v_demand
  from public.demands
  where id = v_match.demand_id
  for update;

  if v_demand.type = 'BUY' then
    if v_match.payment_status <> 'PAID' then
      raise exception 'safe payment required';
    end if;
    if not exists (
      select 1
      from public.deal_snapshots s
      where s.match_id = p_match_id
        and s.locked_at is not null
    ) then
      raise exception 'locked deal snapshot required';
    end if;
    if exists (
      select 1
      from public.deal_disputes d
      where d.match_id = p_match_id
        and d.status in ('OPEN','REVIEWING')
    ) then
      raise exception 'open dispute blocks completion';
    end if;
  end if;

  v_is_buyer := auth.uid() = v_match.buyer_id;
  v_peer := case
    when v_is_buyer then v_match.seller_id
    else v_match.buyer_id
  end;

  if v_is_buyer and v_match.buyer_completed_at is not null then return v_match; end if;
  if (not v_is_buyer) and v_match.seller_completed_at is not null then return v_match; end if;

  if v_is_buyer then
    update public.matches
    set buyer_completed_at = now(), updated_at = now()
    where id = p_match_id
    returning * into v_match;
  else
    update public.matches
    set seller_completed_at = now(), updated_at = now()
    where id = p_match_id
    returning * into v_match;
  end if;

  v_both :=
    v_match.buyer_completed_at is not null
    and v_match.seller_completed_at is not null;

  if v_both then
    if v_match.sell_intent_id is not null then
      select ownership_id into v_ownership_id
      from public.sell_intents
      where id = v_match.sell_intent_id;
    end if;

    update public.matches
    set
      status = 'COMPLETED',
      completed_at = now(),
      deal_stage = case
        when v_demand.type = 'BUY' then 'COMPLETED'
        else deal_stage
      end,
      updated_at = now()
    where id = p_match_id
    returning * into v_match;

    if v_demand.type = 'BUY' then
      update public.demands
      set status = 'CLOSED', updated_at = now()
      where id = v_match.demand_id
        and status = 'MATCHED';

      if v_match.sell_intent_id is not null then
        update public.sell_intents
        set status = 'CLOSED', updated_at = now()
        where id = v_match.sell_intent_id
          and status = 'MATCHED';
      end if;

      if v_ownership_id is not null then
        update public.ownerships
        set status = 'RELEASED'
        where id = v_ownership_id
          and status = 'OWNED';
      end if;
    end if;

    perform public.insert_activity(
      v_match.buyer_id,
      v_match.seller_id,
      'MATCH_COMPLETED',
      v_match.demand_id,
      null,
      v_match.id
    );
    perform public.insert_activity(
      v_match.seller_id,
      v_match.buyer_id,
      'MATCH_COMPLETED',
      v_match.demand_id,
      null,
      v_match.id
    );
  else
    perform public.insert_activity(
      v_peer,
      auth.uid(),
      'MATCH_COMPLETED',
      v_match.demand_id,
      null,
      v_match.id
    );
  end if;

  return v_match;
end;
$$;

revoke all on function public.confirm_match_completion(uuid) from public;
grant execute on function public.confirm_match_completion(uuid) to authenticated;

create or replace function public.reopen_demand_after_trade_close(
  p_match_id uuid
)
returns public.demands
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_demand public.demands%rowtype;
  v_connected int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then raise exception 'match not found'; end if;
  if v_match.status <> 'CLOSED' then raise exception 'match not closed'; end if;
  if v_match.deal_stage = 'REFUNDED' and v_match.payment_status <> 'REFUNDED' then
    raise exception 'refund not settled';
  end if;

  select * into v_demand
  from public.demands
  where id = v_match.demand_id
  for update;

  if not found then raise exception 'demand not found'; end if;
  if v_demand.user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_demand.status <> 'MATCHED' then raise exception 'demand not matched'; end if;

  select count(*) into v_connected
  from public.matches
  where demand_id = v_demand.id
    and status = 'CONNECTED'
    and id <> p_match_id;

  if v_connected > 0 then
    raise exception 'demand has active connection';
  end if;

  update public.demands
  set
    status = 'ACTIVE',
    expires_at = case
      when v_demand.type = 'BUY' then now() + interval '7 days'
      else v_demand.expires_at
    end,
    updated_at = now()
  where id = v_demand.id
  returning * into v_demand;

  return v_demand;
end;
$$;

revoke all on function public.reopen_demand_after_trade_close(uuid) from public;
grant execute on function public.reopen_demand_after_trade_close(uuid) to authenticated;
