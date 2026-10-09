-- Harden consent: server clock, server-owned required versions, RPC-only writes,
-- and preserve per-document acceptance timestamps across re-consent.

create table if not exists public.consent_requirements (
  singleton boolean primary key default true check (singleton),
  terms_version text not null,
  privacy_version text not null,
  updated_at timestamptz not null default now(),
  constraint consent_requirements_terms_nonempty check (length(btrim(terms_version)) > 0),
  constraint consent_requirements_privacy_nonempty check (length(btrim(privacy_version)) > 0)
);

insert into public.consent_requirements (singleton, terms_version, privacy_version)
values (true, '2026-10-07', '2026-10-07')
on conflict (singleton) do update
set
  terms_version = excluded.terms_version,
  privacy_version = excluded.privacy_version,
  updated_at = now();

alter table public.consent_requirements enable row level security;
revoke all on public.consent_requirements from anon, authenticated;
grant select on public.consent_requirements to authenticated;

drop policy if exists consent_requirements_select on public.consent_requirements;
create policy consent_requirements_select
  on public.consent_requirements for select to authenticated
  using (true);

-- Clients may read their consent row, but may not forge versions/timestamps.
revoke insert, update, delete on public.user_consents from anon, authenticated;
grant select on public.user_consents to authenticated;

drop policy if exists user_consents_insert_own on public.user_consents;
drop policy if exists user_consents_update_own on public.user_consents;

create or replace function public.get_consent_requirements()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.consent_requirements%rowtype;
begin
  select * into v_row from public.consent_requirements where singleton = true;
  if not found then
    raise exception 'consent requirements missing';
  end if;
  return jsonb_build_object(
    'termsVersion', v_row.terms_version,
    'privacyVersion', v_row.privacy_version
  );
end;
$$;

revoke all on function public.get_consent_requirements() from public, anon;
grant execute on function public.get_consent_requirements() to authenticated;

create or replace function public.accept_my_consents()
returns public.user_consents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.consent_requirements%rowtype;
  v_existing public.user_consents%rowtype;
  v_now timestamptz := now();
  v_terms_at timestamptz;
  v_privacy_at timestamptz;
  v_row public.user_consents%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_req from public.consent_requirements where singleton = true for share;
  if not found then
    raise exception 'consent requirements missing';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_uid and deleted_at is null and deletion_started_at is null
  ) then
    raise exception 'account unavailable' using errcode = '42501';
  end if;

  select * into v_existing from public.user_consents where user_id = v_uid for update;

  if found then
    v_terms_at := case
      when v_existing.terms_version is distinct from v_req.terms_version then v_now
      else v_existing.terms_accepted_at
    end;
    v_privacy_at := case
      when v_existing.privacy_version is distinct from v_req.privacy_version then v_now
      else v_existing.privacy_accepted_at
    end;
  else
    v_terms_at := v_now;
    v_privacy_at := v_now;
  end if;

  insert into public.user_consents (
    user_id,
    terms_version,
    privacy_version,
    terms_accepted_at,
    privacy_accepted_at
  )
  values (
    v_uid,
    v_req.terms_version,
    v_req.privacy_version,
    v_terms_at,
    v_privacy_at
  )
  on conflict (user_id) do update
  set
    terms_version = excluded.terms_version,
    privacy_version = excluded.privacy_version,
    terms_accepted_at = excluded.terms_accepted_at,
    privacy_accepted_at = excluded.privacy_accepted_at
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.accept_my_consents() from public, anon;
grant execute on function public.accept_my_consents() to authenticated;
