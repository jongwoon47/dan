-- GPS privacy: exact coordinates never live in public demands.fulfillment_options.
-- Distance is returned as meters only via SECURITY DEFINER RPC.

create table if not exists public.demand_exact_geo (
  demand_id uuid primary key references public.demands (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now(),
  constraint demand_exact_geo_lat_chk check (lat >= -90 and lat <= 90),
  constraint demand_exact_geo_lng_chk check (lng >= -180 and lng <= 180)
);

alter table public.demand_exact_geo enable row level security;

drop policy if exists demand_exact_geo_owner_all on public.demand_exact_geo;
create policy demand_exact_geo_owner_all
  on public.demand_exact_geo
  for all
  to authenticated
  using (
    exists (
      select 1 from public.demands d
      where d.id = demand_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.demands d
      where d.id = demand_id and d.user_id = auth.uid()
    )
  );

revoke all on table public.demand_exact_geo from public;
grant select, insert, update, delete on table public.demand_exact_geo to authenticated;

-- Scrub any geo already stored in public JSONB.
update public.demands
set fulfillment_options = (
  select coalesce(
    jsonb_agg(
      case
        when elem ? 'place' then elem #- '{place,geo}'
        when elem ? 'from' or elem ? 'to' then
          (elem #- '{from,geo}') #- '{to,geo}'
        else elem
      end
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(coalesce(fulfillment_options, '[]'::jsonb)) elem
)
where fulfillment_options::text like '%"geo"%';

create or replace function public.upsert_demand_exact_geo(
  p_demand_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.demands d
    where d.id = p_demand_id and d.user_id = auth.uid()
  ) then
    raise exception 'forbidden';
  end if;
  if p_lat is null or p_lng is null then
    delete from public.demand_exact_geo where demand_id = p_demand_id;
    return;
  end if;
  insert into public.demand_exact_geo (demand_id, lat, lng, updated_at)
  values (p_demand_id, p_lat, p_lng, now())
  on conflict (demand_id) do update
    set lat = excluded.lat,
        lng = excluded.lng,
        updated_at = now();
end;
$$;

revoke all on function public.upsert_demand_exact_geo(uuid, double precision, double precision) from public;
grant execute on function public.upsert_demand_exact_geo(uuid, double precision, double precision) to authenticated;

-- Returns [{id, meters}] — never lat/lng. Only ACTIVE non-expired demands.
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
begin
  if p_lat is null or p_lng is null then
    return '[]'::jsonb;
  end if;
  if p_demand_ids is null or array_length(p_demand_ids, 1) is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', g.demand_id,
          'meters', round(
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
          )::int
        )
      )
      from public.demand_exact_geo g
      join public.demands d on d.id = g.demand_id
      where g.demand_id = any (p_demand_ids)
        and d.status = 'ACTIVE'
        and (d.expires_at is null or d.expires_at > now())
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.approx_demand_distances(double precision, double precision, uuid[]) from public;
grant execute on function public.approx_demand_distances(double precision, double precision, uuid[]) to authenticated, anon;
