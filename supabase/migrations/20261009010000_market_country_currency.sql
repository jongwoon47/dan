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

-- This supersedes the original country-unaware proximity RPC. Country is
-- explicit and independently selected; it is never derived from UI language.
create or replace function public.search_nearby_demands_market(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 3000,
  p_limit integer default 40,
  p_country_code text default 'KR'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lat double precision;
  v_lng double precision;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- 20261006054157 account deletion migration already installed this helper.
  -- SECURITY DEFINER bypasses table RLS, so protect this new RPC explicitly.
  perform dan_private.require_live_account();
  if p_lat is null or p_lng is null or
     not (p_lat between -90 and 90) or not (p_lng between -180 and 180) then
    raise exception 'invalid location';
  end if;
  if p_radius_m not in (1000, 3000, 5000, 10000) then
    raise exception 'invalid radius';
  end if;
  if p_country_code is null or p_country_code not in ('KR', 'JP') then
    raise exception 'invalid market';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 40 then
    raise exception 'invalid limit';
  end if;

  -- Both sides have the same fixed grid; callers cannot improve precision
  -- by requesting thousands of tiny coordinate offsets.
  v_lat := round((p_lat / 0.01)::numeric)::double precision * 0.01;
  v_lng := round((p_lng / 0.01)::numeric)::double precision * 0.01;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object('id', ranked.id, 'meters', ranked.meters)
      order by ranked.meters, ranked.id
    )
    from (
      select candidates.id, candidates.meters
      from (
        select
          d.id,
          greatest(
            1000,
            (
              round(
                2 * 6371000 * asin(least(1, sqrt(
                  power(sin(radians((round((g.lat / 0.01)::numeric)::double precision * 0.01 - v_lat) / 2)), 2)
                  + cos(radians(v_lat))
                    * cos(radians(round((g.lat / 0.01)::numeric)::double precision * 0.01))
                    * power(sin(radians((round((g.lng / 0.01)::numeric)::double precision * 0.01 - v_lng) / 2)), 2)
                ))) / 1000.0
              ) * 1000
            )::integer
          ) as meters
        from public.demand_exact_geo g
        join public.demands d on d.id = g.demand_id
        where
          d.status = 'ACTIVE'
          and d.country_code = p_country_code
          and (d.expires_at is null or d.expires_at > now())
          and exists (
            select 1 from public.profiles owner_profile
            where owner_profile.id = d.user_id
              and owner_profile.deleted_at is null
              and owner_profile.deletion_started_at is null
          )
          and not public.interaction_blocked_with(d.user_id)
          and (
            d.type <> 'BUY'
            or exists (
              select 1 from public.products p
              where p.id = d.product_id
                and public.marketplace_product_allowed(p.canonical_name)
            )
          )
          and exists (
            select 1 from jsonb_array_elements(coalesce(d.fulfillment_options, '[]'::jsonb)) opt
            where opt->>'mode' in ('MEETUP', 'ONSITE', 'PICKUP', 'ROUTE')
          )
      ) candidates
      where candidates.meters <= p_radius_m
      order by candidates.meters asc, candidates.id
      limit p_limit
    ) ranked
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.search_nearby_demands(double precision,double precision,integer,integer)
  from public, anon, authenticated;
revoke execute on function public.search_nearby_demands_market(double precision,double precision,integer,integer,text)
  from public, anon, authenticated;
grant execute on function public.search_nearby_demands_market(double precision,double precision,integer,integer,text)
  to authenticated;
