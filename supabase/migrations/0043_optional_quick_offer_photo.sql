-- Quick Offer is intentionally low-friction.
-- A current photo is optional here; canonical Deal Evidence remains mandatory before Snapshot.

create or replace function public.upsert_quick_offer(
  p_ownership_id uuid,
  p_minimum_price numeric,
  p_target_demand_id uuid default null,
  p_trade_method text default 'any',
  p_approx_usage_count integer default null,
  p_condition_note text default '',
  p_quick_photo_url text default null
)
returns public.sell_intents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_own public.ownerships%rowtype;
  v_target public.demands%rowtype;
  v_row public.sell_intents%rowtype;
  v_photo text := nullif(trim(coalesce(p_quick_photo_url, '')), '');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_minimum_price is null or p_minimum_price <= 0 then
    raise exception 'minimum price must be positive';
  end if;
  if p_trade_method not in ('meetup','shipping','any') then
    raise exception 'invalid trade method';
  end if;
  if p_approx_usage_count is not null and p_approx_usage_count < 0 then
    raise exception 'usage count must be non-negative';
  end if;
  if char_length(trim(coalesce(p_condition_note, ''))) > 500 then
    raise exception 'condition note too long';
  end if;

  select * into v_own
  from public.ownerships
  where id = p_ownership_id
  for update;

  if not found then raise exception 'ownership not found'; end if;
  if v_own.user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_own.status <> 'OWNED' then raise exception 'ownership not owned'; end if;

  if v_photo is not null
     and v_photo not like ('storage://dan-v1-evidence/' || auth.uid()::text || '/quick-offers/%') then
    raise exception 'private seller photo required';
  end if;

  if p_target_demand_id is not null then
    select * into v_target
    from public.demands
    where id = p_target_demand_id
    for share;

    if not found then raise exception 'target demand not found'; end if;
    if v_target.type <> 'BUY'
       or v_target.status <> 'ACTIVE'
       or (v_target.expires_at is not null and v_target.expires_at <= now()) then
      raise exception 'target demand not active';
    end if;
    if v_target.product_id <> v_own.product_id then
      raise exception 'target demand product mismatch';
    end if;
    if v_target.user_id = auth.uid() then
      raise exception 'cannot offer to own demand';
    end if;
    if public.users_blocked(auth.uid(), v_target.user_id) then
      raise exception 'blocked';
    end if;
  end if;

  select * into v_row
  from public.sell_intents
  where ownership_id = p_ownership_id
    and status = 'OPEN'
  for update;

  if found then
    update public.sell_intents
    set
      minimum_price = p_minimum_price,
      target_demand_id = p_target_demand_id,
      trade_method = p_trade_method,
      approx_usage_count = p_approx_usage_count,
      condition_note = trim(coalesce(p_condition_note, '')),
      quick_photo_url = v_photo,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    insert into public.sell_intents (
      ownership_id,
      user_id,
      product_id,
      minimum_price,
      target_demand_id,
      trade_method,
      approx_usage_count,
      condition_note,
      quick_photo_url,
      status
    )
    values (
      v_own.id,
      auth.uid(),
      v_own.product_id,
      p_minimum_price,
      p_target_demand_id,
      p_trade_method,
      p_approx_usage_count,
      trim(coalesce(p_condition_note, '')),
      v_photo,
      'OPEN'
    )
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.upsert_quick_offer(uuid,numeric,uuid,text,integer,text,text) from public;
grant execute on function public.upsert_quick_offer(uuid,numeric,uuid,text,integer,text,text) to authenticated;
