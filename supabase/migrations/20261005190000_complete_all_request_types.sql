-- Complete the lifecycle consistently for every DAN request type.
-- BUY keeps its additional sell-intent/ownership settlement behavior.
-- BORROW/TASK/SERVICE now close the matched demand after both parties confirm.

create or replace function public.confirm_match_completion(
  p_match_id uuid
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_demand public.demands%rowtype;
  v_is_buyer boolean;
  v_peer uuid;
  v_both boolean;
  v_ownership_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then raise exception 'match not found'; end if;
  if auth.uid() <> v_match.buyer_id and auth.uid() <> v_match.seller_id then
    raise exception 'forbidden';
  end if;
  if v_match.status = 'COMPLETED' then return v_match; end if;
  if v_match.status <> 'CONNECTED' then
    raise exception 'invalid transition from % to COMPLETED', v_match.status;
  end if;

  select * into v_demand
  from public.demands
  where id = v_match.demand_id
  for update;

  if not found then raise exception 'demand not found'; end if;

  if v_demand.type = 'BUY' then
    if v_match.payment_status <> 'PAID' then
      raise exception 'safe payment required';
    end if;
    if not exists (
      select 1
      from public.deal_snapshots s
      where s.match_id = p_match_id
        and s.locked_at is not null
    ) then
      raise exception 'locked deal snapshot required';
    end if;
    if exists (
      select 1
      from public.deal_disputes d
      where d.match_id = p_match_id
        and d.status in ('OPEN','REVIEWING')
    ) then
      raise exception 'open dispute blocks completion';
    end if;
  end if;

  v_is_buyer := auth.uid() = v_match.buyer_id;
  v_peer := case
    when v_is_buyer then v_match.seller_id
    else v_match.buyer_id
  end;

  if v_is_buyer and v_match.buyer_completed_at is not null then return v_match; end if;
  if (not v_is_buyer) and v_match.seller_completed_at is not null then return v_match; end if;

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

  v_both :=
    v_match.buyer_completed_at is not null
    and v_match.seller_completed_at is not null;

  if v_both then
    if v_match.sell_intent_id is not null then
      select ownership_id into v_ownership_id
      from public.sell_intents
      where id = v_match.sell_intent_id;
    end if;

    update public.matches
    set
      status = 'COMPLETED',
      completed_at = now(),
      deal_stage = 'COMPLETED',
      updated_at = now()
    where id = p_match_id
    returning * into v_match;

    update public.demands
    set status = 'CLOSED', updated_at = now()
    where id = v_match.demand_id
      and status = 'MATCHED';

    if v_demand.type = 'BUY' then
      if v_match.sell_intent_id is not null then
        update public.sell_intents
        set status = 'CLOSED', updated_at = now()
        where id = v_match.sell_intent_id
          and status = 'MATCHED';
      end if;

      if v_ownership_id is not null then
        update public.ownerships
        set status = 'RELEASED'
        where id = v_ownership_id
          and status = 'OWNED';
      end if;
    end if;

    perform public.insert_activity(
      v_match.buyer_id,
      v_match.seller_id,
      'MATCH_COMPLETED',
      v_match.demand_id,
      null,
      v_match.id
    );
    perform public.insert_activity(
      v_match.seller_id,
      v_match.buyer_id,
      'MATCH_COMPLETED',
      v_match.demand_id,
      null,
      v_match.id
    );
  else
    perform public.insert_activity(
      v_peer,
      auth.uid(),
      'MATCH_COMPLETED',
      v_match.demand_id,
      null,
      v_match.id
    );
  end if;

  return v_match;
end;
$$;

revoke all on function public.confirm_match_completion(uuid) from public, anon;
grant execute on function public.confirm_match_completion(uuid) to authenticated;
