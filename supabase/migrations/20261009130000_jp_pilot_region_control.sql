-- JP pilot region control (browse scaffolding).
-- Writes remain gated by dan_private.enforce_demand_market_write /
-- dan.allow_jp_market_write. market_pilot_regions.enabled is NOT a write unlock.

-- ---------------------------------------------------------------------------
-- Pilot geography catalog (private). enabled = show in browse UI docs only.
-- ---------------------------------------------------------------------------
create table if not exists dan_private.market_pilot_regions (
  country_code text not null,
  region_key text not null,
  enabled boolean not null default false,
  note text,
  primary key (country_code, region_key),
  constraint market_pilot_regions_country_check check (country_code in ('KR', 'JP')),
  constraint market_pilot_regions_region_key_nonempty check (length(btrim(region_key)) > 0)
);

revoke all on table dan_private.market_pilot_regions from public, anon, authenticated;

-- Fukuoka / Hakata style keys: enabled for browse-only documentation.
-- Does not authorize JP demand inserts or trade lifecycle.
insert into dan_private.market_pilot_regions (country_code, region_key, enabled, note)
values
  (
    'JP',
    'fukuoka',
    true,
    'Browse-only pilot candidate: Fukuoka (福岡). Writes still gated.'
  ),
  (
    'JP',
    'fukuoka-hakata',
    true,
    'Browse-only pilot candidate: Fukuoka/Hakata (博多). Writes still gated.'
  )
on conflict (country_code, region_key) do nothing;

-- ---------------------------------------------------------------------------
-- Write-allow helper. Default false. Application JWT roles never set the GUC.
-- Optional future hook: enforce_demand_market_write may call this instead of
-- inlining current_setting('dan.allow_jp_market_write'). Do NOT treat
-- market_pilot_regions.enabled as authorization to write.
-- ---------------------------------------------------------------------------
create or replace function dan_private.jp_market_writes_allowed()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('dan.allow_jp_market_write', true), '') = 'on' then
    return true;
  end if;
  return false;
end;
$$;

revoke all on function dan_private.jp_market_writes_allowed()
  from public, anon, authenticated;

comment on function dan_private.jp_market_writes_allowed() is
  'JP market write gate. Reads dan.allow_jp_market_write GUC; default false. '
  'Not controlled by market_pilot_regions.enabled. '
  'Optional hook for enforce_demand_market_write — do not flip on without go/no-go.';

-- ---------------------------------------------------------------------------
-- Authenticated read of enabled pilot region labels for UI notes.
-- ---------------------------------------------------------------------------
create or replace function public.list_pilot_regions(p_country text)
returns table (
  region_key text,
  enabled boolean,
  note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_country text := upper(btrim(coalesce(p_country, '')));
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_country not in ('KR', 'JP') then
    return;
  end if;

  return query
  select r.region_key, r.enabled, r.note
  from dan_private.market_pilot_regions r
  where r.country_code = v_country
    and r.enabled = true
  order by r.region_key;
end;
$$;

revoke all on function public.list_pilot_regions(text) from public, anon;
grant execute on function public.list_pilot_regions(text) to authenticated;

comment on function public.list_pilot_regions(text) is
  'Returns enabled pilot region keys for UI browse notes. Does not unlock JP writes.';
