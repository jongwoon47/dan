-- V0.5 trade completion: CONNECTED → COMPLETED (both confirm) or CLOSED (unilateral).

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches
  add constraint matches_status_check
  check (status in (
    'BUYER_INTERESTED',
    'SELLER_ACCEPTED',
    'CONNECTED',
    'DECLINED',
    'CLOSED',
    'COMPLETED'
  ));

alter table public.matches
  add column if not exists buyer_completed_at timestamptz,
  add column if not exists seller_completed_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.activity_events drop constraint if exists activity_events_kind_check;
alter table public.activity_events
  add constraint activity_events_kind_check
  check (kind in (
    'NEW_RESPONSE',
    'RESPONSE_ACCEPTED',
    'RESPONSE_DECLINED',
    'BUYER_INTEREST',
    'MATCH_CONNECTED',
    'NEW_MESSAGE',
    'DEMAND_CLOSED',
    'MATCH_COMPLETED',
    'MATCH_TRADE_CLOSED'
  ));

-- ---------------------------------------------------------------------------
-- confirm_match_completion — one side confirms; both → COMPLETED
-- ---------------------------------------------------------------------------
create or replace function public.confirm_match_completion(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_is_buyer boolean;
  v_peer uuid;
  v_both boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  if v_match.status <> 'CONNECTED' then
    raise exception 'invalid transition from % to COMPLETED', v_match.status;
  end if;
  if auth.uid() <> v_match.buyer_id and auth.uid() <> v_match.seller_id then
    raise exception 'forbidden';
  end if;

  v_is_buyer := auth.uid() = v_match.buyer_id;
  v_peer := case when v_is_buyer then v_match.seller_id else v_match.buyer_id end;

  if v_is_buyer and v_match.buyer_completed_at is not null then
    return v_match;
  end if;
  if (not v_is_buyer) and v_match.seller_completed_at is not null then
    return v_match;
  end if;

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

  v_both := v_match.buyer_completed_at is not null
        and v_match.seller_completed_at is not null;

  if v_both then
    update public.matches
    set status = 'COMPLETED',
        completed_at = now(),
        updated_at = now()
    where id = p_match_id
    returning * into v_match;

    perform public.insert_activity(
      v_match.buyer_id, v_match.seller_id, 'MATCH_COMPLETED',
      v_match.demand_id, null, v_match.id
    );
    perform public.insert_activity(
      v_match.seller_id, v_match.buyer_id, 'MATCH_COMPLETED',
      v_match.demand_id, null, v_match.id
    );
  else
    perform public.insert_activity(
      v_peer, auth.uid(), 'MATCH_COMPLETED',
      v_match.demand_id, null, v_match.id
    );
  end if;

  return v_match;
end;
$$;

revoke all on function public.confirm_match_completion(uuid) from public;
grant execute on function public.confirm_match_completion(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- close_match — unilateral trade cancel; chat history kept
-- ---------------------------------------------------------------------------
create or replace function public.close_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_peer uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  if v_match.status <> 'CONNECTED' then
    raise exception 'invalid transition from % to CLOSED', v_match.status;
  end if;
  if auth.uid() <> v_match.buyer_id and auth.uid() <> v_match.seller_id then
    raise exception 'forbidden';
  end if;

  v_peer := case
    when auth.uid() = v_match.buyer_id then v_match.seller_id
    else v_match.buyer_id
  end;

  update public.matches
  set status = 'CLOSED', updated_at = now()
  where id = p_match_id
  returning * into v_match;

  perform public.insert_activity(
    v_peer, auth.uid(), 'MATCH_TRADE_CLOSED',
    v_match.demand_id, null, v_match.id
  );

  return v_match;
end;
$$;

revoke all on function public.close_match(uuid) from public;
grant execute on function public.close_match(uuid) to authenticated;

-- Allow follow-up chat after COMPLETED; CLOSED is read-only
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
  if v_match.status not in ('CONNECTED', 'COMPLETED') then
    raise exception 'match not open for messages';
  end if;
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
-- Trust: completed = COMPLETED matches (not MATCHED/CLOSED demands)
-- ---------------------------------------------------------------------------
create or replace function public.get_public_profile_trust(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_is_self boolean := v_viewer is not null and v_viewer = p_user_id;
  v_completed int;
  v_response int;
  v_connection int;
  v_recent jsonb;
begin
  if p_user_id is null then
    return null;
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    return null;
  end if;

  select count(*)::int into v_completed
  from public.matches
  where status = 'COMPLETED'
    and (buyer_id = p_user_id or seller_id = p_user_id);

  select count(*)::int into v_response
  from public.matches
  where status in ('CONNECTED', 'COMPLETED')
    and seller_id = p_user_id;

  select count(*)::int into v_connection
  from public.matches
  where status in ('CONNECTED', 'COMPLETED')
    and (buyer_id = p_user_id or seller_id = p_user_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'type', x.type,
        'status', x.status,
        'title', x.title
      )
      order by x.sort_at desc
    ),
    '[]'::jsonb
  )
  into v_recent
  from (
    select
      m.id,
      d.type,
      'COMPLETED'::text as status,
      case when v_is_self then d.title else null end as title,
      coalesce(m.completed_at, m.updated_at, m.created_at) as sort_at
    from public.matches m
    join public.demands d on d.id = m.demand_id
    where m.status = 'COMPLETED'
      and (m.buyer_id = p_user_id or m.seller_id = p_user_id)
    order by coalesce(m.completed_at, m.updated_at, m.created_at) desc
    limit 3
  ) x;

  return jsonb_build_object(
    'completedDemandCount', v_completed,
    'responseConnectionCount', v_response,
    'connectionCount', v_connection,
    'recentActivity', v_recent,
    'viewerIsSelf', v_is_self
  );
end;
$$;

revoke all on function public.get_public_profile_trust(uuid) from public;
grant execute on function public.get_public_profile_trust(uuid) to authenticated;
