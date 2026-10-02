-- Deal Snapshot handoff terms.
-- Product, price and Evidence remain database-canonical; only agreed method/place/time are participant-proposed
-- and still require both parties to confirm the same canonical snapshot before it locks.

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
  v_agreed_method text;
  v_agreed_place text;
  v_agreed_at timestamptz;
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

  v_agreed_method := lower(trim(coalesce(p_snapshot #>> '{handoff,agreedMethod}', '')));
  if v_agreed_method not in ('meetup','shipping') then
    raise exception 'valid agreed handoff method required';
  end if;
  if coalesce(v_demand.trade_method, 'any') <> 'any'
     and v_agreed_method <> v_demand.trade_method then
    raise exception 'agreed handoff method not allowed by demand';
  end if;

  v_agreed_place := nullif(trim(coalesce(p_snapshot #>> '{handoff,agreedPlace}', '')), '');
  if v_agreed_place is not null and char_length(v_agreed_place) > 200 then
    raise exception 'agreed handoff place too long';
  end if;

  if nullif(trim(coalesce(p_snapshot #>> '{handoff,agreedAt}', '')), '') is not null then
    begin
      v_agreed_at := (p_snapshot #>> '{handoff,agreedAt}')::timestamptz;
    exception when others then
      raise exception 'invalid agreed handoff time';
    end;
  end if;

  if v_agreed_method = 'meetup' then
    if v_agreed_place is null then raise exception 'meetup place required'; end if;
    if v_agreed_at is null then raise exception 'meetup time required'; end if;
  end if;

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
      'agreedMethod', v_agreed_method,
      'agreedPlace', v_agreed_place,
      'agreedAt', case when v_agreed_at is null then null else to_char(v_agreed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end,
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
