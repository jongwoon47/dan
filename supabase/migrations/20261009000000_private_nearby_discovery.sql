-- Privacy-preserving, server-selected proximity discovery.
-- No demand ID enumeration input; authenticated user only; no raw lat/lng output.
-- Coarsen BOTH viewer and demand positions on a 0.01 degree grid before
-- distance calculations (about 1 km in latitude) to defeat exact-coordinate
-- trilateration. Report distances in minimum 1 km buckets only.
--
-- This is an additive forward migration, safe for a separately gated rollout.
create or replace function public.search_nearby_demands(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 3000,
  p_limit integer default 40
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
  if p_lat is null or p_lng is null or
     not (p_lat between -90 and 90) or not (p_lng between -180 and 180) then
    raise exception 'invalid location';
  end if;
  if p_radius_m not in (1000, 3000, 5000, 10000) then
    raise exception 'invalid radius';
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
          and (d.expires_at is null or d.expires_at > now())
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

-- An explicitly limited Data API endpoint: the caller receives demand IDs
-- and grid-quantized distances, never any stored position.
revoke all on function public.search_nearby_demands(double precision,double precision,integer,integer) from public, anon, authenticated;
grant execute on function public.search_nearby_demands(double precision,double precision,integer,integer) to authenticated;

-- Retire the legacy arbitrary-ID/250m distance oracle. The current released
-- consumer UI does not invoke this RPC; it was reserved for the older draft.
-- This prevents probing an arbitrary target by repeating origin coordinates.
revoke execute on function public.approx_demand_distances(double precision,double precision,uuid[])
  from public, anon, authenticated;
