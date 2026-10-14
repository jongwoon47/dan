-- DAN V1 demand-first trust flow
-- Live Demand -> Quick Offer -> Deal Evidence -> Deal Snapshot -> settlement placeholder.
-- Additive migration: existing V0 flows continue to work.

-- ---------------------------------------------------------------------------
-- Quick Offer metadata
-- ---------------------------------------------------------------------------
alter table public.sell_intents
  add column if not exists target_demand_id uuid references public.demands (id) on delete set null,
  add column if not exists approx_usage_count integer check (approx_usage_count is null or approx_usage_count >= 0),
  add column if not exists condition_note text not null default '',
  add column if not exists quick_photo_url text;

create index if not exists sell_intents_target_demand_idx
  on public.sell_intents (target_demand_id, status, created_at desc)
  where target_demand_id is not null;

-- ---------------------------------------------------------------------------
-- Deal evidence — seller-submitted evidence, never presented as DAN verification.
-- ---------------------------------------------------------------------------
create table if not exists public.deal_evidence (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  possession_photo_url text,
  serial_last4 text check (serial_last4 is null or char_length(serial_last4) <= 8),
  usage_count integer check (usage_count is null or usage_count >= 0),
  purchase_date date,
  warranty_until date,
  components jsonb not null default '[]'::jsonb,
  cosmetic_notes text not null default '',
  known_issues text not null default '',
  repair_history text not null default '',
  water_damage_statement text not null default '',
  evidence_meta jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_deal_evidence_updated
before update on public.deal_evidence
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Immutable deal snapshot.
-- A snapshot can be prepared while both sides review it. Once both confirm,
-- locked_at is set and payload/price can no longer change.
-- ---------------------------------------------------------------------------
create table if not exists public.deal_snapshots (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches (id) on delete cascade,
  demand_id uuid not null references public.demands (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  agreed_price numeric(12,0) not null check (agreed_price > 0),
  snapshot jsonb not null,
  buyer_confirmed_at timestamptz,
  seller_confirmed_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_snapshots_not_self check (buyer_id <> seller_id)
);

create trigger trg_deal_snapshots_updated
before update on public.deal_snapshots
for each row execute function public.set_updated_at();

-- Payment/fulfillment states are intentionally provider-agnostic.
-- No payment provider is called by this migration.
alter table public.matches
  add column if not exists deal_stage text not null default 'MATCHING'
    check (deal_stage in (
      'MATCHING',
      'BUYER_INTERESTED',
      'EVIDENCE_PENDING',
      'EVIDENCE_READY',
      'DEAL_REVIEW',
      'DEAL_LOCKED',
      'PAYMENT_PENDING',
      'PAID',
      'HANDOFF_READY',
      'COMPLETED',
      'DISPUTE',
      'CANCELLED',
      'REFUNDED'
    )),
  add column if not exists payment_status text not null default 'NOT_STARTED'
    check (payment_status in ('NOT_STARTED','PENDING','PAID','REFUNDED')),
  add column if not exists cancel_reason text
    check (
      cancel_reason is null or cancel_reason in (
        'BUYER_CHANGED_MIND',
        'SELLER_CHANGED_MIND',
        'SELLER_CHANGED_TERMS',
        'BUYER_NO_PAYMENT',
        'ITEM_UNAVAILABLE',
        'MUTUAL_CANCEL',
        'SYSTEM_CANCEL',
        'RISK_CANCEL'
      )
    );

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.deal_evidence enable row level security;
alter table public.deal_snapshots enable row level security;

drop policy if exists deal_evidence_participants_read on public.deal_evidence;
create policy deal_evidence_participants_read
on public.deal_evidence for select
to authenticated
using (
  exists (
    select 1 from public.matches m
    where m.id = match_id
      and auth.uid() in (m.buyer_id, m.seller_id)
  )
);

drop policy if exists deal_snapshots_participants_read on public.deal_snapshots;
create policy deal_snapshots_participants_read
on public.deal_snapshots for select
to authenticated
using (auth.uid() in (buyer_id, seller_id));

-- Writes go through RPCs only.
revoke insert, update, delete on public.deal_evidence from anon, authenticated;
revoke insert, update, delete on public.deal_snapshots from anon, authenticated;
grant select on public.deal_evidence to authenticated;
grant select on public.deal_snapshots to authenticated;

-- ---------------------------------------------------------------------------
-- Seller evidence
-- ---------------------------------------------------------------------------
create or replace function public.upsert_deal_evidence(
  p_match_id uuid,
  p_payload jsonb
)
returns public.deal_evidence
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_row public.deal_evidence%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  if v_match.seller_id <> auth.uid() then raise exception 'seller only'; end if;
  if v_match.status not in ('BUYER_INTERESTED','CONNECTED') then
    raise exception 'match not ready for evidence';
  end if;

  insert into public.deal_evidence (
    match_id,
    seller_id,
    possession_photo_url,
    serial_last4,
    usage_count,
    purchase_date,
    warranty_until,
    components,
    cosmetic_notes,
    known_issues,
    repair_history,
    water_damage_statement,
    evidence_meta
  )
  values (
    p_match_id,
    auth.uid(),
    nullif(trim(coalesce(p_payload->>'possessionPhotoUrl','')), ''),
    nullif(trim(coalesce(p_payload->>'serialLast4','')), ''),
    case when coalesce(p_payload->>'usageCount','') ~ '^[0-9]+$'
      then (p_payload->>'usageCount')::integer else null end,
    case when coalesce(p_payload->>'purchaseDate','') ~ '^\\d{4}-\\d{2}-\\d{2}$'
      then (p_payload->>'purchaseDate')::date else null end,
    case when coalesce(p_payload->>'warrantyUntil','') ~ '^\\d{4}-\\d{2}-\\d{2}$'
      then (p_payload->>'warrantyUntil')::date else null end,
    coalesce(p_payload->'components', '[]'::jsonb),
    trim(coalesce(p_payload->>'cosmeticNotes','')),
    trim(coalesce(p_payload->>'knownIssues','')),
    trim(coalesce(p_payload->>'repairHistory','')),
    trim(coalesce(p_payload->>'waterDamageStatement','')),
    coalesce(p_payload->'evidenceMeta', '{}'::jsonb)
  )
  on conflict (match_id) do update set
    possession_photo_url = excluded.possession_photo_url,
    serial_last4 = excluded.serial_last4,
    usage_count = excluded.usage_count,
    purchase_date = excluded.purchase_date,
    warranty_until = excluded.warranty_until,
    components = excluded.components,
    cosmetic_notes = excluded.cosmetic_notes,
    known_issues = excluded.known_issues,
    repair_history = excluded.repair_history,
    water_damage_statement = excluded.water_damage_statement,
    evidence_meta = excluded.evidence_meta,
    submitted_at = now()
  returning * into v_row;

  update public.matches
  set deal_stage = 'EVIDENCE_READY', updated_at = now()
  where id = p_match_id;

  return v_row;
end;
$$;

revoke all on function public.upsert_deal_evidence(uuid, jsonb) from public;
grant execute on function public.upsert_deal_evidence(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Prepare/confirm Deal Snapshot.
-- First caller creates the snapshot. Until locked, a participant may replace
-- the proposed payload; any change clears prior confirmations.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_deal_snapshot(
  p_match_id uuid,
  p_agreed_price numeric,
  p_snapshot jsonb
)
returns public.deal_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_demand public.demands%rowtype;
  v_row public.deal_snapshots%rowtype;
  v_existing public.deal_snapshots%rowtype;
  v_changed boolean := false;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_agreed_price is null or p_agreed_price <= 0 then raise exception 'invalid price'; end if;
  if p_snapshot is null then raise exception 'snapshot required'; end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  if auth.uid() <> v_match.buyer_id and auth.uid() <> v_match.seller_id then
    raise exception 'forbidden';
  end if;
  if v_match.status not in ('BUYER_INTERESTED','CONNECTED') then
    raise exception 'match not ready for deal';
  end if;

  if not exists (select 1 from public.deal_evidence e where e.match_id = p_match_id) then
    raise exception 'evidence required';
  end if;

  select * into v_demand from public.demands where id = v_match.demand_id;
  if not found then raise exception 'demand not found'; end if;

  select * into v_existing
  from public.deal_snapshots
  where match_id = p_match_id
  for update;

  if found and v_existing.locked_at is not null then
    return v_existing;
  end if;

  if found then
    v_changed :=
      v_existing.agreed_price <> p_agreed_price
      or v_existing.snapshot <> p_snapshot;

    update public.deal_snapshots
    set
      agreed_price = p_agreed_price,
      snapshot = p_snapshot,
      buyer_confirmed_at = case
        when v_changed then case when auth.uid() = v_match.buyer_id then now() else null end
        else case when auth.uid() = v_match.buyer_id then coalesce(buyer_confirmed_at, now()) else buyer_confirmed_at end
      end,
      seller_confirmed_at = case
        when v_changed then case when auth.uid() = v_match.seller_id then now() else null end
        else case when auth.uid() = v_match.seller_id then coalesce(seller_confirmed_at, now()) else seller_confirmed_at end
      end
    where match_id = p_match_id
    returning * into v_row;
  else
    insert into public.deal_snapshots (
      match_id, demand_id, product_id, buyer_id, seller_id,
      agreed_price, snapshot, buyer_confirmed_at, seller_confirmed_at
    )
    values (
      p_match_id, v_match.demand_id, v_match.product_id,
      v_match.buyer_id, v_match.seller_id,
      p_agreed_price, p_snapshot,
      case when auth.uid() = v_match.buyer_id then now() else null end,
      case when auth.uid() = v_match.seller_id then now() else null end
    )
    returning * into v_row;
  end if;

  if v_row.buyer_confirmed_at is not null and v_row.seller_confirmed_at is not null then
    update public.deal_snapshots
    set locked_at = coalesce(locked_at, now())
    where id = v_row.id
    returning * into v_row;

    update public.matches
    set deal_stage = 'DEAL_LOCKED', updated_at = now()
    where id = p_match_id;
  else
    update public.matches
    set deal_stage = 'DEAL_REVIEW', updated_at = now()
    where id = p_match_id;
  end if;

  return v_row;
end;
$$;

revoke all on function public.confirm_deal_snapshot(uuid, numeric, jsonb) from public;
grant execute on function public.confirm_deal_snapshot(uuid, numeric, jsonb) to authenticated;
