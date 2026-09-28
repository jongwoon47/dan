-- DAN V1 trust integrity hardening.
-- 1) fresh possession challenge for seller evidence
-- 2) evidence becomes immutable after Deal Snapshot lock
-- 3) snapshot payload is built canonically by the database
-- 4) legacy close_match cannot bypass BUY cancellation/dispute rules
-- 5) one matched sell intent closes other interested buyers

-- ---------------------------------------------------------------------------
-- Evidence possession challenge
-- ---------------------------------------------------------------------------
create table if not exists public.deal_evidence_challenges (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  challenge_code text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.deal_evidence_challenges enable row level security;

drop policy if exists deal_evidence_challenges_seller_read on public.deal_evidence_challenges;
create policy deal_evidence_challenges_seller_read
on public.deal_evidence_challenges for select
to authenticated
using (seller_id = auth.uid());

revoke insert, update, delete on public.deal_evidence_challenges from anon, authenticated;
grant select on public.deal_evidence_challenges to authenticated;

create or replace function public.issue_deal_evidence_challenge(p_match_id uuid)
returns public.deal_evidence_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_row public.deal_evidence_challenges%rowtype;
  v_code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then raise exception 'match not found'; end if;
  if v_match.seller_id <> auth.uid() then raise exception 'seller only'; end if;
  if v_match.status not in ('BUYER_INTERESTED','CONNECTED') then
    raise exception 'match not ready for evidence';
  end if;

  if exists (
    select 1 from public.deal_snapshots s
    where s.match_id = p_match_id and s.locked_at is not null
  ) then
    raise exception 'deal snapshot already locked';
  end if;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.deal_evidence_challenges (
    match_id, seller_id, challenge_code, expires_at, consumed_at
  )
  values (
    p_match_id, auth.uid(), v_code, now() + interval '15 minutes', null
  )
  on conflict (match_id) do update
  set
    seller_id = excluded.seller_id,
    challenge_code = excluded.challenge_code,
    expires_at = excluded.expires_at,
    consumed_at = null,
    created_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.issue_deal_evidence_challenge(uuid) from public;
grant execute on function public.issue_deal_evidence_challenge(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Evidence submission: fresh challenge + possession photo required.
-- Any unlocked snapshot proposal is invalidated if evidence changes.
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
  v_challenge public.deal_evidence_challenges%rowtype;
  v_photo text := nullif(trim(coalesce(p_payload->>'possessionPhotoUrl', '')), '');
  v_code text := upper(trim(coalesce(p_payload->>'challengeCode', '')));
  v_serial text := nullif(trim(coalesce(p_payload->>'serialLast4', '')), '');
  v_components jsonb := coalesce(p_payload->'components', '[]'::jsonb);
  v_purchase_date date;
  v_warranty_until date;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then raise exception 'match not found'; end if;
  if v_match.seller_id <> auth.uid() then raise exception 'seller only'; end if;
  if v_match.status not in ('BUYER_INTERESTED','CONNECTED') then
    raise exception 'match not ready for evidence';
  end if;

  if exists (
    select 1 from public.deal_snapshots s
    where s.match_id = p_match_id and s.locked_at is not null
  ) then
    raise exception 'locked deal evidence is immutable';
  end if;

  if v_photo is null then
    raise exception 'possession photo required';
  end if;
  if v_photo not like 'storage://dan-v1-evidence/%' then
    raise exception 'private DAN evidence storage reference required';
  end if;

  select * into v_challenge
  from public.deal_evidence_challenges
  where match_id = p_match_id
  for update;

  if not found
     or v_challenge.seller_id <> auth.uid()
     or v_challenge.consumed_at is not null
     or v_challenge.expires_at <= now()
     or v_challenge.challenge_code <> v_code then
    raise exception 'fresh evidence challenge required';
  end if;

  if jsonb_typeof(v_components) <> 'array' then
    raise exception 'components must be an array';
  end if;

  if nullif(p_payload->>'purchaseDate', '') is not null then
    v_purchase_date := (p_payload->>'purchaseDate')::date;
  end if;
  if nullif(p_payload->>'warrantyUntil', '') is not null then
    v_warranty_until := (p_payload->>'warrantyUntil')::date;
  end if;

  if v_serial is null or char_length(v_serial) < 2 then
    raise exception 'serial fragment required';
  end if;
  if trim(coalesce(p_payload->>'cosmeticNotes', '')) = '' then
    raise exception 'cosmetic notes required';
  end if;
  if trim(coalesce(p_payload->>'knownIssues', '')) = '' then
    raise exception 'known issues statement required';
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
    v_photo,
    v_serial,
    case
      when nullif(p_payload->>'usageCount', '') is null then null
      else (p_payload->>'usageCount')::integer
    end,
    v_purchase_date,
    v_warranty_until,
    v_components,
    trim(coalesce(p_payload->>'cosmeticNotes', '')),
    trim(coalesce(p_payload->>'knownIssues', '')),
    trim(coalesce(p_payload->>'repairHistory', '')),
    trim(coalesce(p_payload->>'waterDamageStatement', '')),
    coalesce(p_payload->'evidenceMeta', '{}'::jsonb)
      || jsonb_build_object(
        'challengeId', v_challenge.id,
        'challengeCode', v_challenge.challenge_code,
        'challengeIssuedAt', v_challenge.created_at
      )
  )
  on conflict (match_id) do update
  set
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
    submitted_at = now(),
    updated_at = now()
  returning * into v_row;

  update public.deal_evidence_challenges
  set consumed_at = now()
  where id = v_challenge.id;

  -- Evidence changed before lock => previous proposal/confirmations are invalid.
  delete from public.deal_snapshots
  where match_id = p_match_id and locked_at is null;

  update public.matches
  set deal_stage = 'EVIDENCE_READY', updated_at = now()
  where id = p_match_id;

  return v_row;
end;
$$;

revoke all on function public.upsert_deal_evidence(uuid, jsonb) from public;
grant execute on function public.upsert_deal_evidence(uuid, jsonb) to authenticated;

-- Locked snapshot rows are immutable even to accidental direct/service writes.
create or replace function public.prevent_locked_deal_snapshot_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.locked_at is not null then
    raise exception 'locked deal snapshot is immutable';
  end if;

  if tg_op = 'UPDATE' and old.locked_at is not null then
    if new.snapshot is distinct from old.snapshot
       or new.agreed_price is distinct from old.agreed_price
       or new.buyer_id is distinct from old.buyer_id
       or new.seller_id is distinct from old.seller_id
       or new.demand_id is distinct from old.demand_id
       or new.product_id is distinct from old.product_id
       or new.locked_at is distinct from old.locked_at then
      raise exception 'locked deal snapshot is immutable';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_locked_deal_snapshot_immutable on public.deal_snapshots;
create trigger trg_locked_deal_snapshot_immutable
before update or delete on public.deal_snapshots
for each row execute function public.prevent_locked_deal_snapshot_mutation();

-- ---------------------------------------------------------------------------
-- Canonical Deal Snapshot. Client payload is advisory only; DB is source of truth.
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
  v_sell public.sell_intents%rowtype;
  v_product public.products%rowtype;
  v_evidence public.deal_evidence%rowtype;
  v_existing public.deal_snapshots%rowtype;
  v_row public.deal_snapshots%rowtype;
  v_canonical jsonb;
  v_changed boolean := false;
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
    raise exception 'connected match required';
  end if;
  if v_match.sell_intent_id is null then
    raise exception 'sell intent required';
  end if;

  select * into v_demand from public.demands where id = v_match.demand_id;
  if not found or v_demand.type <> 'BUY' then raise exception 'buy demand required'; end if;

  select * into v_sell from public.sell_intents where id = v_match.sell_intent_id;
  if not found then raise exception 'sell intent not found'; end if;

  if p_agreed_price is null or p_agreed_price <> v_sell.minimum_price then
    raise exception 'agreed price must match current quick offer';
  end if;

  select * into v_evidence from public.deal_evidence where match_id = p_match_id;
  if not found then raise exception 'evidence required'; end if;

  select * into v_product from public.products where id = v_match.product_id;
  if not found then raise exception 'product not found'; end if;

  v_canonical := jsonb_build_object(
    'schemaVersion', 'dan.deal_snapshot.v1',
    'product', jsonb_build_object(
      'id', v_product.id,
      'name', v_product.canonical_name,
      'brand', coalesce(v_product.brand, ''),
      'model', coalesce(v_product.model, '')
    ),
    'offer', jsonb_build_object(
      'price', v_sell.minimum_price,
      'approxUsageCount', v_sell.approx_usage_count,
      'conditionNote', v_sell.condition_note
    ),
    'evidence', jsonb_build_object(
      'evidenceId', v_evidence.id,
      'possessionPhotoRef', v_evidence.possession_photo_url,
      'serialLast4', v_evidence.serial_last4,
      'usageCount', v_evidence.usage_count,
      'purchaseDate', v_evidence.purchase_date,
      'warrantyUntil', v_evidence.warranty_until,
      'components', v_evidence.components,
      'cosmeticNotes', v_evidence.cosmetic_notes,
      'knownIssues', v_evidence.known_issues,
      'repairHistory', v_evidence.repair_history,
      'waterDamageStatement', v_evidence.water_damage_statement,
      'evidenceMeta', v_evidence.evidence_meta,
      'submittedAt', v_evidence.submitted_at,
      'updatedAt', v_evidence.updated_at
    ),
    'handoff', jsonb_build_object(
      'method', coalesce(v_demand.trade_method, 'meetup'),
      'location', v_demand.location,
      'fulfillmentOptions', coalesce(v_demand.fulfillment_options, '[]'::jsonb)
    )
  );

  select * into v_existing
  from public.deal_snapshots
  where match_id = p_match_id
  for update;

  if found and v_existing.locked_at is not null then
    return v_existing;
  end if;

  if found then
    v_changed :=
      v_existing.agreed_price <> v_sell.minimum_price
      or v_existing.snapshot <> v_canonical;

    update public.deal_snapshots
    set
      agreed_price = v_sell.minimum_price,
      snapshot = v_canonical,
      buyer_confirmed_at = case
        when v_changed then case when auth.uid() = v_match.buyer_id then now() else null end
        else case
          when auth.uid() = v_match.buyer_id then coalesce(buyer_confirmed_at, now())
          else buyer_confirmed_at
        end
      end,
      seller_confirmed_at = case
        when v_changed then case when auth.uid() = v_match.seller_id then now() else null end
        else case
          when auth.uid() = v_match.seller_id then coalesce(seller_confirmed_at, now())
          else seller_confirmed_at
        end
      end
    where id = v_existing.id
    returning * into v_row;
  else
    insert into public.deal_snapshots (
      match_id,
      demand_id,
      product_id,
      buyer_id,
      seller_id,
      agreed_price,
      snapshot,
      buyer_confirmed_at,
      seller_confirmed_at
    )
    values (
      p_match_id,
      v_match.demand_id,
      v_match.product_id,
      v_match.buyer_id,
      v_match.seller_id,
      v_sell.minimum_price,
      v_canonical,
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

-- ---------------------------------------------------------------------------
-- Legacy close_match remains for non-BUY only.
-- BUY must use cancel_deal before payment, dispute/refund after payment.
-- ---------------------------------------------------------------------------
create or replace function public.close_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_demand public.demands%rowtype;
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

  select * into v_demand from public.demands where id = v_match.demand_id;
  if v_demand.type = 'BUY' then
    raise exception 'BUY trade must use cancel_deal or dispute/refund flow';
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

-- ---------------------------------------------------------------------------
-- Seller connect: one physical sell intent cannot leave stale interested buyers.
-- ---------------------------------------------------------------------------
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
  if v_demand.type <> 'BUY' then raise exception 'buy demand required'; end if;
  if v_demand.status <> 'ACTIVE' then raise exception 'demand not active'; end if;
  if v_demand.expires_at is not null and v_demand.expires_at <= now() then
    raise exception 'demand expired';
  end if;

  if v_match.sell_intent_id is null then raise exception 'sell intent required'; end if;

  select * into v_sell
  from public.sell_intents
  where id = v_match.sell_intent_id
  for update;

  if not found then raise exception 'sell intent not found'; end if;
  if v_sell.user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_sell.status <> 'OPEN' then raise exception 'sell intent not open'; end if;

  select * into v_own
  from public.ownerships
  where id = v_sell.ownership_id
  for update;

  if not found then raise exception 'ownership not found'; end if;
  if v_own.status <> 'OWNED' then raise exception 'ownership not owned'; end if;
  if v_own.user_id <> auth.uid() then raise exception 'forbidden'; end if;

  if not exists (
    select 1 from public.deal_evidence e where e.match_id = p_match_id
  ) then
    raise exception 'seller evidence required before connect';
  end if;

  if exists (
    select 1
    from public.matches m
    where m.demand_id = v_demand.id
      and m.status = 'CONNECTED'
      and m.id <> v_match.id
  ) then
    raise exception 'demand already connected';
  end if;

  -- Buyer chooses one seller for this demand.
  update public.matches
  set status = 'CLOSED', updated_at = now()
  where demand_id = v_demand.id
    and id <> v_match.id
    and status in ('BUYER_INTERESTED','SELLER_ACCEPTED');

  -- A physical sell intent is also committed to one buyer.
  update public.matches
  set status = 'CLOSED', updated_at = now()
  where sell_intent_id = v_match.sell_intent_id
    and id <> v_match.id
    and status in ('BUYER_INTERESTED','SELLER_ACCEPTED');

  update public.matches
  set status = 'CONNECTED', deal_stage = 'EVIDENCE_READY', updated_at = now()
  where id = p_match_id
  returning * into v_match;

  update public.demands
  set status = 'MATCHED', updated_at = now()
  where id = v_demand.id;

  update public.sell_intents
  set status = 'MATCHED', updated_at = now()
  where id = v_sell.id;

  perform public.insert_activity(
    v_match.buyer_id, auth.uid(), 'MATCH_CONNECTED',
    v_match.demand_id, null, v_match.id
  );
  perform public.insert_activity(
    v_match.seller_id, v_match.buyer_id, 'MATCH_CONNECTED',
    v_match.demand_id, null, v_match.id
  );

  return v_match;
end;
$$;

revoke all on function public.seller_connect_match(uuid) from public;
grant execute on function public.seller_connect_match(uuid) to authenticated;
