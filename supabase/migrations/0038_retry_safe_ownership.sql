-- Retry-safe ownership creation and policy-safe selling entry.

create or replace function public.ensure_ownership(
  p_product_id uuid,
  p_condition text
)
returns public.ownerships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_row public.ownerships%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_condition not in ('sealed','like_new','lightly_used') then
    raise exception 'invalid ownership condition';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id;

  if not found then raise exception 'product not found'; end if;
  if not public.marketplace_product_allowed(v_product.canonical_name) then
    raise exception 'restricted marketplace product';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(auth.uid()::text || ':' || p_product_id::text)::bigint
  );

  select * into v_row
  from public.ownerships
  where user_id = auth.uid()
    and product_id = p_product_id
    and status = 'OWNED'
  for update;

  if found then
    return v_row;
  end if;

  insert into public.ownerships (
    user_id,
    product_id,
    condition,
    status
  )
  values (
    auth.uid(),
    p_product_id,
    p_condition,
    'OWNED'
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.ensure_ownership(uuid,text) from public;
grant execute on function public.ensure_ownership(uuid,text) to authenticated;

revoke insert on public.ownerships from authenticated;

create or replace function public.enforce_sell_intent_marketplace_policy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_name text;
begin
  select canonical_name into v_name
  from public.products
  where id = new.product_id;

  if v_name is null then raise exception 'product not found'; end if;
  if not public.marketplace_product_allowed(v_name) then
    raise exception 'restricted marketplace product';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sell_intent_marketplace_policy on public.sell_intents;
create trigger trg_sell_intent_marketplace_policy
before insert or update of
  product_id,
  minimum_price,
  target_demand_id,
  trade_method,
  approx_usage_count,
  condition_note,
  quick_photo_url
on public.sell_intents
for each row execute function public.enforce_sell_intent_marketplace_policy();
