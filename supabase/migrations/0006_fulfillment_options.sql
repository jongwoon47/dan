-- Fulfillment options as structured JSONB (domain truth)
-- Keep location as denormalized public summary for legacy/display.

alter table public.demands
  add column if not exists fulfillment_options jsonb not null default '[]'::jsonb;

alter table public.demands
  add constraint demands_fulfillment_options_is_array
  check (jsonb_typeof(fulfillment_options) = 'array');

comment on column public.demands.fulfillment_options is
  'Structured FulfillmentOption[] (REMOTE/SHIPPING/MEETUP/ONSITE/PICKUP/ROUTE). location is a public summary only.';

comment on column public.demands.location is
  'Denormalized public summary of fulfillment (not profile residence). Prefer fulfillment_options.';

-- Profile default area (form/filter default — not demand fulfillment truth)
alter table public.profiles
  add column if not exists default_area_label text;

update public.profiles
set default_area_label = coalesce(nullif(trim(default_area_label), ''), location)
where default_area_label is null or trim(default_area_label) = '';

-- Products: allow extensible categories (drop camera-centric check)
alter table public.products drop constraint if exists products_category_check;

-- Backfill fulfillment_options from location when empty
update public.demands
set fulfillment_options =
  case
    when location ilike '%온라인%' or lower(location) = 'remote' then
      '[{"mode":"REMOTE"}]'::jsonb
    when location ilike '%택배%' or location ilike '%shipping%' then
      '[{"mode":"SHIPPING"}]'::jsonb
    when trim(location) = '' then
      '[{"mode":"REMOTE"}]'::jsonb
    else
      jsonb_build_array(
        jsonb_build_object(
          'mode', 'MEETUP',
          'place', jsonb_build_object('publicLabel', location)
        )
      )
  end
where fulfillment_options = '[]'::jsonb
   or fulfillment_options is null;

-- Upsert BUY demand with structured fulfillment
create or replace function public.upsert_buy_demand(
  p_product_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_max_price numeric,
  p_location text,
  p_condition_preference text,
  p_trade_method text,
  p_expires_at timestamptz,
  p_fulfillment_options jsonb
)
returns public.demands
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.demands%rowtype;
  v_fulfillment jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  v_fulfillment := coalesce(p_fulfillment_options, '[]'::jsonb);
  if jsonb_typeof(v_fulfillment) <> 'array' then
    raise exception 'fulfillment_options must be a JSON array';
  end if;
  if jsonb_array_length(v_fulfillment) = 0 then
    raise exception 'fulfillment_options required';
  end if;

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
      fulfillment_options = v_fulfillment,
      condition_preference = p_condition_preference,
      trade_method = p_trade_method,
      expires_at = coalesce(p_expires_at, expires_at),
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    insert into public.demands (
      user_id, type, title, description, category, budget, location, status,
      product_id, max_price, condition_preference, trade_method, expires_at,
      fulfillment_options
    ) values (
      auth.uid(), 'BUY', p_title, coalesce(p_description, ''), p_category, p_max_price,
      coalesce(p_location, ''), 'ACTIVE', p_product_id, p_max_price,
      p_condition_preference, p_trade_method,
      coalesce(p_expires_at, now() + interval '30 days'),
      v_fulfillment
    )
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.upsert_buy_demand(uuid, text, text, text, numeric, text, text, text, timestamptz, jsonb) from public;
grant execute on function public.upsert_buy_demand(uuid, text, text, text, numeric, text, text, text, timestamptz, jsonb) to authenticated;

-- Keep older 9-arg signature: synthesize fulfillment from location summary
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
  v_fulfillment jsonb;
  v_loc text := coalesce(trim(p_location), '');
begin
  if v_loc = '' or v_loc ilike '%온라인%' then
    v_fulfillment := '[{"mode":"REMOTE"}]'::jsonb;
  elsif v_loc ilike '%택배%' then
    v_fulfillment := '[{"mode":"SHIPPING"}]'::jsonb;
  else
    v_fulfillment := jsonb_build_array(
      jsonb_build_object(
        'mode', 'MEETUP',
        'place', jsonb_build_object('publicLabel', v_loc)
      )
    );
  end if;

  return public.upsert_buy_demand(
    p_product_id,
    p_title,
    p_description,
    p_category,
    p_max_price,
    p_location,
    p_condition_preference,
    p_trade_method,
    p_expires_at,
    v_fulfillment
  );
end;
$$;

revoke all on function public.upsert_buy_demand(uuid, text, text, text, numeric, text, text, text, timestamptz) from public;
grant execute on function public.upsert_buy_demand(uuid, text, text, text, numeric, text, text, text, timestamptz) to authenticated;
