-- SERVICE estimated duration (optional structured field)
alter table public.demands
  add column if not exists estimated_duration_minutes integer
  check (
    estimated_duration_minutes is null
    or (
      estimated_duration_minutes > 0
      and estimated_duration_minutes <= 24 * 60
    )
  );

-- Extend update_demand with estimated_duration_minutes
drop function if exists public.update_demand(
  uuid, text, text, numeric, jsonb, timestamptz, timestamptz,
  text, text, text, numeric, text, text, text, timestamptz, timestamptz, timestamptz
);

create or replace function public.update_demand(
  p_demand_id uuid,
  p_title text,
  p_description text,
  p_budget numeric,
  p_fulfillment_options jsonb,
  p_expires_at timestamptz default null,
  p_due_at timestamptz default null,
  p_item_name text default null,
  p_task_description text default null,
  p_service_description text default null,
  p_max_price numeric default null,
  p_condition_preference text default null,
  p_trade_method text default null,
  p_location text default null,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_preferred_at timestamptz default null,
  p_estimated_duration_minutes integer default null
)
returns public.demands
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demand public.demands%rowtype;
  v_fulfillment jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_demand from public.demands where id = p_demand_id for update;
  if not found then raise exception 'demand not found'; end if;
  if v_demand.user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_demand.status <> 'ACTIVE' then raise exception 'demand not active'; end if;

  v_fulfillment := coalesce(p_fulfillment_options, v_demand.fulfillment_options);
  if jsonb_typeof(v_fulfillment) <> 'array' or jsonb_array_length(v_fulfillment) = 0 then
    raise exception 'fulfillment_options required';
  end if;

  update public.demands set
    title = coalesce(nullif(trim(p_title), ''), title),
    description = coalesce(p_description, description),
    budget = case
      when type = 'BUY' then coalesce(p_max_price, budget)
      else coalesce(p_budget, budget)
    end,
    fulfillment_options = v_fulfillment,
    location = coalesce(p_location, location),
    expires_at = coalesce(p_expires_at, expires_at),
    due_at = coalesce(p_due_at, due_at),
    start_at = coalesce(p_start_at, start_at),
    end_at = coalesce(p_end_at, end_at),
    preferred_at = coalesce(p_preferred_at, preferred_at),
    item_name = coalesce(p_item_name, item_name),
    task_description = coalesce(p_task_description, task_description),
    service_description = coalesce(p_service_description, service_description),
    estimated_duration_minutes = coalesce(
      p_estimated_duration_minutes,
      estimated_duration_minutes
    ),
    max_price = case when type = 'BUY' then coalesce(p_max_price, max_price) else max_price end,
    condition_preference = coalesce(p_condition_preference, condition_preference),
    trade_method = coalesce(p_trade_method, trade_method),
    updated_at = now()
  where id = p_demand_id
  returning * into v_demand;

  return v_demand;
end;
$$;

revoke all on function public.update_demand(
  uuid, text, text, numeric, jsonb, timestamptz, timestamptz,
  text, text, text, numeric, text, text, text, timestamptz, timestamptz, timestamptz,
  integer
) from public;
grant execute on function public.update_demand(
  uuid, text, text, numeric, jsonb, timestamptz, timestamptz,
  text, text, text, numeric, text, text, text, timestamptz, timestamptz, timestamptz,
  integer
) to authenticated;
