-- Allow trusted lifecycle RPCs to transition a seller's offer on behalf of
-- the transaction actor while preserving ownership/product integrity.
--
-- Direct authenticated INSERT/UPDATE on sell_intents is revoked by
-- 0030_secure_quick_offer.sql, so caller identity belongs at the RPC boundary,
-- not in this row-integrity trigger.

create or replace function public.enforce_sell_intent_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_own public.ownerships%rowtype;
begin
  select * into v_own
  from public.ownerships
  where id = new.ownership_id;

  if not found then
    raise exception 'ownership not found';
  end if;
  if v_own.user_id <> new.user_id then
    raise exception 'sell_intent user must own ownership';
  end if;
  if v_own.product_id <> new.product_id then
    raise exception 'sell_intent product must match ownership product';
  end if;

  return new;
end;
$$;
