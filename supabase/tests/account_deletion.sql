begin;
select plan(30);
select ok(not has_function_privilege('anon','public.begin_account_deletion(boolean)','execute'),'anonymous cannot start deletion');
select ok(not has_function_privilege('authenticated','public.account_deletion_files(uuid)','execute'),'client cannot list arbitrary deletion files');
select ok(not has_function_privilege('authenticated','dan_private.cleanup_deleted_account()','execute'),'client cannot run privileged cleanup');
select ok(not has_column_privilege('authenticated','public.profiles','auth_user_id','update'),'client cannot alter Auth linkage');
select ok(not has_column_privilege('authenticated','public.profiles','deleted_at','update'),'client cannot forge tombstones');
select set_config('request.jwt.claims','{}',true);

insert into auth.users(id,email) values
 ('eeeeeeee-1000-4000-8000-000000000001','delete-test-a@example.test'),
 ('eeeeeeee-1000-4000-8000-000000000002','delete-test-b@example.test');
insert into public.demands(id,user_id,type,title,description,category,budget,location,status) values
 ('eeeeeeee-2000-4000-8000-000000000001','eeeeeeee-1000-4000-8000-000000000001','TASK','private request','private description','other',1000,'private address','MATCHED');
insert into public.responses(id,demand_id,responder_id,status,message) values
 ('eeeeeeee-3000-4000-8000-000000000001','eeeeeeee-2000-4000-8000-000000000001','eeeeeeee-1000-4000-8000-000000000002','ACCEPTED','private reply');
insert into public.matches(id,demand_id,response_id,buyer_id,seller_id,status) values
 ('eeeeeeee-4000-4000-8000-000000000001','eeeeeeee-2000-4000-8000-000000000001','eeeeeeee-3000-4000-8000-000000000001','eeeeeeee-1000-4000-8000-000000000001','eeeeeeee-1000-4000-8000-000000000002','CONNECTED');
insert into public.messages(match_id,sender_id,body) values
 ('eeeeeeee-4000-4000-8000-000000000001','eeeeeeee-1000-4000-8000-000000000001','private chat'),
 ('eeeeeeee-4000-4000-8000-000000000001','eeeeeeee-1000-4000-8000-000000000002','private counterpart mention');
insert into public.deal_snapshots(match_id,demand_id,buyer_id,seller_id,agreed_price,snapshot,locked_at) values
 ('eeeeeeee-4000-4000-8000-000000000001','eeeeeeee-2000-4000-8000-000000000001','eeeeeeee-1000-4000-8000-000000000001','eeeeeeee-1000-4000-8000-000000000002',1000,'{"private":"private contact"}',now());
update public.demands set type='BORROW' where id='eeeeeeee-2000-4000-8000-000000000001';
select is(dan_private.deletion_blockers('eeeeeeee-1000-4000-8000-000000000001'),1,'BORROW blocks deletion');
update public.demands set type='SERVICE' where id='eeeeeeee-2000-4000-8000-000000000001';
select is(dan_private.deletion_blockers('eeeeeeee-1000-4000-8000-000000000001'),1,'SERVICE blocks deletion');
update public.demands set type='BUY',product_id=(select id from public.products where canonical_name='Sony RX100 VII' limit 1),max_price=1000 where id='eeeeeeee-2000-4000-8000-000000000001';
select is(dan_private.deletion_blockers('eeeeeeee-1000-4000-8000-000000000001'),1,'BUY blocks deletion');
update public.demands set type='TASK' where id='eeeeeeee-2000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"eeeeeeee-1000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok('select public.begin_account_deletion(false)','P0001','explicit confirmation required','explicit confirmation required');
select is((public.account_deletion_status()->>'activeTransactions')::integer,1,'connected trade blocks deletion');
select throws_ok('select public.begin_account_deletion(true)','P0001','ACTIVE_TRANSACTIONS','active transaction refuses deletion');
reset role;
select ok((select deletion_started_at is null from public.profiles where id='eeeeeeee-1000-4000-8000-000000000001'),'blocked attempt has no partial deletion');
update public.matches set status='CLOSED',payment_status='PAID' where id='eeeeeeee-4000-4000-8000-000000000001';
select is(dan_private.deletion_blockers('eeeeeeee-1000-4000-8000-000000000001'),1,'closed but unrefunded payment blocks deletion');
update public.matches set status='COMPLETED',completed_at=now() where id='eeeeeeee-4000-4000-8000-000000000001';
insert into public.deal_disputes(match_id,opened_by,reason,status,detail) values('eeeeeeee-4000-4000-8000-000000000001','eeeeeeee-1000-4000-8000-000000000002','OTHER','OPEN','private dispute');
select is(dan_private.deletion_blockers('eeeeeeee-1000-4000-8000-000000000001'),1,'open dispute blocks deletion even on completed trade');
update public.deal_disputes set status='CLOSED' where match_id='eeeeeeee-4000-4000-8000-000000000001';
set local role authenticated;
select lives_ok('select public.begin_account_deletion(true)','completed trade allows deletion');
select throws_ok('select public.send_message(''eeeeeeee-4000-4000-8000-000000000001'',''new text'')','42501','account unavailable','pending deletion blocks privileged mutation');
select is((select count(*)::integer from public.matches),0,'pending account loses authenticated RLS access');
reset role;
select ok((select deletion_started_at is null from public.profiles where id='eeeeeeee-1000-4000-8000-000000000002'),'other account remains untouched');
select set_config('request.jwt.claims','{"sub":"eeeeeeee-1000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok('insert into public.matches(demand_id,response_id,buyer_id,seller_id,status) values(''eeeeeeee-2000-4000-8000-000000000001'',''eeeeeeee-3000-4000-8000-000000000001'',''eeeeeeee-1000-4000-8000-000000000001'',''eeeeeeee-1000-4000-8000-000000000002'',''CONNECTED'')','42501','account unavailable','peer cannot create a commitment after deletion starts');
select set_config('request.jwt.claims','{"sub":"eeeeeeee-1000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok('delete from auth.users where id=''eeeeeeee-1000-4000-8000-000000000001''','Auth hard deletion and cleanup commit together');
select is((select count(*)::integer from auth.users where id='eeeeeeee-1000-4000-8000-000000000001'),0,'Auth account erased');
select ok((select auth_user_id is null and deleted_at is not null and display_name='탈퇴한 사용자' and bio is null and location is null from public.profiles where id='eeeeeeee-1000-4000-8000-000000000001'),'profile becomes identity-free tombstone');
select is((select status from public.matches where id='eeeeeeee-4000-4000-8000-000000000001'),'COMPLETED','completed peer history retained');
select is((select agreed_price::integer from public.deal_snapshots where match_id='eeeeeeee-4000-4000-8000-000000000001'),1000,'locked agreed amount retained');
select ok((select snapshot='{"accountDeleted":true,"type":"TASK"}'::jsonb from public.deal_snapshots where match_id='eeeeeeee-4000-4000-8000-000000000001'),'locked snapshot personal payload redacted');
select is((select count(*)::integer from public.messages where match_id='eeeeeeee-4000-4000-8000-000000000001' and body like 'private%'),0,'both-side private chat text removed');
set local role authenticated;
select throws_ok('select public.ensure_product(''deleted mutation'',''other'')','42501','account unavailable','old JWT cannot call privileged RPC');
select throws_ok('select public.account_deletion_status()','42501','not authenticated','old JWT cannot restart deletion');
select is((select count(*)::integer from public.matches),0,'old JWT cannot read retained private records');
reset role;
select set_config('request.jwt.claims','{"sub":"eeeeeeee-1000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::integer from public.matches where id='eeeeeeee-4000-4000-8000-000000000001'),1,'counterparty can still read completed transaction');
reset role;
select * from finish();
rollback;
