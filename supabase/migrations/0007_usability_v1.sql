-- DAN Usability V1
-- responses.availability_text, DECLINED status
-- messages, activity_events, profile bio, blocks, reports
-- RPCs for response/demand/chat/activity

-- ---------------------------------------------------------------------------
-- profiles.bio
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists bio text;

-- ---------------------------------------------------------------------------
-- responses: availability + DECLINED
-- ---------------------------------------------------------------------------
alter table public.responses
  add column if not exists availability_text text;

alter table public.responses drop constraint if exists responses_status_check;
alter table public.responses
  add constraint responses_status_check
  check (status in ('OPEN','ACCEPTED','WITHDRAWN','DECLINED'));

-- ---------------------------------------------------------------------------
-- messages (CONNECTED match chat)
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index messages_match_created_idx on public.messages (match_id, created_at);

-- ---------------------------------------------------------------------------
-- activity_events
-- ---------------------------------------------------------------------------
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in (
    'NEW_RESPONSE',
    'RESPONSE_ACCEPTED',
    'RESPONSE_DECLINED',
    'BUYER_INTEREST',
    'MATCH_CONNECTED',
    'NEW_MESSAGE',
    'DEMAND_CLOSED'
  )),
  demand_id uuid references public.demands (id) on delete set null,
  response_id uuid references public.responses (id) on delete set null,
  match_id uuid references public.matches (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index activity_events_recipient_created_idx
  on public.activity_events (recipient_id, created_at desc);

create index activity_events_recipient_unread_idx
  on public.activity_events (recipient_id)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam','fraud','abuse','other')),
  detail text,
  status text not null default 'OPEN' check (status in ('OPEN','REVIEWED','CLOSED')),
  created_at timestamptz not null default now(),
  constraint reports_no_self check (reporter_id <> target_user_id)
);

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.users_blocked(a uuid, b uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function public.insert_activity(
  p_recipient uuid,
  p_actor uuid,
  p_kind text,
  p_demand uuid default null,
  p_response uuid default null,
  p_match uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient is null then return; end if;
  insert into public.activity_events (
    recipient_id, actor_id, kind, demand_id, response_id, match_id
  ) values (
    p_recipient, p_actor, p_kind, p_demand, p_response, p_match
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- upsert_response
-- ---------------------------------------------------------------------------
create or replace function public.upsert_response(
  p_demand_id uuid,
  p_message text,
  p_offered_price numeric default null,
  p_availability_text text default null
)
returns public.responses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demand public.demands%rowtype;
  v_row public.responses%rowtype;
  v_msg text := trim(coalesce(p_message, ''));
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if v_msg = '' then raise exception 'message required'; end if;

  select * into v_demand from public.demands where id = p_demand_id for update;
  if not found then raise exception 'demand not found'; end if;
  if v_demand.user_id = auth.uid() then raise exception 'cannot respond to own demand'; end if;
  if v_demand.status <> 'ACTIVE' then raise exception 'demand not active'; end if;
  if v_demand.expires_at is not null and v_demand.expires_at <= now() then
    raise exception 'demand expired';
  end if;
  if v_demand.type = 'BUY' then raise exception 'use buy flow for BUY demands'; end if;
  if public.users_blocked(auth.uid(), v_demand.user_id) then
    raise exception 'blocked';
  end if;

  select * into v_row
  from public.responses
  where demand_id = p_demand_id
    and responder_id = auth.uid()
    and status = 'OPEN'
  for update;

  if found then
    update public.responses set
      message = v_msg,
      offered_price = p_offered_price,
      availability_text = nullif(trim(coalesce(p_availability_text, '')), ''),
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    insert into public.responses (
      demand_id, responder_id, response_type, message, offered_price, availability_text, status
    ) values (
      p_demand_id, auth.uid(), 'FULFILL', v_msg, p_offered_price,
      nullif(trim(coalesce(p_availability_text, '')), ''), 'OPEN'
    )
    returning * into v_row;

    perform public.insert_activity(
      v_demand.user_id, auth.uid(), 'NEW_RESPONSE', v_demand.id, v_row.id, null
    );
  end if;

  return v_row;
end;
$$;

revoke all on function public.upsert_response(uuid, text, numeric, text) from public;
grant execute on function public.upsert_response(uuid, text, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- withdraw_response
-- ---------------------------------------------------------------------------
create or replace function public.withdraw_response(p_response_id uuid)
returns public.responses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.responses%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_row from public.responses where id = p_response_id for update;
  if not found then raise exception 'response not found'; end if;
  if v_row.responder_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_row.status <> 'OPEN' then raise exception 'response not open'; end if;
  update public.responses set status = 'WITHDRAWN', updated_at = now()
  where id = p_response_id returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.withdraw_response(uuid) from public;
grant execute on function public.withdraw_response(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- decline_response
-- ---------------------------------------------------------------------------
create or replace function public.decline_response(p_response_id uuid)
returns public.responses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.responses%rowtype;
  v_demand public.demands%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_row from public.responses where id = p_response_id for update;
  if not found then raise exception 'response not found'; end if;
  select * into v_demand from public.demands where id = v_row.demand_id for update;
  if v_demand.user_id <> auth.uid() then raise exception 'only demand owner can decline'; end if;
  if v_row.status <> 'OPEN' then raise exception 'response not open'; end if;

  update public.responses set status = 'DECLINED', updated_at = now()
  where id = p_response_id returning * into v_row;

  perform public.insert_activity(
    v_row.responder_id, auth.uid(), 'RESPONSE_DECLINED', v_demand.id, v_row.id, null
  );
  return v_row;
end;
$$;

revoke all on function public.decline_response(uuid) from public;
grant execute on function public.decline_response(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_response (extended: auto-decline others + activity)
-- ---------------------------------------------------------------------------
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
  r record;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_resp from public.responses where id = p_response_id for update;
  if not found then raise exception 'response not found'; end if;
  if v_resp.status <> 'OPEN' then raise exception 'response not open'; end if;

  select * into v_demand from public.demands where id = v_resp.demand_id for update;
  if not found then raise exception 'demand not found'; end if;
  if v_demand.user_id <> auth.uid() then raise exception 'only demand owner can accept'; end if;
  if v_demand.status <> 'ACTIVE' then raise exception 'demand not active'; end if;
  if v_demand.expires_at is not null and v_demand.expires_at <= now() then
    raise exception 'demand expired';
  end if;
  if public.users_blocked(auth.uid(), v_resp.responder_id) then
    raise exception 'blocked';
  end if;

  update public.responses
  set status = 'ACCEPTED', updated_at = now()
  where id = p_response_id;

  for r in
    select id, responder_id from public.responses
    where demand_id = v_demand.id and status = 'OPEN' and id <> p_response_id
    for update
  loop
    update public.responses set status = 'DECLINED', updated_at = now() where id = r.id;
    perform public.insert_activity(
      r.responder_id, auth.uid(), 'RESPONSE_DECLINED', v_demand.id, r.id, null
    );
  end loop;

  insert into public.matches (
    demand_id, response_id, buyer_id, seller_id, status
  ) values (
    v_demand.id, v_resp.id, v_demand.user_id, v_resp.responder_id, 'CONNECTED'
  )
  returning * into v_match;

  update public.demands set status = 'MATCHED', updated_at = now() where id = v_demand.id;

  perform public.insert_activity(
    v_resp.responder_id, auth.uid(), 'RESPONSE_ACCEPTED', v_demand.id, v_resp.id, v_match.id
  );
  perform public.insert_activity(
    v_demand.user_id, v_resp.responder_id, 'MATCH_CONNECTED', v_demand.id, v_resp.id, v_match.id
  );
  perform public.insert_activity(
    v_resp.responder_id, auth.uid(), 'MATCH_CONNECTED', v_demand.id, v_resp.id, v_match.id
  );

  return v_match;
end;
$$;

revoke all on function public.accept_response(uuid) from public;
grant execute on function public.accept_response(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- close_demand
-- ---------------------------------------------------------------------------
create or replace function public.close_demand(p_demand_id uuid)
returns public.demands
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demand public.demands%rowtype;
  r record;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_demand from public.demands where id = p_demand_id for update;
  if not found then raise exception 'demand not found'; end if;
  if v_demand.user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_demand.status <> 'ACTIVE' then raise exception 'demand not active'; end if;

  update public.demands set status = 'CLOSED', updated_at = now()
  where id = p_demand_id returning * into v_demand;

  for r in
    select id, responder_id from public.responses
    where demand_id = p_demand_id and status = 'OPEN'
    for update
  loop
    update public.responses set status = 'DECLINED', updated_at = now() where id = r.id;
    perform public.insert_activity(
      r.responder_id, auth.uid(), 'DEMAND_CLOSED', p_demand_id, r.id, null
    );
  end loop;

  return v_demand;
end;
$$;

revoke all on function public.close_demand(uuid) from public;
grant execute on function public.close_demand(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- update_demand (non-product-key fields)
-- ---------------------------------------------------------------------------
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
  p_location text default null
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

revoke all on function public.update_demand(uuid, text, text, numeric, jsonb, timestamptz, timestamptz, text, text, text, numeric, text, text, text) from public;
grant execute on function public.update_demand(uuid, text, text, numeric, jsonb, timestamptz, timestamptz, text, text, text, numeric, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- send_message
-- ---------------------------------------------------------------------------
create or replace function public.send_message(p_match_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_msg public.messages%rowtype;
  v_body text := trim(coalesce(p_body, ''));
  v_peer uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if v_body = '' then raise exception 'empty message'; end if;
  if char_length(v_body) > 2000 then raise exception 'message too long'; end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  if v_match.status <> 'CONNECTED' then raise exception 'match not connected'; end if;
  if auth.uid() <> v_match.buyer_id and auth.uid() <> v_match.seller_id then
    raise exception 'forbidden';
  end if;

  v_peer := case when auth.uid() = v_match.buyer_id then v_match.seller_id else v_match.buyer_id end;
  if public.users_blocked(auth.uid(), v_peer) then raise exception 'blocked'; end if;

  insert into public.messages (match_id, sender_id, body)
  values (p_match_id, auth.uid(), v_body)
  returning * into v_msg;

  perform public.insert_activity(
    v_peer, auth.uid(), 'NEW_MESSAGE', v_match.demand_id, null, p_match_id
  );
  return v_msg;
end;
$$;

revoke all on function public.send_message(uuid, text) from public;
grant execute on function public.send_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- mark_messages_read / mark_activity_read
-- ---------------------------------------------------------------------------
create or replace function public.mark_messages_read(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'match not found'; end if;
  if auth.uid() <> v_match.buyer_id and auth.uid() <> v_match.seller_id then
    raise exception 'forbidden';
  end if;
  update public.messages
  set read_at = now()
  where match_id = p_match_id
    and sender_id <> auth.uid()
    and read_at is null;
end;
$$;

revoke all on function public.mark_messages_read(uuid) from public;
grant execute on function public.mark_messages_read(uuid) to authenticated;

create or replace function public.mark_activity_read(p_activity_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_activity_id is null then
    update public.activity_events
    set read_at = now()
    where recipient_id = auth.uid() and read_at is null;
  else
    update public.activity_events
    set read_at = now()
    where id = p_activity_id and recipient_id = auth.uid() and read_at is null;
  end if;
end;
$$;

revoke all on function public.mark_activity_read(uuid) from public;
grant execute on function public.mark_activity_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- extend BUY interest / connect with activity + block checks
-- ---------------------------------------------------------------------------
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
  if public.users_blocked(auth.uid(), v_sell.user_id) then raise exception 'blocked'; end if;

  select * into v_own from public.ownerships where id = v_sell.ownership_id;
  if not found or v_own.status <> 'OWNED' then raise exception 'ownership not owned'; end if;

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

  perform public.insert_activity(
    v_sell.user_id, auth.uid(), 'BUYER_INTEREST', v_demand.id, null, v_match.id
  );

  return v_match;
end;
$$;

revoke all on function public.express_buyer_interest(uuid, uuid) from public;
grant execute on function public.express_buyer_interest(uuid, uuid) to authenticated;

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
  if public.users_blocked(v_match.buyer_id, v_match.seller_id) then
    raise exception 'blocked';
  end if;

  update public.matches
  set status = 'CONNECTED', updated_at = now()
  where id = p_match_id
  returning * into v_match;

  perform public.insert_activity(
    v_match.buyer_id, auth.uid(), 'MATCH_CONNECTED', v_match.demand_id, null, v_match.id
  );
  perform public.insert_activity(
    v_match.seller_id, v_match.buyer_id, 'MATCH_CONNECTED', v_match.demand_id, null, v_match.id
  );

  return v_match;
end;
$$;

revoke all on function public.seller_connect_match(uuid) from public;
grant execute on function public.seller_connect_match(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.messages enable row level security;
alter table public.activity_events enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy messages_select_parties
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.buyer_id = auth.uid() or m.seller_id = auth.uid())
    )
  );

-- inserts via send_message RPC only
create policy messages_no_direct_insert
  on public.messages for insert to authenticated
  with check (false);

create policy activity_select_own
  on public.activity_events for select to authenticated
  using (recipient_id = auth.uid());

create policy activity_no_direct_insert
  on public.activity_events for insert to authenticated
  with check (false);

create policy activity_update_own_read
  on public.activity_events for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy blocks_select_own
  on public.blocks for select to authenticated
  using (blocker_id = auth.uid());

create policy blocks_insert_own
  on public.blocks for insert to authenticated
  with check (blocker_id = auth.uid() and blocker_id <> blocked_id);

create policy blocks_delete_own
  on public.blocks for delete to authenticated
  using (blocker_id = auth.uid());

create policy reports_select_own
  on public.reports for select to authenticated
  using (reporter_id = auth.uid());

create policy reports_insert_own
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and reporter_id <> target_user_id);

-- public profile read for authenticated (minimal)
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
  on public.profiles for select to authenticated
  using (true);

-- allow anon read of public ACTIVE demands already exists; products public

grant select on public.messages to authenticated;
grant select, update on public.activity_events to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select, insert on public.reports to authenticated;
