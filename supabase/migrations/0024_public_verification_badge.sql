-- Public verification badges expose facts only, never legal name/account data.

create or replace function public.get_public_verification_badges(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identity boolean := false;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_user_id is null then return null; end if;

  select (v.identity_verified_at is not null)
  into v_identity
  from public.user_verifications v
  where v.user_id = p_user_id;

  return jsonb_build_object(
    'identityVerified', coalesce(v_identity, false)
  );
end;
$$;

revoke all on function public.get_public_verification_badges(uuid) from public;
grant execute on function public.get_public_verification_badges(uuid) to authenticated;
