-- DAN V1 six-hour payment window.
-- Locked snapshot remains immutable; payment timeout closes that deal and
-- re-opens the underlying demand/sell intent instead of mutating history.

alter table public.matches
  add column if not exists payment_due_at timestamptz;

create or replace function public.set_buy_payment_window()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_type text;
begin
  if new.deal_stage = 'DEAL_LOCKED'
     and old.deal_stage is distinct from 'DEAL_LOCKED' then
    select d.type into v_type
    from public.demands d
    where d.id = new.demand_id;

    if v_type = 'BUY' then
      new.deal_stage := 'PAYMENT_PENDING';
      new.payment_status := case
        when new.payment_status = 'PAID' then 'PAID'
        else 'PENDING'
      end;
      new.payment_due_at := now() + interval '6 hours';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_buy_payment_window on public.matches;
create trigger trg_buy_payment_window
before update of deal_stage on public.matches
for each row execute function public.set_buy_payment_window();

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
  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then raise exception 'match not found'; end if;
  if v_match.status <> 'CONNECTED' then raise exception 'match not connected'; end if;
  if v_match.deal_stage <> 'PAYMENT_PENDING' then
    raise exception 'deal is not awaiting payment';
  end if;
  if v_match.payment_due_at is null or v_match.payment_due_at <= now() then
    raise exception 'payment window expired';
  end if;
  if not exists (
    select 1 from public.deal_snapshots s
    where s.match_id = p_match_id and s.locked_at is not null
  ) then
    raise exception 'locked snapshot required';
  end if;

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

create or replace function public.expire_unpaid_deals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.matches%rowtype;
  v_count integer := 0;
begin
  for v_row in
    select *
    from public.matches
    where status = 'CONNECTED'
      and deal_stage = 'PAYMENT_PENDING'
      and payment_status = 'PENDING'
      and payment_due_at is not null
      and payment_due_at <= now()
    for update skip locked
  loop
    update public.matches
    set
      status = 'CLOSED',
      deal_stage = 'CANCELLED',
      cancel_reason = 'BUYER_NO_PAYMENT',
      cancel_fault_party = 'BUYER',
      updated_at = now()
    where id = v_row.id;

    update public.demands
    set
      status = 'ACTIVE',
      expires_at = now() + interval '7 days',
      updated_at = now()
    where id = v_row.demand_id
      and type = 'BUY'
      and status = 'MATCHED';

    if v_row.sell_intent_id is not null then
      update public.sell_intents
      set status = 'OPEN', updated_at = now()
      where id = v_row.sell_intent_id
        and status = 'MATCHED';
    end if;

    perform public.insert_activity(
      v_row.buyer_id,
      null,
      'MATCH_TRADE_CLOSED',
      v_row.demand_id,
      null,
      v_row.id
    );
    perform public.insert_activity(
      v_row.seller_id,
      null,
      'MATCH_TRADE_CLOSED',
      v_row.demand_id,
      null,
      v_row.id
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.expire_unpaid_deals() from public;
grant execute on function public.expire_unpaid_deals() to service_role;
