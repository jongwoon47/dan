-- DAN V1 minimum operations backbone.
-- Admin access is explicit and server-checked. No client can self-assign admin.

create table if not exists public.dan_admin_users (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null default 'OPERATOR' check (role in ('OPERATOR','ADMIN')),
  created_at timestamptz not null default now()
);

alter table public.dan_admin_users enable row level security;
revoke all on public.dan_admin_users from anon, authenticated;

create or replace function public.is_dan_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dan_admin_users a
    where a.user_id = p_user_id
  );
$$;

revoke all on function public.is_dan_admin(uuid) from public;
grant execute on function public.is_dan_admin(uuid) to authenticated;

create table if not exists public.risk_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  match_id uuid references public.matches (id) on delete set null,
  sell_intent_id uuid references public.sell_intents (id) on delete set null,
  kind text not null check (kind in (
    'NEW_ACCOUNT_HIGH_VALUE',
    'DUPLICATE_ITEM_SIGNAL',
    'SHARED_PAYOUT_ACCOUNT',
    'REPEATED_DISPUTES',
    'REPEATED_ATTRIBUTED_CANCELS',
    'OFF_PLATFORM_PAYMENT_STEERING',
    'MANUAL_REVIEW'
  )),
  severity text not null default 'MEDIUM' check (severity in ('LOW','MEDIUM','HIGH')),
  status text not null default 'OPEN' check (status in ('OPEN','REVIEWING','RESOLVED','DISMISSED')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists risk_flags_open_idx
  on public.risk_flags (status, severity, created_at desc);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_created_idx
  on public.admin_audit_log (created_at desc);

alter table public.risk_flags enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists risk_flags_admin_read on public.risk_flags;
create policy risk_flags_admin_read
on public.risk_flags for select
to authenticated
using (public.is_dan_admin(auth.uid()));

drop policy if exists admin_audit_admin_read on public.admin_audit_log;
create policy admin_audit_admin_read
on public.admin_audit_log for select
to authenticated
using (public.is_dan_admin(auth.uid()));

revoke insert, update, delete on public.risk_flags from anon, authenticated;
revoke insert, update, delete on public.admin_audit_log from anon, authenticated;
grant select on public.risk_flags, public.admin_audit_log to authenticated;

create or replace function public.insert_risk_flag(
  p_user_id uuid,
  p_match_id uuid,
  p_sell_intent_id uuid,
  p_kind text,
  p_severity text,
  p_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in (
    'NEW_ACCOUNT_HIGH_VALUE',
    'DUPLICATE_ITEM_SIGNAL',
    'SHARED_PAYOUT_ACCOUNT',
    'REPEATED_DISPUTES',
    'REPEATED_ATTRIBUTED_CANCELS',
    'OFF_PLATFORM_PAYMENT_STEERING',
    'MANUAL_REVIEW'
  ) then
    raise exception 'invalid risk kind';
  end if;
  if p_severity not in ('LOW','MEDIUM','HIGH') then
    raise exception 'invalid risk severity';
  end if;

  if exists (
    select 1 from public.risk_flags r
    where r.status in ('OPEN','REVIEWING')
      and r.kind = p_kind
      and r.user_id is not distinct from p_user_id
      and r.match_id is not distinct from p_match_id
      and r.sell_intent_id is not distinct from p_sell_intent_id
  ) then
    return;
  end if;

  insert into public.risk_flags (
    user_id, match_id, sell_intent_id, kind, severity, detail
  ) values (
    p_user_id, p_match_id, p_sell_intent_id, p_kind, p_severity, coalesce(p_detail, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.insert_risk_flag(uuid, uuid, uuid, text, text, jsonb) from public;

-- New account + high-value Quick Offer.
create or replace function public.flag_new_account_high_value_offer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created timestamptz;
begin
  if new.status <> 'OPEN' or new.minimum_price < 2000000 then
    return new;
  end if;

  select p.created_at into v_created
  from public.profiles p where p.id = new.user_id;

  if v_created is not null and v_created >= now() - interval '7 days' then
    perform public.insert_risk_flag(
      new.user_id,
      null,
      new.id,
      'NEW_ACCOUNT_HIGH_VALUE',
      'MEDIUM',
      jsonb_build_object('minimumPrice', new.minimum_price)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_risk_new_account_high_value on public.sell_intents;
create trigger trg_risk_new_account_high_value
after insert or update of minimum_price, status on public.sell_intents
for each row execute function public.flag_new_account_high_value_offer();

-- Duplicate item signal: same product + serial fragment in another open/connected deal.
-- This is a review signal only; last-4 collisions do not hard-block a seller.
create or replace function public.flag_duplicate_item_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_other uuid;
begin
  if new.serial_last4 is null or trim(new.serial_last4) = '' then return new; end if;

  select * into v_match from public.matches where id = new.match_id;
  if not found or v_match.product_id is null then return new; end if;

  select e.match_id into v_other
  from public.deal_evidence e
  join public.matches m on m.id = e.match_id
  where e.match_id <> new.match_id
    and e.serial_last4 = new.serial_last4
    and m.product_id = v_match.product_id
    and m.status in ('BUYER_INTERESTED','CONNECTED')
  limit 1;

  if v_other is not null then
    perform public.insert_risk_flag(
      new.seller_id,
      new.match_id,
      v_match.sell_intent_id,
      'DUPLICATE_ITEM_SIGNAL',
      'MEDIUM',
      jsonb_build_object(
        'serialLast4', new.serial_last4,
        'otherMatchId', v_other
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_risk_duplicate_item on public.deal_evidence;
create trigger trg_risk_duplicate_item
after insert or update of serial_last4 on public.deal_evidence
for each row execute function public.flag_duplicate_item_signal();

-- Shared payout account across different user IDs.
create or replace function public.flag_shared_payout_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other uuid;
begin
  if new.payout_account_ref is null or trim(new.payout_account_ref) = '' then
    return new;
  end if;

  select v.user_id into v_other
  from public.user_verifications v
  where v.user_id <> new.user_id
    and v.payout_account_ref = new.payout_account_ref
  limit 1;

  if v_other is not null then
    perform public.insert_risk_flag(
      new.user_id, null, null,
      'SHARED_PAYOUT_ACCOUNT', 'HIGH',
      jsonb_build_object('otherUserId', v_other)
    );
    perform public.insert_risk_flag(
      v_other, null, null,
      'SHARED_PAYOUT_ACCOUNT', 'HIGH',
      jsonb_build_object('otherUserId', new.user_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_risk_shared_payout on public.user_verifications;
create trigger trg_risk_shared_payout
after insert or update of payout_account_ref on public.user_verifications
for each row execute function public.flag_shared_payout_account();

-- Repeated dispute opener signal.
create or replace function public.flag_repeated_disputes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*)::integer into v_count
  from public.deal_disputes d
  where d.opened_by = new.opened_by
    and d.created_at >= now() - interval '30 days';

  if v_count >= 3 then
    perform public.insert_risk_flag(
      new.opened_by, new.match_id, null,
      'REPEATED_DISPUTES', 'MEDIUM',
      jsonb_build_object('count30d', v_count)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_risk_repeated_disputes on public.deal_disputes;
create trigger trg_risk_repeated_disputes
after insert on public.deal_disputes
for each row execute function public.flag_repeated_disputes();

create or replace function public.admin_update_risk_flag(
  p_flag_id uuid,
  p_status text
)
returns public.risk_flags
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.risk_flags%rowtype;
begin
  if not public.is_dan_admin(auth.uid()) then raise exception 'admin only'; end if;
  if p_status not in ('OPEN','REVIEWING','RESOLVED','DISMISSED') then
    raise exception 'invalid risk status';
  end if;

  update public.risk_flags
  set
    status = p_status,
    resolved_at = case when p_status in ('RESOLVED','DISMISSED') then now() else null end
  where id = p_flag_id
  returning * into v_row;

  if not found then raise exception 'risk flag not found'; end if;

  insert into public.admin_audit_log (
    actor_id, action, target_type, target_id, detail
  ) values (
    auth.uid(), 'RISK_FLAG_STATUS_CHANGED', 'risk_flag', p_flag_id::text,
    jsonb_build_object('status', p_status)
  );

  return v_row;
end;
$$;

revoke all on function public.admin_update_risk_flag(uuid, text) from public;
grant execute on function public.admin_update_risk_flag(uuid, text) to authenticated;
