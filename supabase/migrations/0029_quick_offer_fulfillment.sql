-- Quick Offer fulfillment compatibility.
-- A seller must state whether the item can be handed off by meetup, shipping,
-- or either. Matching and buyer-interest materialization enforce the overlap.

alter table public.sell_intents
  add column if not exists trade_method text not null default 'any'
  check (trade_method in ('meetup','shipping','any'));

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
    and sell_intent_id = p_sell_intent_id;

  if found then
    if v_existing.status = 'BUYER_INTERESTED' then
      return v_existing;
    end if;
    raise exception 'match already exists in status %', v_existing.status;
  end if;

  insert into public.matches (
    demand_id,
    sell_intent_id,
    product_id,
    buyer_id,
    seller_id,
    status
  )
  values (
    p_demand_id,
    p_sell_intent_id,
    v_demand.product_id,
    v_demand.user_id,
    v_sell.user_id,
    'BUYER_INTERESTED'
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
