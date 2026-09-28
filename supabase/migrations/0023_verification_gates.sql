-- DAN V1 verification gates.
-- Provider-neutral: only trusted server/service_role can mark verification complete.
-- No client can self-assert phone, identity, or payout verification.

create table if not exists public.user_verifications (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone_verified_at timestamptz,
  identity_verified_at timestamptz,
  payout_verified_at timestamptz,
  legal_name text,
  payout_account_ref text,
  seller_type text check (seller_type is null or seller_type in ('INDIVIDUAL','BUSINESS')),
  updated_at timestamptz not null default now()
);

alter table public.user_verifications enable row level security;

drop policy if exists user_verifications_read_own on public.user_verifications;
create policy user_verifications_read_own
on public.user_verifications for select
to authenticated
using (user_id = auth.uid());

revoke insert, update, delete on public.user_verifications from anon, authenticated;
grant select on public.user_verifications to authenticated;

create or replace function public.get_my_verification()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_verifications%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_row
  from public.user_verifications
  where user_id = auth.uid();

  return jsonb_build_object(
    'phoneVerified', found and v_row.phone_verified_at is not null,
    'identityVerified', found and v_row.identity_verified_at is not null,
    'payoutVerified', found and v_row.payout_verified_at is not null,
    'sellerType', case when found then v_row.seller_type else null end
  );
end;
$$;

revoke all on function public.get_my_verification() from public;
grant execute on function public.get_my_verification() to authenticated;

-- Provider webhook / trusted backend entrypoint.
create or replace function public.ops_set_user_verification(
  p_user_id uuid,
  p_phone_verified boolean default null,
  p_identity_verified boolean default null,
  p_payout_verified boolean default null,
  p_legal_name text default null,
  p_payout_account_ref text default null,
  p_seller_type text default null
)
returns public.user_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_verifications%rowtype;
begin
  if p_seller_type is not null and p_seller_type not in ('INDIVIDUAL','BUSINESS') then
    raise exception 'invalid seller type';
  end if;

  insert into public.user_verifications (
    user_id,
    phone_verified_at,
    identity_verified_at,
    payout_verified_at,
    legal_name,
    payout_account_ref,
    seller_type
  )
  values (
    p_user_id,
    case when p_phone_verified is true then now() else null end,
    case when p_identity_verified is true then now() else null end,
    case when p_payout_verified is true then now() else null end,
    nullif(trim(coalesce(p_legal_name, '')), ''),
    nullif(trim(coalesce(p_payout_account_ref, '')), ''),
    p_seller_type
  )
  on conflict (user_id) do update
  set
    phone_verified_at = case
      when p_phone_verified is null then user_verifications.phone_verified_at
      when p_phone_verified then coalesce(user_verifications.phone_verified_at, now())
      else null
    end,
    identity_verified_at = case
      when p_identity_verified is null then user_verifications.identity_verified_at
      when p_identity_verified then coalesce(user_verifications.identity_verified_at, now())
      else null
    end,
    payout_verified_at = case
      when p_payout_verified is null then user_verifications.payout_verified_at
      when p_payout_verified then coalesce(user_verifications.payout_verified_at, now())
      else null
    end,
    legal_name = coalesce(nullif(trim(coalesce(p_legal_name, '')), ''), user_verifications.legal_name),
    payout_account_ref = coalesce(
      nullif(trim(coalesce(p_payout_account_ref, '')), ''),
      user_verifications.payout_account_ref
    ),
    seller_type = coalesce(p_seller_type, user_verifications.seller_type),
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.ops_set_user_verification(uuid, boolean, boolean, boolean, text, text, text) from public;
grant execute on function public.ops_set_user_verification(uuid, boolean, boolean, boolean, text, text, text) to service_role;

-- A Live BUY demand must come from a phone-verified user.
create or replace function public.enforce_live_buy_phone_verification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if new.type = 'BUY' and new.status = 'ACTIVE' then
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

drop trigger if exists trg_live_buy_phone_verification on public.demands;
create trigger trg_live_buy_phone_verification
before insert or update on public.demands
for each row execute function public.enforce_live_buy_phone_verification();

-- A seller may make a low-friction Quick Offer while unverified, but cannot
-- enter a real CONNECTED BUY deal until phone + identity + payout are verified.
create or replace function public.enforce_connected_buy_seller_verification()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_type text;
begin
  if auth.uid() is null then return new; end if;
  if new.status <> 'CONNECTED' or old.status = 'CONNECTED' then
    return new;
  end if;

  select d.type into v_type from public.demands d where d.id = new.demand_id;
  if v_type = 'BUY' then
    if not exists (
      select 1
      from public.user_verifications v
      where v.user_id = new.seller_id
        and v.phone_verified_at is not null
        and v.identity_verified_at is not null
        and v.payout_verified_at is not null
        and v.seller_type is not null
    ) then
      raise exception 'seller verification required before deal';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_connected_buy_seller_verification on public.matches;
create trigger trg_connected_buy_seller_verification
before update of status on public.matches
for each row execute function public.enforce_connected_buy_seller_verification();

-- Public Live Demand numbers only include phone-verified buyers.
create or replace view public.buy_demand_aggregates
with (security_invoker = true)
as
select
  p.id as product_id,
  count(distinct d.user_id)::integer as seeker_count,
  min(d.max_price)::numeric as min_price,
  max(d.max_price)::numeric as max_price,
  round(avg(d.max_price))::numeric as avg_price,
  max(d.max_price)::numeric as highest_intent_price,
  count(*) filter (
    where d.updated_at >= now() - interval '7 days'
  )::integer as recent_7d_delta
from public.products p
join public.demands d
  on d.product_id = p.id
 and d.type = 'BUY'
 and d.status = 'ACTIVE'
 and d.expires_at > now()
join public.user_verifications v
  on v.user_id = d.user_id
 and v.phone_verified_at is not null
group by p.id;
