-- Idempotent trade transitions for mobile/network/provider retries.

create or replace function public.settlement_mark_paid(
  p_match_id uuid,
  p_provider_ref text
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_ref text := nullif(trim(coalesce(p_provider_ref, '')), '');
begin
  if v_ref is null then raise exception 'provider reference required'; end if;

  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then raise exception 'match not found'; end if;

  if v_match.payment_status = 'PAID' then
    if v_match.payment_provider_ref is not null
       and v_match.payment_provider_ref <> v_ref then
      raise exception 'provider reference mismatch';
    end if;
    return v_match;
  end if;

  if v_match.payment_status = 'REFUNDED' then
    raise exception 'payment already refunded';
  end if;
  if v_match.status <> 'CONNECTED' then raise exception 'match not connected'; end if;
  if v_match.deal_stage <> 'PAYMENT_PENDING' then
    raise exception 'deal is not awaiting payment';
  end if;
  if v_match.payment_due_at is null or v_match.payment_due_at <= now() then
    raise exception 'payment window expired';
  end if;
  if not exists (
    select 1
    from public.deal_snapshots s
    where s.match_id = p_match_id
      and s.locked_at is not null
  ) then
    raise exception 'locked snapshot required';
  end if;

  update public.matches
  set
    payment_status = 'PAID',
    payment_provider_ref = v_ref,
    deal_stage = 'HANDOFF_READY',
    updated_at = now()
  where id = p_match_id
  returning * into v_match;

  return v_match;
end;
$$;

revoke all on function public.settlement_mark_paid(uuid, text) from public;
grant execute on function public.settlement_mark_paid(uuid, text) to service_role;

create or replace function public.settlement_mark_refunded(
  p_match_id uuid
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
begin
  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then raise exception 'match not found'; end if;
  if v_match.payment_status = 'REFUNDED' then return v_match; end if;
  if v_match.payment_status <> 'PAID' then
    raise exception 'payment not paid';
  end if;

  update public.matches
  set
    payment_status = 'REFUNDED',
    deal_stage = 'REFUNDED',
    updated_at = now()
  where id = p_match_id
  returning * into v_match;

  return v_match;
end;
$$;

revoke all on function public.settlement_mark_refunded(uuid) from public;
grant execute on function public.settlement_mark_refunded(uuid) to service_role;

create or replace function public.cancel_deal(
  p_match_id uuid,
  p_reason text
)
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

  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then raise exception 'match not found'; end if;
  if auth.uid() <> v_match.buyer_id and auth.uid() <> v_match.seller_id then
    raise exception 'forbidden';
  end if;

  if v_match.status = 'CLOSED'
     and v_match.deal_stage = 'CANCELLED'
     and v_match.cancelled_by = auth.uid() then
    return v_match;
  end if;

  if v_match.status <> 'CONNECTED' then
    raise exception 'trade not cancellable';
  end if;

  if p_reason not in (
    'BUYER_CHANGED_MIND',
    'SELLER_CHANGED_MIND',
    'SELLER_CHANGED_TERMS',
    'BUYER_NO_PAYMENT',
    'ITEM_UNAVAILABLE',
    'MUTUAL_CANCEL',
    'SYSTEM_CANCEL',
    'RISK_CANCEL'
  ) then
    raise exception 'invalid cancel reason';
  end if;

  if v_match.payment_status = 'PAID' then
    raise exception 'paid trade must use dispute/refund flow';
  end if;

  v_peer := case
    when auth.uid() = v_match.buyer_id then v_match.seller_id
    else v_match.buyer_id
  end;

  update public.matches
  set
    status = 'CLOSED',
    deal_stage = 'CANCELLED',
    cancel_reason = p_reason,
    cancelled_by = auth.uid(),
    cancel_fault_party = null,
    updated_at = now()
  where id = p_match_id
  returning * into v_match;

  perform public.insert_activity(
    v_peer,
    auth.uid(),
    'MATCH_TRADE_CLOSED',
    v_match.demand_id,
    null,
    v_match.id
  );

  return v_match;
end;
$$;

revoke all on function public.cancel_deal(uuid, text) from public;
grant execute on function public.cancel_deal(uuid, text) to authenticated;

create or replace function public.open_deal_dispute(
  p_match_id uuid,
  p_reason text,
  p_detail text default ''
)
returns public.deal_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_existing public.deal_disputes%rowtype;
  v_row public.deal_disputes%rowtype;
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
  if v_match.status <> 'CONNECTED' then
    raise exception 'trade not open for dispute';
  end if;
  if v_match.payment_status <> 'PAID' then
    raise exception 'payment not completed';
  end if;
  if p_reason not in (
    'ITEM_NOT_RECEIVED',
    'WRONG_ITEM',
    'SNAPSHOT_MISMATCH',
    'MAJOR_UNDISCLOSED_DEFECT',
    'OTHER'
  ) then
    raise exception 'invalid dispute reason';
  end if;

  select * into v_existing
  from public.deal_disputes d
  where d.match_id = p_match_id
    and d.status in ('OPEN','REVIEWING')
  order by d.created_at desc
  limit 1
  for update;

  if found then
    if v_existing.opened_by = auth.uid()
       and v_existing.reason = p_reason then
      return v_existing;
    end if;
    raise exception 'open dispute already exists';
  end if;

  insert into public.deal_disputes (
    match_id,
    opened_by,
    reason,
    detail
  )
  values (
    p_match_id,
    auth.uid(),
    p_reason,
    left(trim(coalesce(p_detail, '')), 2000)
  )
  returning * into v_row;

  update public.matches
  set deal_stage = 'DISPUTE', updated_at = now()
  where id = p_match_id;

  return v_row;
end;
$$;

revoke all on function public.open_deal_dispute(uuid, text, text) from public;
grant execute on function public.open_deal_dispute(uuid, text, text) to authenticated;

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

  if v_match.status = 'COMPLETED' then
    return v_match;
  end if;

  if v_match.status <> 'CONNECTED' then
    raise exception 'invalid transition from % to COMPLETED', v_match.status;
  end if;

  select * into v_demand
  from public.demands
  where id = v_match.demand_id;

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
    update public.matches
    set
      status = 'COMPLETED',
      completed_at = now(),
      deal_stage = case
        when v_demand.type = 'BUY' then 'COMPLETED'
        else deal_stage
      end,
      updated_at = now()
    where id = p_match_id
    returning * into v_match;

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

revoke all on function public.confirm_match_completion(uuid) from public;
grant execute on function public.confirm_match_completion(uuid) to authenticated;
