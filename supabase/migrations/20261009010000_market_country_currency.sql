-- Region/currency partition foundation for Japan pilot.
-- All pre-existing demand amounts are legally and technically KRW and
-- all existing demand rows are in the Korea storefront. Never infer Japan
-- just because the UI language is Japanese.
alter table public.demands
  add column if not exists country_code text not null default 'KR',
  add column if not exists currency_code text not null default 'KRW';

alter table public.demands
  add constraint dan_demand_market_currency_pair
  check (
    (country_code = 'KR' and currency_code = 'KRW') or
    (country_code = 'JP' and currency_code = 'JPY')
  );

create index if not exists idx_dan_demands_country_active
  on public.demands (country_code, created_at desc)
  where status = 'ACTIVE';

comment on column public.demands.country_code is
  'Storefront market code; defaults to KR. This is NOT inferred from UI language or location free text.';
comment on column public.demands.currency_code is
  'Actual currency of budget/max_price. KRW historical values must never be silently displayed as JPY.';

-- As long as JP native creation/payment flows are not approved,
-- production proximity RPC must only operate on KR store requests.
-- JP search can launch only with an explicit versioned, country-scoped RPC.
create or replace function dan_private.demand_market_is_supported(
  p_country_code text, p_currency_code text
)
returns boolean language sql immutable
set search_path = ''
as $$
  select (p_country_code = 'KR' and p_currency_code = 'KRW') or
         (p_country_code = 'JP' and p_currency_code = 'JPY')
$$;
revoke all on function dan_private.demand_market_is_supported(text,text)
  from public, anon, authenticated;
