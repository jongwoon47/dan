-- Public trust-card stats for profiles.
-- Peers cannot read MATCHED/CLOSED demands or other users' matches via RLS,
-- so expose only aggregate counts + redacted recent activity via SECURITY DEFINER.

create or replace function public.get_public_profile_trust(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_is_self boolean := v_viewer is not null and v_viewer = p_user_id;
  v_completed int;
  v_response int;
  v_connection int;
  v_recent jsonb;
begin
  if p_user_id is null then
    return null;
  end if;

  -- Profile must exist
  if not exists (select 1 from public.profiles where id = p_user_id) then
    return null;
  end if;

  select count(*)::int into v_completed
  from public.demands
  where user_id = p_user_id
    and status in ('MATCHED', 'CLOSED');

  select count(*)::int into v_response
  from public.matches
  where status = 'CONNECTED'
    and seller_id = p_user_id;

  select count(*)::int into v_connection
  from public.matches
  where status = 'CONNECTED'
    and (buyer_id = p_user_id or seller_id = p_user_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'type', x.type,
        'status', x.status,
        'title', x.title
      )
      order by x.created_at desc
    ),
    '[]'::jsonb
  )
  into v_recent
  from (
    select
      d.id,
      d.type,
      d.status,
      case when v_is_self then d.title else null end as title,
      d.created_at
    from public.demands d
    where d.user_id = p_user_id
      and d.status in ('MATCHED', 'CLOSED')
    order by d.created_at desc
    limit 3
  ) x;

  return jsonb_build_object(
    'completedDemandCount', v_completed,
    'responseConnectionCount', v_response,
    'connectionCount', v_connection,
    'recentActivity', v_recent,
    'viewerIsSelf', v_is_self
  );
end;
$$;

revoke all on function public.get_public_profile_trust(uuid) from public;
grant execute on function public.get_public_profile_trust(uuid) to authenticated;
