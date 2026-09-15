-- BUY seller_connect: full lifecycle + one CONNECTED match per demand.

create unique index if not exists matches_one_connected_per_demand_uidx
  on public.matches (demand_id)
  where status = 'CONNECTED';

create or replace function public.seller_connect_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_demand public.demands%rowtype;
  v_sell public.sell_intents%rowtype;
  v_own public.ownerships%rowtype;
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

  select * into v_demand from public.demands where id = v_match.demand_id for update;
  if not found then raise exception 'demand not found'; end if;
  if v_demand.status <> 'ACTIVE' then raise exception 'demand not active'; end if;
  if v_demand.expires_at is not null and v_demand.expires_at <= now() then
    raise exception 'demand expired';
  end if;

  if exists (
    select 1 from public.matches m
    where m.demand_id = v_demand.id
      and m.status = 'CONNECTED'
      and m.id <> v_match.id
  ) then
    raise exception 'demand already connected';
  end if;

  if v_match.sell_intent_id is null then
    raise exception 'sell intent required';
  end if;
  select * into v_sell from public.sell_intents where id = v_match.sell_intent_id for update;
  if not found then raise exception 'sell intent not found'; end if;
  if v_sell.user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_sell.status <> 'OPEN' then raise exception 'sell intent not open'; end if;

  select * into v_own from public.ownerships where id = v_sell.ownership_id for update;
  if not found then raise exception 'ownership not found'; end if;
  if v_own.status <> 'OWNED' then raise exception 'ownership not owned'; end if;
  if v_own.user_id <> auth.uid() then raise exception 'forbidden'; end if;

  -- Close other pending matches on this demand
  update public.matches
  set status = 'CLOSED', updated_at = now()
  where demand_id = v_demand.id
    and id <> v_match.id
    and status in ('POTENTIAL', 'BUYER_INTERESTED', 'SELLER_ACCEPTED');

  update public.matches
  set status = 'CONNECTED', updated_at = now()
  where id = p_match_id
  returning * into v_match;

  update public.demands
  set status = 'MATCHED', updated_at = now()
  where id = v_demand.id;

  update public.sell_intents
  set status = 'MATCHED', updated_at = now()
  where id = v_sell.id;

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
