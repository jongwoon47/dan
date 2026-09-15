-- Prevent duplicate CONNECTED matches for the same demand/parties.
-- Response-based flows: at most one CONNECTED match per demand.
-- Any flow: at most one CONNECTED match per (demand, buyer, seller).

-- Drop newer duplicates first so unique indexes can apply.
delete from public.matches m
using public.matches older
where m.id <> older.id
  and m.status = 'CONNECTED'
  and older.status = 'CONNECTED'
  and m.demand_id = older.demand_id
  and m.response_id is not null
  and older.response_id is not null
  and m.created_at > older.created_at;

delete from public.matches m
using public.matches older
where m.id <> older.id
  and m.status = 'CONNECTED'
  and older.status = 'CONNECTED'
  and m.demand_id = older.demand_id
  and m.buyer_id = older.buyer_id
  and m.seller_id = older.seller_id
  and m.created_at > older.created_at;

create unique index if not exists matches_one_connected_response_uidx
  on public.matches (demand_id)
  where status = 'CONNECTED' and response_id is not null;

create unique index if not exists matches_parties_demand_connected_uidx
  on public.matches (demand_id, buyer_id, seller_id)
  where status = 'CONNECTED';

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

  if exists (
    select 1 from public.matches
    where demand_id = v_demand.id and status = 'CONNECTED'
  ) then
    raise exception 'demand already connected';
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
