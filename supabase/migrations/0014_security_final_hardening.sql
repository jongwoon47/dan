-- DAN final V0 security hardening
-- 1) No direct demand DELETE (CASCADE would wipe responses/matches)
-- 2) Distance RPC: auth-only + quantized meters (anti-trilateration)
-- 3) No direct ownership UPDATE (create-only via REST)

-- ---------------------------------------------------------------------------
-- 1) demands: close via close_demand RPC only — never REST DELETE
-- ---------------------------------------------------------------------------
drop policy if exists demands_delete_own on public.demands;
drop policy if exists demands_no_direct_delete on public.demands;
create policy demands_no_direct_delete
  on public.demands for delete to authenticated
  using (false);

revoke delete on public.demands from authenticated;
grant select, insert on public.demands to authenticated;

-- ---------------------------------------------------------------------------
-- 2) approx_demand_distances: authenticated only + coarse buckets
-- ---------------------------------------------------------------------------
create or replace function public.approx_demand_distances(
  p_lat double precision,
  p_lng double precision,
  p_demand_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_bucket int := 250; -- meters; blocks exact trilateration
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_lat is null or p_lng is null then
    return '[]'::jsonb;
  end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'invalid coordinates';
  end if;
  if p_demand_ids is null or array_length(p_demand_ids, 1) is null then
    return '[]'::jsonb;
  end if;

  -- Cap probe width to limit batch oracle queries
  select coalesce(array_agg(x), '{}'::uuid[])
  into v_ids
  from (
    select distinct unnest(p_demand_ids) as x
    limit 40
  ) s;

  if array_length(v_ids, 1) is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', g.demand_id,
          'meters', greatest(
            v_bucket,
            (round(
              (
                6371000 * 2 * asin(
                  least(
                    1,
                    sqrt(
                      power(sin(radians(g.lat - p_lat) / 2), 2)
                      + cos(radians(p_lat)) * cos(radians(g.lat))
                        * power(sin(radians(g.lng - p_lng) / 2), 2)
                    )
                  )
                )
              ) / v_bucket
            ) * v_bucket)::int
          )
        )
      )
      from public.demand_exact_geo g
      join public.demands d on d.id = g.demand_id
      where g.demand_id = any (v_ids)
        and d.status = 'ACTIVE'
        and (d.expires_at is null or d.expires_at > now())
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.approx_demand_distances(double precision, double precision, uuid[]) from public;
revoke all on function public.approx_demand_distances(double precision, double precision, uuid[]) from anon;
grant execute on function public.approx_demand_distances(double precision, double precision, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) ownerships: no direct UPDATE (insert only; lifecycle via app/RPC later)
-- ---------------------------------------------------------------------------
drop policy if exists ownerships_update_own on public.ownerships;
drop policy if exists ownerships_no_direct_update on public.ownerships;
create policy ownerships_no_direct_update
  on public.ownerships for update to authenticated
  using (false)
  with check (false);

revoke update on public.ownerships from authenticated;
grant select, insert on public.ownerships to authenticated;
