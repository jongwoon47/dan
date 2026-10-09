-- pgTAP-style expectations for user_consents RLS (run in Supabase SQL test harness).

begin;
select plan(4);

select has_table('public', 'user_consents', 'user_consents exists');
select col_is_pk('public', 'user_consents', 'user_id', 'one consent row per user');
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'user_consents'),
  'RLS enabled on user_consents'
);
select ok(
  has_column_privilege('authenticated', 'public.user_consents', 'user_id', 'select')
  and has_column_privilege('authenticated', 'public.user_consents', 'user_id', 'insert')
  and has_column_privilege('authenticated', 'public.user_consents', 'user_id', 'update')
  and not has_table_privilege('anon', 'public.user_consents', 'select'),
  'authenticated can read/write own table; anon cannot select'
);

select * from finish();
rollback;
