-- Interaction safety boundary:
-- - blocked users do not surface as open offer candidates
-- - block/unblock and reports are idempotent server RPCs
-- - authenticated clients cannot directly spam moderation tables

create or replace function public.interaction_blocked_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null or p_other is null or p_other = auth.uid() then false
    else exists (
      select 1
      from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p_other)
         or (b.blocker_id = p_other and b.blocked_id = auth.uid())
    )
  end;
$$;

revoke all on function public.interaction_blocked_with(uuid) from public;
grant execute on function public.interaction_blocked_with(uuid) to authenticated;

drop policy if exists sell_intents_select_open_or_own on public.sell_intents;
create policy sell_intents_select_open_or_own
on public.sell_intents for select
to authenticated
using (
  user_id = auth.uid()
  or (
    status = 'OPEN'
    and not public.interaction_blocked_with(user_id)
  )
);

drop policy if exists ownerships_select_own_or_open_sell on public.ownerships;
create policy ownerships_select_own_or_open_sell
on public.ownerships for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.sell_intents s
    where s.ownership_id = ownerships.id
      and s.status = 'OPEN'
      and not public.interaction_blocked_with(s.user_id)
  )
);

drop policy if exists demands_select_public_or_own on public.demands;
create policy demands_select_public_or_own
on public.demands for select
using (
  user_id = auth.uid()
  or (
    status = 'ACTIVE'
    and (expires_at is null or expires_at > now())
    and (
      auth.uid() is null
      or not public.interaction_blocked_with(user_id)
    )
  )
);

create or replace function public.block_user(p_blocked_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_blocked_id is null or p_blocked_id = auth.uid() then
    raise exception 'invalid block target';
  end if;
  if not exists (select 1 from public.profiles where id = p_blocked_id) then
    raise exception 'user not found';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (auth.uid(), p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;

create or replace function public.unblock_user(p_blocked_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.blocks
  where blocker_id = auth.uid()
    and blocked_id = p_blocked_id;
end;
$$;

revoke all on function public.block_user(uuid) from public;
revoke all on function public.unblock_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;

create unique index if not exists reports_one_open_per_target_uidx
  on public.reports (reporter_id, target_user_id)
  where status = 'OPEN';

create or replace function public.submit_user_report(
  p_target_user_id uuid,
  p_reason text,
  p_detail text default ''
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.reports%rowtype;
  v_recent_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_target_user_id is null or p_target_user_id = auth.uid() then
    raise exception 'invalid report target';
  end if;
  if p_reason not in ('spam','fraud','abuse','other') then
    raise exception 'invalid report reason';
  end if;
  if char_length(trim(coalesce(p_detail, ''))) > 2000 then
    raise exception 'report detail too long';
  end if;
  if not exists (select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'user not found';
  end if;

  select count(*)::integer into v_recent_count
  from public.reports
  where reporter_id = auth.uid()
    and created_at >= now() - interval '24 hours';

  if v_recent_count >= 20 then
    raise exception 'report rate limit exceeded';
  end if;

  select * into v_row
  from public.reports
  where reporter_id = auth.uid()
    and target_user_id = p_target_user_id
    and status = 'OPEN'
  for update;

  if found then
    update public.reports
    set
      reason = p_reason,
      detail = nullif(trim(coalesce(p_detail, '')), '')
    where id = v_row.id
    returning * into v_row;
    return v_row;
  end if;

  insert into public.reports (
    reporter_id,
    target_user_id,
    reason,
    detail,
    status
  )
  values (
    auth.uid(),
    p_target_user_id,
    p_reason,
    nullif(trim(coalesce(p_detail, '')), ''),
    'OPEN'
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_user_report(uuid,text,text) from public;
grant execute on function public.submit_user_report(uuid,text,text) to authenticated;

revoke insert, delete on public.blocks from authenticated;
revoke insert on public.reports from authenticated;
