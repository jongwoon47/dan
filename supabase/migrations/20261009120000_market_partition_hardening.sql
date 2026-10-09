-- P0 market partition hardening (forward-only).
-- Pilot rule: application roles may only create/trade KR/KRW demands.
-- JP/JPY pair remains valid at the CHECK level for a future approved launch,
-- but writes and trade lifecycle entry are rejected until that gate opens.
-- Do not edit prior applied migrations; repair here.

-- ---------------------------------------------------------------------------
-- Rate-limit bucket for proximity RPC (per authenticated user).
-- ---------------------------------------------------------------------------
create table if not exists dan_private.nearby_search_rate (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_started_at timestamptz not null default now(),
  call_count integer not null default 0 check (call_count >= 0)
);

revoke all on table dan_private.nearby_search_rate from public, anon, authenticated;

create or replace function dan_private.consume_nearby_search_quota(
  p_max_calls integer default 30,
  p_window_seconds integer default 60
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row dan_private.nearby_search_rate%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_max_calls is null or p_max_calls < 1 then
    raise exception 'invalid rate limit';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'invalid rate window';
  end if;

  select * into v_row
  from dan_private.nearby_search_rate
  where user_id = v_uid
  for update;

  if not found then
    insert into dan_private.nearby_search_rate (user_id, window_started_at, call_count)
    values (v_uid, now(), 1);
    return;
  end if;

  if v_row.window_started_at <= now() - make_interval(secs => p_window_seconds) then
    update dan_private.nearby_search_rate
    set window_started_at = now(), call_count = 1
    where user_id = v_uid;
    return;
  end if;

  if v_row.call_count >= p_max_calls then
    raise exception 'nearby search rate limit exceeded' using errcode = '54000';
  end if;

  update dan_private.nearby_search_rate
  set call_count = call_count + 1
  where user_id = v_uid;
end;
$$;

revoke all on function dan_private.consume_nearby_search_quota(integer, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Demand write gate: no JP/JPY inserts or flips via REST during pilot.
-- ---------------------------------------------------------------------------
create or replace function dan_private.enforce_demand_market_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Controlled bypass for reviewed seeds/tests only:
  --   select set_config('dan.allow_jp_market_write', 'on', true);
  -- Application JWT roles never set this GUC.
  if coalesce(current_setting('dan.allow_jp_market_write', true), '') = 'on' then
    if not dan_private.demand_market_is_supported(NEW.country_code, NEW.currency_code) then
      raise exception 'invalid market pair' using errcode = '23514';
    end if;
    return NEW;
  end if;

  if NEW.country_code is distinct from 'KR' or NEW.currency_code is distinct from 'KRW' then
    raise exception 'japan market writes are not enabled'
      using errcode = '42501';
  end if;
  NEW.country_code := 'KR';
  NEW.currency_code := 'KRW';
  return NEW;
end;
$$;

drop trigger if exists trg_demands_market_write on public.demands;
create trigger trg_demands_market_write
  before insert or update of country_code, currency_code on public.demands
  for each row execute function dan_private.enforce_demand_market_write();

-- ---------------------------------------------------------------------------
-- Trade lifecycle may only attach to KR/KRW demands during pilot.
-- ---------------------------------------------------------------------------
create or replace function dan_private.assert_tradable_demand(p_demand_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_country text;
  v_currency text;
begin
  select d.country_code, d.currency_code
    into v_country, v_currency
  from public.demands d
  where d.id = p_demand_id;
  if not found then
    raise exception 'demand not found';
  end if;
  if v_country is distinct from 'KR' or v_currency is distinct from 'KRW' then
    raise exception 'market not tradable' using errcode = '42501';
  end if;
end;
$$;

revoke all on function dan_private.assert_tradable_demand(uuid)
  from public, anon, authenticated;

create or replace function dan_private.enforce_response_market()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform dan_private.assert_tradable_demand(NEW.demand_id);
  return NEW;
end;
$$;

drop trigger if exists trg_responses_market on public.responses;
create trigger trg_responses_market
  before insert or update of demand_id on public.responses
  for each row execute function dan_private.enforce_response_market();

create or replace function dan_private.enforce_match_market()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform dan_private.assert_tradable_demand(NEW.demand_id);
  return NEW;
end;
$$;

drop trigger if exists trg_matches_market on public.matches;
create trigger trg_matches_market
  before insert or update of demand_id on public.matches
  for each row execute function dan_private.enforce_match_market();

-- ---------------------------------------------------------------------------
-- BUY aggregation: never mix currencies / countries.
-- ---------------------------------------------------------------------------
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
 and d.country_code = 'KR'
 and d.currency_code = 'KRW'
 and public.is_phone_verified_for_live_demand(d.user_id)
where public.marketplace_product_allowed(p.canonical_name)
group by p.id;

-- ---------------------------------------------------------------------------
-- Live demand search: explicit country (defaults KR; fail closed on unknown).
-- ---------------------------------------------------------------------------
drop function if exists public.search_live_demand(text, text, text, integer, integer);

create or replace function public.search_live_demand(
  p_query text default '',
  p_category text default null,
  p_sort text default 'popular',
  p_limit integer default 24,
  p_offset integer default 0,
  p_country_code text default 'KR'
)
returns table (
  product_id uuid,
  canonical_name text,
  brand text,
  model text,
  category text,
  image_hue integer,
  product_created_at timestamptz,
  seeker_count integer,
  min_price numeric,
  max_price numeric,
  avg_price numeric,
  highest_intent_price numeric,
  recent_7d_delta integer,
  fulfillment_summary text,
  latest_demand_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      p.id as product_id,
      p.canonical_name,
      coalesce(p.brand, '') as brand,
      coalesce(p.model, '') as model,
      p.category,
      p.image_hue,
      p.created_at as product_created_at,
      count(distinct d.user_id)::integer as seeker_count,
      min(d.max_price)::numeric as min_price,
      max(d.max_price)::numeric as max_price,
      round(avg(d.max_price))::numeric as avg_price,
      max(d.max_price)::numeric as highest_intent_price,
      count(*) filter (
        where d.created_at >= now() - interval '7 days'
      )::integer as recent_7d_delta,
      case
        when bool_or(d.trade_method = 'any')
          or (bool_or(d.trade_method = 'meetup') and bool_or(d.trade_method = 'shipping'))
          then '직거래 · 택배'
        when bool_or(d.trade_method = 'shipping') then '택배'
        when bool_or(d.trade_method = 'meetup') then '직거래'
        else '거래방식 확인'
      end as fulfillment_summary,
      max(d.created_at) as latest_demand_at
    from public.products p
    join public.demands d
      on d.product_id = p.id
     and d.type = 'BUY'
     and d.status = 'ACTIVE'
     and (d.expires_at is null or d.expires_at > now())
     and d.country_code = case
       when coalesce(nullif(trim(p_country_code), ''), 'KR') = 'KR' then 'KR'
       else '__none__'
     end
     and d.currency_code = 'KRW'
    where
      (
        nullif(trim(coalesce(p_category, '')), '') is null
        or p_category = 'all'
        or p.category = p_category
      )
      and (
        nullif(trim(coalesce(p_query, '')), '') is null
        or p.canonical_name ilike '%' || trim(p_query) || '%'
        or coalesce(p.brand, '') ilike '%' || trim(p_query) || '%'
        or coalesce(p.model, '') ilike '%' || trim(p_query) || '%'
        or p.category ilike '%' || trim(p_query) || '%'
        or (
          case p.category
            when 'electronics' then '전자기기'
            when 'computer' then '컴퓨터 노트북'
            when 'gaming' then '게임'
            when 'audio' then '오디오'
            when 'camera' then '카메라'
            when 'lens' then '렌즈'
            when 'home_appliance' then '생활가전'
            when 'furniture' then '가구'
            when 'fashion' then '패션'
            when 'shoes' then '신발'
            when 'watches_accessories' then '시계 액세서리'
            when 'sports' then '스포츠'
            when 'outdoor' then '아웃도어'
            when 'camping' then '캠핑'
            when 'hobby_collectible' then '취미 수집'
            when 'baby_kids' then '유아 아동'
            when 'books_media' then '도서 미디어'
            when 'musical_instrument' then '악기'
            when 'beauty' then '뷰티'
            when 'pet' then '반려동물'
            when 'tools' then '공구'
            when 'auto' then '자동차용품'
            else '기타'
          end
        ) ilike '%' || trim(p_query) || '%'
        or public.canonical_product_key(p.canonical_name)
          like '%' || public.canonical_product_key(trim(p_query)) || '%'
      )
    group by
      p.id,
      p.canonical_name,
      p.brand,
      p.model,
      p.category,
      p.image_hue,
      p.created_at
  ),
  ranked as (
    select
      filtered.*,
      count(*) over() as total_count
    from filtered
  )
  select *
  from ranked
  order by
    case when p_sort = 'growing' then recent_7d_delta end desc nulls last,
    case when p_sort = 'price' then highest_intent_price end desc nulls last,
    case when p_sort not in ('growing','price') then seeker_count end desc nulls last,
    seeker_count desc,
    recent_7d_delta desc,
    highest_intent_price desc,
    latest_demand_at desc,
    product_id
  limit least(greatest(coalesce(p_limit, 24), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.search_live_demand(text, text, text, integer, integer, text)
  from public;
grant execute on function public.search_live_demand(text, text, text, integer, integer, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Deal snapshots: persist the currency that was agreed (legacy = KRW).
-- ---------------------------------------------------------------------------
alter table public.deal_snapshots
  add column if not exists currency_code text not null default 'KRW';

alter table public.deal_snapshots
  drop constraint if exists deal_snapshots_currency_code_check;
alter table public.deal_snapshots
  add constraint deal_snapshots_currency_code_check
  check (currency_code in ('KRW', 'JPY'));

-- Locked snapshots are immutable; legacy locked rows keep the KRW default.
update public.deal_snapshots s
set currency_code = coalesce(d.currency_code, 'KRW')
from public.demands d
where d.id = s.demand_id
  and s.locked_at is null
  and s.currency_code is distinct from coalesce(d.currency_code, 'KRW');

-- ---------------------------------------------------------------------------
-- Nearby RPC: rate limit, bbox prefilter, offset pagination, JP browse OK.
-- ---------------------------------------------------------------------------
create index if not exists idx_dan_demand_exact_geo_lat_lng
  on public.demand_exact_geo (lat, lng);

drop function if exists public.search_nearby_demands_market(
  double precision, double precision, integer, integer, text
);

create or replace function public.search_nearby_demands_market(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 3000,
  p_limit integer default 40,
  p_country_code text default 'KR',
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lat double precision;
  v_lng double precision;
  v_deg double precision;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform dan_private.require_live_account();
  perform dan_private.consume_nearby_search_quota(30, 60);

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
  if p_offset is null or p_offset < 0 or p_offset > 400 then
    raise exception 'invalid offset';
  end if;

  v_lat := round((p_lat / 0.01)::numeric)::double precision * 0.01;
  v_lng := round((p_lng / 0.01)::numeric)::double precision * 0.01;
  -- Rough degree pad (~111km/deg lat) plus one grid cell of slack.
  v_deg := (p_radius_m::double precision / 111000.0) + 0.02;

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
          and g.lat between (v_lat - v_deg) and (v_lat + v_deg)
          and g.lng between (v_lng - v_deg) and (v_lng + v_deg)
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
      offset p_offset
    ) ranked
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.search_nearby_demands_market(
  double precision, double precision, integer, integer, text, integer
) from public, anon, authenticated;
grant execute on function public.search_nearby_demands_market(
  double precision, double precision, integer, integer, text, integer
) to authenticated;

-- Keep the retired country-blind RPC unusable.
revoke execute on function public.search_nearby_demands(
  double precision, double precision, integer, integer
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retired exact-ID distance oracle: hard-fail even if privileges are restored.
-- ---------------------------------------------------------------------------
create or replace function public.approx_demand_distances(
  p_lat double precision,
  p_lng double precision,
  p_demand_ids uuid[]
)
returns table (id uuid, meters integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'retired: use search_nearby_demands_market'
    using errcode = '0A000';
end;
$$;

revoke all on function public.approx_demand_distances(double precision, double precision, uuid[])
  from public, anon, authenticated;
