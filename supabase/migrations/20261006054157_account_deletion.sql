-- Account deletion: preserve closed-party history without an Auth identity.
-- No new cascade is introduced. Existing business transitions remain unchanged.
create schema if not exists dan_private;
revoke all on schema dan_private from public;
grant usage on schema dan_private to authenticated, service_role;

alter table public.profiles add column auth_user_id uuid unique references auth.users(id) on delete set null;
alter table public.profiles add column deletion_started_at timestamptz;
alter table public.profiles add column deleted_at timestamptz;
update public.profiles set auth_user_id=id;
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles add constraint profiles_auth_identity check
  ((deleted_at is null and auth_user_id is not null and auth_user_id=id) or (deleted_at is not null and auth_user_id is null));

create function dan_private.live_account() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p join auth.users u on u.id=p.auth_user_id
    where p.id=auth.uid() and p.deleted_at is null and p.deletion_started_at is null)
$$;
revoke all on function dan_private.live_account() from public,anon;
grant execute on function dan_private.live_account() to authenticated;

create function dan_private.require_live_account() returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles where id=auth.uid() for update;
  if not dan_private.live_account() then raise exception 'account unavailable' using errcode='42501'; end if;
end $$;
revoke all on function dan_private.require_live_account() from public,anon,authenticated;

-- Existing authenticated privileged RPCs bypass RLS, so gate them as well.
-- Fail closed if a future RPC cannot be instrumented; do not change its business body.
do $$ declare r record; v_definition text; begin
  for r in select p.oid,l.lanname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    join pg_language l on l.oid=p.prolang where n.nspname='public' and p.prosecdef
    and l.lanname='plpgsql' and has_function_privilege('authenticated',p.oid,'execute')
    and not has_function_privilege('anon',p.oid,'execute')
  loop
    v_definition := pg_get_functiondef(r.oid);
    if v_definition !~* '\mbegin\M' then raise exception 'missing RPC body'; end if;
    execute regexp_replace(v_definition,'\mbegin\M', 'begin PERFORM dan_private.require_live_account();','i');
  end loop;
end $$;

-- Restrictive policies AND with existing policies. Anonymous discovery is unchanged.
do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname='public' loop
    execute format('create policy account_must_be_live on public.%I as restrictive for all to authenticated using ((select dan_private.live_account())) with check ((select dan_private.live_account()))',r.tablename);
  end loop;
end $$;
create policy account_must_be_live on storage.objects as restrictive for all to authenticated
using ((select dan_private.live_account())) with check ((select dan_private.live_account()));

create function dan_private.lock_storage_account() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null then perform dan_private.require_live_account(); end if;
 return new;
end $$;
revoke all on function dan_private.lock_storage_account() from public,anon,authenticated;
create trigger account_storage_lock before insert or update on storage.objects
for each row execute function dan_private.lock_storage_account();

-- Protect new identity/deletion columns, including direct profile writes.
revoke insert,update,delete on public.profiles from authenticated;
grant update(display_name,location,default_area_label,bio) on public.profiles to authenticated;
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,auth_user_id,display_name) values(new.id,new.id,
   coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),nullif(split_part(new.email,'@',1),''),'DAN user'));
 return new;
end $$;

create function dan_private.deletion_blockers(p_id uuid) returns integer
language sql stable security definer set search_path='' as $$
 select count(*)::integer from public.matches m where p_id in(m.buyer_id,m.seller_id) and (
   m.status in('BUYER_INTERESTED','SELLER_ACCEPTED','CONNECTED')
   or (m.payment_status='PAID' and m.status<>'COMPLETED')
   or exists(select 1 from public.deal_disputes d where d.match_id=m.id and d.status in('OPEN','REVIEWING')))
$$;
revoke all on function dan_private.deletion_blockers(uuid) from public,anon,authenticated;

create function public.account_deletion_status() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid()) then
   raise exception 'not authenticated' using errcode='42501'; end if;
 return jsonb_build_object('activeTransactions',dan_private.deletion_blockers(auth.uid()),
   'pending',exists(select 1 from public.profiles where id=auth.uid() and deletion_started_at is not null));
end $$;
revoke all on function public.account_deletion_status() from public,anon;
grant execute on function public.account_deletion_status() to authenticated;

create function public.begin_account_deletion(p_confirm boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_confirm is distinct from true or auth.uid() is null then raise exception 'explicit confirmation required'; end if;
 perform 1 from public.profiles where id=auth.uid() and deleted_at is null for update;
 if not found or not exists(select 1 from auth.users where id=auth.uid()) then raise exception 'not authenticated' using errcode='42501'; end if;
 perform 1 from public.matches where auth.uid() in(buyer_id,seller_id) for update;
 if dan_private.deletion_blockers(auth.uid())>0 then raise exception 'ACTIVE_TRANSACTIONS'; end if;
 update public.profiles set deletion_started_at=coalesce(deletion_started_at,now()) where id=auth.uid();
end $$;
revoke all on function public.begin_account_deletion(boolean) from public,anon;
grant execute on function public.begin_account_deletion(boolean) to authenticated;

-- Serialize interactions with deletion; a peer cannot create a new commitment
-- after deletion checks, nor insert uploads/messages from a pending account.
create function dan_private.check_live_parties() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_ids uuid[];
begin
 if tg_table_name='matches' then
   if new.status not in('BUYER_INTERESTED','SELLER_ACCEPTED','CONNECTED') then return new; end if;
   v_ids:=array[new.buyer_id,new.seller_id];
 elsif tg_table_name='responses' then
   if new.status<>'OPEN' then return new; end if;
   v_ids:=array[new.responder_id,(select user_id from public.demands where id=new.demand_id)];
 else v_ids:=array[new.user_id]; end if;
 for v_id in select unnest(v_ids) order by 1 loop
   perform 1 from public.profiles where id=v_id and deleted_at is null and deletion_started_at is null for update;
   if not found then raise exception 'account unavailable' using errcode='42501'; end if;
 end loop;
 return new;
end $$;
revoke all on function dan_private.check_live_parties() from public,anon,authenticated;
create trigger account_live_parties before insert or update on public.matches for each row execute function dan_private.check_live_parties();
create trigger account_live_parties before insert or update on public.responses for each row execute function dan_private.check_live_parties();
create trigger account_live_parties before insert on public.demands for each row execute function dan_private.check_live_parties();

-- Metadata is read only by the Edge Function; object bytes are removed through
-- the Storage API, never by DELETE FROM storage.objects.
create function public.account_deletion_files(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=p_user_id and deletion_started_at is not null and deleted_at is null) then
   raise exception 'deletion not requested'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('bucket',bucket_id,'name',name)) from storage.objects
   where owner_id=p_user_id::text or (bucket_id='dan-v1-evidence' and split_part(name,'/',1)=p_user_id::text)),'[]'::jsonb);
end $$;
revoke all on function public.account_deletion_files(uuid) from public,anon,authenticated;
grant execute on function public.account_deletion_files(uuid) to service_role;

-- Privacy-only redaction exception for already terminal locked snapshots.
-- Client operations cannot set this transaction-local marker or call the cleanup.
do $$ begin
 execute regexp_replace(pg_get_functiondef('public.enforce_matched_buy_terms_immutable()'::regprocedure),
   '\mbegin\M', 'begin IF current_setting(''dan.account_cleanup'',true)=''on'' AND current_user=''postgres'' THEN RETURN new; END IF;', 'i');
end $$;
create or replace function public.prevent_locked_deal_snapshot_mutation() returns trigger
language plpgsql set search_path='' as $$
begin
 if current_setting('dan.account_cleanup',true)='on' and current_user='postgres' then
   return case when tg_op='DELETE' then old else new end;
 end if;
 if old.locked_at is not null and (tg_op='DELETE' or new.snapshot is distinct from old.snapshot
  or new.agreed_price is distinct from old.agreed_price or new.buyer_id is distinct from old.buyer_id
  or new.seller_id is distinct from old.seller_id or new.demand_id is distinct from old.demand_id
  or new.product_id is distinct from old.product_id or new.locked_at is distinct from old.locked_at) then
  raise exception 'locked deal snapshot is immutable';
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;

create function dan_private.cleanup_deleted_account() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_id uuid:=old.id;
begin
 perform 1 from public.profiles where id=v_id for update;
 if not found then return old; end if;
 if not exists(select 1 from public.profiles where id=v_id and deletion_started_at is not null) then
   raise exception 'account deletion must use the deletion service'; end if;
 if dan_private.deletion_blockers(v_id)>0 then raise exception 'ACTIVE_TRANSACTIONS'; end if;
 if exists(select 1 from storage.objects where owner_id=v_id::text or (bucket_id='dan-v1-evidence' and split_part(name,'/',1)=v_id::text)) then
   raise exception 'uploaded files remain'; end if;
 perform set_config('dan.account_cleanup','on',true);
 delete from public.activity_events where recipient_id=v_id;
 update public.activity_events set actor_id=null where actor_id=v_id;
 delete from public.blocks where v_id in(blocker_id,blocked_id);
 delete from public.user_verifications where user_id=v_id;
 delete from public.dan_admin_users where user_id=v_id;
 delete from public.reports where v_id in(reporter_id,target_user_id);
 update public.risk_flags set user_id=null,detail='{}' where user_id=v_id or match_id in(select id from public.matches where v_id in(buyer_id,seller_id));
 update public.admin_audit_log set actor_id=null,target_id='deleted',detail='{}' where actor_id=v_id or target_id=v_id::text;
 delete from public.deal_evidence_challenges where seller_id=v_id;
 delete from public.deal_evidence where seller_id=v_id;
 -- Free-text from either side of a shared conversation may identify the leaver.
 update public.messages set body='탈퇴한 사용자가 포함된 대화 내용이 삭제되었어요.'
   where match_id in(select id from public.matches where v_id in(buyer_id,seller_id));
 update public.deal_snapshots set snapshot=jsonb_build_object('accountDeleted',true,'type',
   (select type from public.demands where id=deal_snapshots.demand_id))
   where v_id in(buyer_id,seller_id);
 update public.deal_disputes set detail='',resolution_note='' where match_id in(select id from public.matches where v_id in(buyer_id,seller_id));
 update public.matches set cancel_reason=null,payment_provider_ref=null where v_id in(buyer_id,seller_id);
 delete from public.demand_exact_geo where demand_id in(select id from public.demands where user_id=v_id);
 update public.responses set message='',availability_text=null,status=case when status='OPEN' then 'WITHDRAWN' else status end
   where responder_id=v_id or demand_id in(select id from public.demands where user_id=v_id);
 update public.sell_intents set status='CLOSED',condition_note='',quick_photo_url=null,approx_usage_count=null where user_id=v_id;
 update public.ownerships set status='RELEASED' where user_id=v_id;
 update public.demands set status='CLOSED',title='탈퇴한 사용자의 요청',description='',location='',
   fulfillment_options='[]',item_name=null,task_description=null,service_description=null,
   start_at=null,end_at=null,preferred_at=null,due_at=null where user_id=v_id;
 -- Unreferenced drafts/posts are erased; rows necessary for peer history remain.
 delete from public.responses r where responder_id=v_id and not exists(select 1 from public.matches m where m.response_id=r.id);
 delete from public.sell_intents s where user_id=v_id and not exists(select 1 from public.matches m where m.sell_intent_id=s.id);
 delete from public.ownerships o where user_id=v_id and not exists(select 1 from public.sell_intents s where s.ownership_id=o.id);
 delete from public.demands d where user_id=v_id and not exists(select 1 from public.matches m where m.demand_id=d.id);
 update public.profiles set auth_user_id=null,deleted_at=now(),display_name='탈퇴한 사용자',location=null,default_area_label=null,bio=null where id=v_id;
 return old;
end $$;
revoke all on function dan_private.cleanup_deleted_account() from public,anon,authenticated;
create trigger dan_account_cleanup before delete on auth.users for each row execute function dan_private.cleanup_deleted_account();
