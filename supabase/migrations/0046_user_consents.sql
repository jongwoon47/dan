-- Fresh local migration replay must not depend on a manually-created private schema.
-- The existing remote database already has dan_private; these idempotent statements
-- leave it intact. No live database mutation is performed by committing this file.
create schema if not exists dan_private;
revoke all on schema dan_private from public, anon, authenticated;

-- User terms/privacy consent records for App Store / production release gate.
-- One row per user; versions are compared client-side against CURRENT_* constants.

create table if not exists public.user_consents (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  terms_accepted_at timestamptz not null,
  privacy_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_consents_terms_version_nonempty check (length(btrim(terms_version)) > 0),
  constraint user_consents_privacy_version_nonempty check (length(btrim(privacy_version)) > 0)
);

create trigger trg_user_consents_updated
  before update on public.user_consents
  for each row execute function public.set_updated_at();

alter table public.user_consents enable row level security;

revoke all on public.user_consents from anon, authenticated;
grant select, insert, update on public.user_consents to authenticated;

drop policy if exists user_consents_select_own on public.user_consents;
create policy user_consents_select_own
  on public.user_consents for select to authenticated
  using (user_id = auth.uid());

drop policy if exists user_consents_insert_own on public.user_consents;
create policy user_consents_insert_own
  on public.user_consents for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_consents_update_own on public.user_consents;
create policy user_consents_update_own
  on public.user_consents for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Account deletion tombstones profiles (does not DELETE the row), so cascade
-- never fires. Purge consent when the profile is tombstoned.
create or replace function dan_private.purge_consents_on_profile_tombstone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    delete from public.user_consents where user_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function dan_private.purge_consents_on_profile_tombstone() from public, anon, authenticated;

drop trigger if exists trg_purge_consents_on_tombstone on public.profiles;
create trigger trg_purge_consents_on_tombstone
  after update of deleted_at on public.profiles
  for each row
  execute function dan_private.purge_consents_on_profile_tombstone();
