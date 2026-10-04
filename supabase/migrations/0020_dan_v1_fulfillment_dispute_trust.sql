-- DAN V1 fulfillment, dispute, and factual trust history.
-- Additive. Payment state is provider-controlled; clients cannot mark themselves paid.

alter table public.matches
  add column if not exists cancelled_by uuid references public.profiles (id) on delete set null,
  add column if not exists cancel_fault_party text
    check (cancel_fault_party is null or cancel_fault_party in ('BUYER','SELLER','NONE')),
  add column if not exists payment_provider_ref text;

create table if not exists public.deal_disputes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  opened_by uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in (
    'ITEM_NOT_RECEIVED',
    'WRONG_ITEM',
    'SNAPSHOT_MISMATCH',
    'MAJOR_UNDISCLOSED_DEFECT',
    'OTHER'
  )),
  detail text not null default '',
  status text not null default 'OPEN' check (status in (
    'OPEN',
    'REVIEWING',
    'RESOLVED_BUYER',
    'RESOLVED_SELLER',
    'CLOSED'
  )),
  attributed_fault text
    check (attributed_fault is null or attributed_fault in ('BUYER','SELLER','NONE')),
  resolution_note text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists deal_disputes_match_idx
  on public.deal_disputes (match_id, created_at desc);

alter table public.deal_disputes enable row level security;

drop policy if exists deal_disputes_participants_read on public.deal_disputes;
create policy deal_disputes_participants_read
on public.deal_disputes for select
to authenticated
using (
  exists (
    select 1 from public.matches m
    where m.id = match_id
      and auth.uid() in (m.buyer_id, m.seller_id)
  )
);

revoke insert, update, delete on public.deal_disputes from anon, authenticated;
grant select on public.deal_disputes to authenticated;

-- Participant opens a structured dispute. No free-form "chargeback" behavior:
-- payment/refund resolution remains an ops/provider action.
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
  v_row public.deal_disputes%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_match from public.matches where id = p_match_id for update;
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
  if exists (
    select 1 from public.deal_disputes d
    where d.match_id = p_match_id and d.status in ('OPEN','REVIEWING')
  ) then
    raise exception 'open dispute already exists';
  end if;

  insert into public.deal_disputes (match_id, opened_by, reason, detail)
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

-- Structured cancellation. The selected reason is recorded, but no public
-- fault is inferred from a participant's self-report.
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

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  if auth.uid() <> v_match.buyer_id and auth.uid() <> v_match.seller_id then
    raise exception 'forbidden';
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
    v_peer, auth.uid(), 'MATCH_TRADE_CLOSED',
    v_match.demand_id, null, v_match.id
  );

  return v_match;
end;
$$;

revoke all on function public.cancel_deal(uuid, text) from public;
grant execute on function public.cancel_deal(uuid, text) to authenticated;

-- Payment provider / trusted backend only.
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
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  if v_match.status <> 'CONNECTED' then raise exception 'match not connected'; end if;
  if v_match.deal_stage <> 'DEAL_LOCKED' then raise exception 'deal snapshot not locked'; end if;

  update public.matches
  set
    payment_status = 'PAID',
    payment_provider_ref = nullif(trim(coalesce(p_provider_ref, '')), ''),
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
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;

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

-- BUY completion is permitted only after locked terms + provider-confirmed PAID
-- and while no unresolved dispute exists. Non-BUY legacy flow is unchanged.
create or replace function public.confirm_match_completion(p_match_id uuid)
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

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  if v_match.status <> 'CONNECTED' then
    raise exception 'invalid transition from % to COMPLETED', v_match.status;
  end if;
  if auth.uid() <> v_match.buyer_id and auth.uid() <> v_match.seller_id then
    raise exception 'forbidden';
  end if;

  select * into v_demand from public.demands where id = v_match.demand_id;

  if v_demand.type = 'BUY' then
    if v_match.payment_status <> 'PAID' then
      raise exception 'safe payment required';
    end if;
    if not exists (
      select 1 from public.deal_snapshots s
      where s.match_id = p_match_id and s.locked_at is not null
    ) then
      raise exception 'locked deal snapshot required';
    end if;
    if exists (
      select 1 from public.deal_disputes d
      where d.match_id = p_match_id and d.status in ('OPEN','REVIEWING')
    ) then
      raise exception 'open dispute blocks completion';
    end if;
  end if;

  v_is_buyer := auth.uid() = v_match.buyer_id;
  v_peer := case when v_is_buyer then v_match.seller_id else v_match.buyer_id end;

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

  v_both := v_match.buyer_completed_at is not null
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

-- Ops-only attribution: public Trust History never infers fault from a user's
-- own cancellation reason.
create or replace function public.ops_attribute_cancel_fault(
  p_match_id uuid,
  p_fault_party text
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
begin
  if p_fault_party not in ('BUYER','SELLER','NONE') then
    raise exception 'invalid fault party';
  end if;
  update public.matches
  set cancel_fault_party = p_fault_party, updated_at = now()
  where id = p_match_id
  returning * into v_match;
  if not found then raise exception 'match not found'; end if;
  return v_match;
end;
$$;

revoke all on function public.ops_attribute_cancel_fault(uuid, text) from public;
grant execute on function public.ops_attribute_cancel_fault(uuid, text) to service_role;

create or replace function public.ops_resolve_deal_dispute(
  p_dispute_id uuid,
  p_status text,
  p_fault_party text,
  p_resolution_note text default ''
)
returns public.deal_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.deal_disputes%rowtype;
begin
  if p_status not in ('RESOLVED_BUYER','RESOLVED_SELLER','CLOSED') then
    raise exception 'invalid resolution status';
  end if;
  if p_fault_party not in ('BUYER','SELLER','NONE') then
    raise exception 'invalid fault party';
  end if;

  update public.deal_disputes
  set
    status = p_status,
    attributed_fault = p_fault_party,
    resolution_note = left(trim(coalesce(p_resolution_note, '')), 2000),
    resolved_at = now()
  where id = p_dispute_id
  returning * into v_row;
  if not found then raise exception 'dispute not found'; end if;

  return v_row;
end;
$$;

revoke all on function public.ops_resolve_deal_dispute(uuid, text, text, text) from public;
grant execute on function public.ops_resolve_deal_dispute(uuid, text, text, text) to service_role;

-- Facts-only public trust summary.
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
  v_buyer_fault_cancel int;
  v_seller_fault_cancel int;
  v_unresolved_dispute int;
  v_confirmed_mismatch int;
  v_recent jsonb;
begin
  if p_user_id is null then return null; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then return null; end if;

  select count(*)::int into v_completed
  from public.matches
  where status = 'COMPLETED'
    and (buyer_id = p_user_id or seller_id = p_user_id);

  select count(*)::int into v_response
  from public.matches
  where status in ('CONNECTED','COMPLETED') and seller_id = p_user_id;

  select count(*)::int into v_connection
  from public.matches
  where status in ('CONNECTED','COMPLETED')
    and (buyer_id = p_user_id or seller_id = p_user_id);

  select count(*)::int into v_buyer_fault_cancel
  from public.matches
  where cancel_fault_party = 'BUYER' and buyer_id = p_user_id;

  select count(*)::int into v_seller_fault_cancel
  from public.matches
  where cancel_fault_party = 'SELLER' and seller_id = p_user_id;

  select count(*)::int into v_unresolved_dispute
  from public.deal_disputes d
  join public.matches m on m.id = d.match_id
  where d.status in ('OPEN','REVIEWING')
    and (m.buyer_id = p_user_id or m.seller_id = p_user_id);

  select count(*)::int into v_confirmed_mismatch
  from public.deal_disputes d
  join public.matches m on m.id = d.match_id
  where d.reason = 'SNAPSHOT_MISMATCH'
    and d.attributed_fault = 'SELLER'
    and m.seller_id = p_user_id
    and d.status in ('RESOLVED_BUYER','RESOLVED_SELLER','CLOSED');

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
    'buyerFaultCancellationCount', v_buyer_fault_cancel,
    'sellerFaultCancellationCount', v_seller_fault_cancel,
    'unresolvedDisputeCount', v_unresolved_dispute,
    'confirmedMismatchCount', v_confirmed_mismatch,
    'recentActivity', v_recent,
    'viewerIsSelf', v_is_self
  );
end;
$$;

revoke all on function public.get_public_profile_trust(uuid) from public;
grant execute on function public.get_public_profile_trust(uuid) to authenticated;
