-- DAN P0 security hardening (additive)
-- Goal: DB/RPC enforce lifecycle; direct REST cannot bypass response/demand rules.

-- ---------------------------------------------------------------------------
-- 1) responses: RPC-only writes
-- ---------------------------------------------------------------------------
drop policy if exists responses_insert_own on public.responses;
drop policy if exists responses_update_own_or_demand_owner on public.responses;

-- Explicit deny policies (RLS default deny is enough; named for clarity)
create policy responses_no_direct_insert
  on public.responses for insert to authenticated
  with check (false);

create policy responses_no_direct_update
  on public.responses for update to authenticated
  using (false)
  with check (false);

revoke insert, update, delete on public.responses from authenticated;
grant select on public.responses to authenticated;

-- ---------------------------------------------------------------------------
-- 2) demands: INSERT create OK; lifecycle status not forgeable via REST
-- ---------------------------------------------------------------------------
drop policy if exists demands_insert_own on public.demands;
create policy demands_insert_own
  on public.demands for insert to authenticated
  with check (user_id = auth.uid() and status = 'ACTIVE');

drop policy if exists demands_update_own on public.demands;
-- No direct UPDATE. Content edits go through update_demand; close/accept via RPC.
create policy demands_no_direct_update
  on public.demands for update to authenticated
  using (false)
  with check (false);

revoke update on public.demands from authenticated;
grant select, insert, delete on public.demands to authenticated;

-- Extend update_demand with schedule fields (drop old signature to avoid overload drift)
drop function if exists public.update_demand(
  uuid, text, text, numeric, jsonb, timestamptz, timestamptz,
  text, text, text, numeric, text, text, text
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
  p_preferred_at timestamptz default null
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
  text, text, text, numeric, text, text, text, timestamptz, timestamptz, timestamptz
) from public;
grant execute on function public.update_demand(
  uuid, text, text, numeric, jsonb, timestamptz, timestamptz,
  text, text, text, numeric, text, text, text, timestamptz, timestamptz, timestamptz
) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) sell_intent ownership / product integrity
-- ---------------------------------------------------------------------------
create or replace function public.enforce_sell_intent_ownership()
returns trigger
language plpgsql
as $$
declare
  v_own public.ownerships%rowtype;
begin
  select * into v_own from public.ownerships where id = new.ownership_id;
  if not found then
    raise exception 'ownership not found';
  end if;
  if v_own.user_id <> new.user_id then
    raise exception 'sell_intent user must own ownership';
  end if;
  if auth.uid() is not null and new.user_id <> auth.uid() then
    raise exception 'sell_intent user must be auth uid';
  end if;
  if v_own.product_id <> new.product_id then
    raise exception 'sell_intent product must match ownership product';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sell_intent_ownership on public.sell_intents;
create trigger trg_sell_intent_ownership
before insert or update on public.sell_intents
for each row execute function public.enforce_sell_intent_ownership();

drop policy if exists sell_intents_insert_own on public.sell_intents;
create policy sell_intents_insert_own
  on public.sell_intents for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.ownerships o
      where o.id = ownership_id
        and o.user_id = auth.uid()
        and o.product_id = product_id
    )
  );

drop policy if exists sell_intents_update_own on public.sell_intents;
create policy sell_intents_update_own
  on public.sell_intents for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.ownerships o
      where o.id = ownership_id
        and o.user_id = auth.uid()
        and o.product_id = product_id
    )
  );

-- ---------------------------------------------------------------------------
-- 4) activity_events: read-state only via RPC
-- ---------------------------------------------------------------------------
drop policy if exists activity_update_own_read on public.activity_events;
create policy activity_no_direct_update
  on public.activity_events for update to authenticated
  using (false)
  with check (false);

revoke update on public.activity_events from authenticated;
grant select on public.activity_events to authenticated;
