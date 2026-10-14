-- Marketplace product policy gate.
-- The restricted-term registry is operator-managed so policy can change
-- without shipping a new client.

create table if not exists public.marketplace_restricted_terms (
  term_key text primary key,
  match_mode text not null default 'contains'
    check (match_mode in ('exact','contains')),
  reason_code text not null default 'RESTRICTED_ITEM',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_restricted_terms enable row level security;
revoke all on public.marketplace_restricted_terms from anon, authenticated;
grant select, insert, update, delete on public.marketplace_restricted_terms to service_role;

insert into public.marketplace_restricted_terms (term_key, match_mode, reason_code)
values
  (public.canonical_product_key('총기'), 'contains', 'WEAPON'),
  (public.canonical_product_key('권총'), 'contains', 'WEAPON'),
  (public.canonical_product_key('소총'), 'contains', 'WEAPON'),
  (public.canonical_product_key('실탄'), 'contains', 'AMMUNITION'),
  (public.canonical_product_key('탄약'), 'contains', 'AMMUNITION'),
  (public.canonical_product_key('필로폰'), 'contains', 'ILLEGAL_DRUG'),
  (public.canonical_product_key('코카인'), 'contains', 'ILLEGAL_DRUG'),
  (public.canonical_product_key('헤로인'), 'contains', 'ILLEGAL_DRUG'),
  (public.canonical_product_key('대마초'), 'contains', 'ILLEGAL_DRUG'),
  (public.canonical_product_key('전자담배'), 'contains', 'NICOTINE'),
  (public.canonical_product_key('니코틴액상'), 'contains', 'NICOTINE'),
  (public.canonical_product_key('위조지폐'), 'contains', 'COUNTERFEIT'),
  (public.canonical_product_key('가짜신분증'), 'contains', 'ILLEGAL_DOCUMENT')
on conflict (term_key) do nothing;

create or replace function public.marketplace_product_allowed(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text := public.canonical_product_key(p_name);
begin
  if v_key = '' then return false; end if;

  return not exists (
    select 1
    from public.marketplace_restricted_terms r
    where r.active
      and (
        (r.match_mode = 'exact' and v_key = r.term_key)
        or
        (r.match_mode = 'contains' and position(r.term_key in v_key) > 0)
      )
  );
end;
$$;

revoke all on function public.marketplace_product_allowed(text) from public;
grant execute on function public.marketplace_product_allowed(text) to authenticated, service_role;

create or replace function public.enforce_product_marketplace_policy()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.marketplace_product_allowed(new.canonical_name) then
    raise exception 'restricted marketplace product';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_product_marketplace_policy on public.products;
create trigger trg_product_marketplace_policy
before insert or update of canonical_name
on public.products
for each row execute function public.enforce_product_marketplace_policy();

create or replace function public.enforce_buy_demand_product_policy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_name text;
begin
  if new.type <> 'BUY' then return new; end if;
  if new.product_id is null then raise exception 'product required for BUY demand'; end if;

  select canonical_name into v_name
  from public.products
  where id = new.product_id;

  if v_name is null then raise exception 'product not found'; end if;
  if not public.marketplace_product_allowed(v_name) then
    raise exception 'restricted marketplace product';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_buy_demand_product_policy on public.demands;
create trigger trg_buy_demand_product_policy
before insert or update of product_id, type, status
on public.demands
for each row execute function public.enforce_buy_demand_product_policy();
