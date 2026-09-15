# Remote migration apply (DAN)

Migrations are additive SQL under `supabase/migrations/`.  
**Do not edit or rewrite already-applied files.** Add `000N_*.sql` instead.

## Apply on Supabase (SQL Editor)

1. Open the project → **SQL Editor**
2. Paste and run each **not-yet-applied** file in order
3. Current P0 security chain (after base `0001`–`0007`):

| File | Purpose |
|------|---------|
| `0008_prevent_duplicate_connections.sql` | Unique CONNECTED + accept guard |
| `0009_security_p0_hardening.sql` | RPC-only responses/demand updates, sell_intent integrity, activity read-only |
| `0010_service_duration.sql` | SERVICE duration fields |
| `0011_public_profile_trust.sql` | Public profile trust-card stats RPC (counts + redacted recent activity) |

## Verify applied

Run in SQL Editor:

```sql
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'matches_one_connected_response_uidx',
    'matches_parties_demand_connected_uidx'
  );

select policyname, tablename
from pg_policies
where schemaname = 'public'
  and policyname in (
    'responses_no_direct_insert',
    'responses_no_direct_update',
    'demands_no_direct_update',
    'activity_no_direct_update'
  );

select tgname
from pg_trigger
where tgname = 'trg_sell_intent_ownership';
```

Expect: 2 indexes, 4 policies, 1 trigger.

## Automated probe

```bash
npm run test:e2e:security
```

Reports `migration0008` / `migration0009` as PASS when remote behavior matches hardening.
If forbidden REST writes still succeed, migrations are missing — apply `0008`/`0009` and re-run.

## Notes

- Frontend uses **anon key only**; DDL cannot be applied from the app.
## Network note (this workspace)

Direct `supabase db query --linked` may time out against the pooler
(`LegacyDbConfigConnectTempRoleError` / connection timeout) if the host cannot
reach `*.pooler.supabase.com`. In that case apply SQL in the **Supabase Dashboard
→ SQL Editor** (same SQL files), then re-run `npm run test:e2e:security`.
