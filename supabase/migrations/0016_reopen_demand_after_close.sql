-- After unilateral trade cancel (match CLOSED), demand stays MATCHED.
-- Owner may explicitly reopen (MATCHED → ACTIVE). No auto-reopen.

-- ---------------------------------------------------------------------------
-- reopen_demand_after_trade_close — demand owner only, after CLOSED match
-- ---------------------------------------------------------------------------
create or replace function public.reopen_demand_after_trade_close(p_match_id uuid)
returns public.demands
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_demand public.demands%rowtype;
  v_connected int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  if v_match.status <> 'CLOSED' then
    raise exception 'match not closed';
  end if;

  select * into v_demand from public.demands where id = v_match.demand_id for update;
  if not found then raise exception 'demand not found'; end if;
  if v_demand.user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_demand.status <> 'MATCHED' then
    raise exception 'demand not matched';
  end if;

  -- Do not reopen while another live connection exists on this demand
  select count(*) into v_connected
  from public.matches
  where demand_id = v_demand.id
    and status = 'CONNECTED'
    and id <> p_match_id;
  if v_connected > 0 then
    raise exception 'demand has active connection';
  end if;

  update public.demands
  set
    status = 'ACTIVE',
    -- BUY: give another 30d window if already expired / about to expire
    expires_at = case
      when v_demand.type = 'BUY'
        and v_demand.expires_at <= now() + interval '1 day'
      then now() + interval '30 days'
      else v_demand.expires_at
    end,
    updated_at = now()
  where id = v_demand.id
  returning * into v_demand;

  return v_demand;
end;
$$;

revoke all on function public.reopen_demand_after_trade_close(uuid) from public;
grant execute on function public.reopen_demand_after_trade_close(uuid) to authenticated;
