-- Open DAN V1 BUY demand to the full product catalog.
-- Keeps verification, 7-day freshness, immutable evidence and canonical snapshot rules.

-- ---------------------------------------------------------------------------
-- Live Demand is no longer restricted to five camera SKUs.
-- Any valid catalog product may have a verified BUY demand.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_live_buy_phone_verification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;

  if new.type = 'BUY' and new.status = 'ACTIVE' then
    if new.product_id is null then
      raise exception 'product required for live buying demand';
    end if;

    if new.expires_at is null or new.expires_at > now() + interval '7 days' then
      new.expires_at := now() + interval '7 days';
    end if;

    if not exists (
      select 1
      from public.user_verifications v
      where v.user_id = new.user_id
        and v.phone_verified_at is not null
    ) then
      raise exception 'phone verification required for live buying demand';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Product-agnostic evidence.
-- A current possession photo + condition disclosure remain required.
-- Serial / identification fragment is optional because many legitimate
-- secondhand products do not have a useful serial number.
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

  if v_serial is not null and char_length(v_serial) < 2 then
    raise exception 'serial fragment too short';
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
