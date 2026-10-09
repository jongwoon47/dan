-- pgTAP-style expectations for user_consents authority boundary.

begin;
select plan(8);

select has_table('public', 'user_consents', 'user_consents exists');
select has_table('public', 'consent_requirements', 'consent_requirements exists');
select col_is_pk('public', 'user_consents', 'user_id', 'one consent row per user');
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'user_consents'),
  'RLS enabled on user_consents'
);
select ok(
  has_column_privilege('authenticated', 'public.user_consents', 'user_id', 'select')
  and not has_column_privilege('authenticated', 'public.user_consents', 'user_id', 'insert')
  and not has_column_privilege('authenticated', 'public.user_consents', 'user_id', 'update')
  and not has_table_privilege('anon', 'public.user_consents', 'select'),
  'authenticated can read own consent rows only via select; writes go through RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.accept_my_consents()', 'execute')
  and has_function_privilege('authenticated', 'public.get_consent_requirements()', 'execute'),
  'authenticated can execute consent RPCs'
);
select ok(
  not has_table_privilege('authenticated', 'public.consent_requirements', 'insert')
  and not has_table_privilege('authenticated', 'public.consent_requirements', 'update'),
  'clients cannot mutate consent_requirements'
);
select ok(
  (select terms_version = '2026-10-07' and privacy_version = '2026-10-07'
   from public.consent_requirements where singleton),
  'required consent versions are seeded'
);

select * from finish();
rollback;
