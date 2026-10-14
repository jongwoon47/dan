-- Harden mutable client write surfaces.
-- Normal app updates already use security-definer RPCs; remove direct writes
-- that could bypass lifecycle checks and freeze BUY terms once MATCHED.

revoke update, delete on public.demands from authenticated;
revoke update, delete on public.ownerships from authenticated;

create or replace function public.enforce_matched_buy_terms_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.type = 'BUY'
     and old.status = 'MATCHED'
     and (
       new.product_id is distinct from old.product_id
       or new.max_price is distinct from old.max_price
       or new.condition_preference is distinct from old.condition_preference
       or new.trade_method is distinct from old.trade_method
       or new.fulfillment_options is distinct from old.fulfillment_options
       or new.location is distinct from old.location
     ) then
    raise exception 'matched BUY terms are immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_matched_buy_terms_immutable on public.demands;
create trigger trg_matched_buy_terms_immutable
before update of
  product_id,
  max_price,
  condition_preference,
  trade_method,
  fulfillment_options,
  location
on public.demands
for each row execute function public.enforce_matched_buy_terms_immutable();
