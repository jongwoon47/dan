-- Match / response transition RPCs (no Edge Functions)
-- Enforces hardened lifecycle in the database.

-- BUY: materialize BUYER_INTERESTED from compatible pair (POTENTIAL is never stored)
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
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_demand from public.demands where id = p_demand_id for update;
  if not found then raise exception 'demand not found'; end if;
  if v_demand.user_id <> auth.uid() then raise exception 'only demand owner can express interest'; end if;
  if v_demand.type <> 'BUY' or v_demand.status <> 'ACTIVE' then raise exception 'demand not active buy'; end if;
  if v_demand.expires_at is not null and v_demand.expires_at <= now() then
    raise exception 'demand expired';
  end if;

  select * into v_sell from public.sell_intents where id = p_sell_intent_id for update;
  if not found or v_sell.status <> 'OPEN' then raise exception 'sell intent not open'; end if;
  if v_sell.product_id <> v_demand.product_id then raise exception 'product mismatch'; end if;
  if v_sell.user_id = v_demand.user_id then raise exception 'self match forbidden'; end if;
  if v_demand.max_price < v_sell.minimum_price then raise exception 'price incompatible'; end if;

  select * into v_own from public.ownerships where id = v_sell.ownership_id;
  if not found or v_own.status <> 'OWNED' then raise exception 'ownership not owned'; end if;

  -- condition rank: sealed=3, like_new=2, lightly_used=1, any=0
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
  where demand_id = p_demand_id and sell_intent_id = p_sell_intent_id;

  if found then
    if v_existing.status = 'BUYER_INTERESTED' then
      return v_existing;
    end if;
    raise exception 'match already exists in status %', v_existing.status;
  end if;

  insert into public.matches (
    demand_id, sell_intent_id, product_id, buyer_id, seller_id, status
  ) values (
    p_demand_id, p_sell_intent_id, v_demand.product_id, v_demand.user_id, v_sell.user_id, 'BUYER_INTERESTED'
  )
  returning * into v_match;

  return v_match;
end;
$$;

revoke all on function public.express_buyer_interest(uuid, uuid) from public;
grant execute on function public.express_buyer_interest(uuid, uuid) to authenticated;

-- BUY: seller connect only from BUYER_INTERESTED
create or replace function public.seller_connect_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  if v_match.seller_id <> auth.uid() then raise exception 'only seller can connect'; end if;
  if v_match.status <> 'BUYER_INTERESTED' then
    raise exception 'invalid transition from % to CONNECTED', v_match.status;
  end if;

  update public.matches
  set status = 'CONNECTED', updated_at = now()
  where id = p_match_id
  returning * into v_match;

  return v_match;
end;
$$;

revoke all on function public.seller_connect_match(uuid) from public;
grant execute on function public.seller_connect_match(uuid) to authenticated;

-- Non-BUY: demand owner accepts OPEN response → CONNECTED match
create or replace function public.accept_response(p_response_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resp public.responses%rowtype;
  v_demand public.demands%rowtype;
  v_match public.matches%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_resp from public.responses where id = p_response_id for update;
  if not found then raise exception 'response not found'; end if;
  if v_resp.status <> 'OPEN' then raise exception 'response not open'; end if;

  select * into v_demand from public.demands where id = v_resp.demand_id for update;
  if not found then raise exception 'demand not found'; end if;
  if v_demand.user_id <> auth.uid() then raise exception 'only demand owner can accept'; end if;
  if v_demand.status <> 'ACTIVE' then raise exception 'demand not active'; end if;

  update public.responses
  set status = 'ACCEPTED', updated_at = now()
  where id = p_response_id;

  insert into public.matches (
    demand_id, response_id, buyer_id, seller_id, status
  ) values (
    v_demand.id, v_resp.id, v_demand.user_id, v_resp.responder_id, 'CONNECTED'
  )
  returning * into v_match;

  return v_match;
end;
$$;

revoke all on function public.accept_response(uuid) from public;
grant execute on function public.accept_response(uuid) to authenticated;

-- Upsert ACTIVE BUY demand (update existing instead of duplicate)
create or replace function public.upsert_buy_demand(
  p_product_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_max_price numeric,
  p_location text,
  p_condition_preference text,
  p_trade_method text,
  p_expires_at timestamptz default null
)
returns public.demands
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.demands%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_row
  from public.demands
  where user_id = auth.uid()
    and type = 'BUY'
    and status = 'ACTIVE'
    and product_id = p_product_id
  for update;

  if found then
    update public.demands set
      title = p_title,
      description = coalesce(p_description, ''),
      category = p_category,
      budget = p_max_price,
      max_price = p_max_price,
      location = coalesce(p_location, ''),
      condition_preference = p_condition_preference,
      trade_method = p_trade_method,
      expires_at = coalesce(p_expires_at, expires_at),
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    insert into public.demands (
      user_id, type, title, description, category, budget, location, status,
      product_id, max_price, condition_preference, trade_method, expires_at
    ) values (
      auth.uid(), 'BUY', p_title, coalesce(p_description, ''), p_category, p_max_price,
      coalesce(p_location, ''), 'ACTIVE', p_product_id, p_max_price,
      p_condition_preference, p_trade_method,
      coalesce(p_expires_at, now() + interval '30 days')
    )
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.upsert_buy_demand(uuid, text, text, text, numeric, text, text, text, timestamptz) from public;
grant execute on function public.upsert_buy_demand(uuid, text, text, text, numeric, text, text, text, timestamptz) to authenticated;
