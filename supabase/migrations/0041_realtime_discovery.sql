-- DAN V1 production UX hardening:
-- 1) realtime chat delivery/read-receipt updates
-- 2) server-side open-catalog Live Demand search/sort/pagination

-- ---------------------------------------------------------------------------
-- Realtime messages
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end
$$;

-- Keep UPDATE payloads useful for read receipts.
alter table public.messages replica identity full;

-- ---------------------------------------------------------------------------
-- Server-side Live Demand discovery
-- RLS remains authoritative because this is SECURITY INVOKER.
-- ---------------------------------------------------------------------------
create or replace function public.search_live_demand(
  p_query text default '',
  p_category text default null,
  p_sort text default 'popular',
  p_limit integer default 24,
  p_offset integer default 0
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

revoke all on function public.search_live_demand(text,text,text,integer,integer) from public;
grant execute on function public.search_live_demand(text,text,text,integer,integer)
  to anon, authenticated;
