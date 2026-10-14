# Script notes

One-off copy/seed patch scripts were removed after generalization:

- `add_ko_keys.py`
- `fix_title_sep.py`
- `gen_mockdata_v2.py`
- `patch_seed_ko.py`
- `write-ko-v2.mjs`

Kept tooling (if present): `gen-mockdata.mjs`, `polish-copy.mjs`, etc. for
occasional local generation — not part of the runtime product.

Staging seed/deploy guards:

- `npm run db:seed:staging` — local localhost still works; remote seed requires `DAN_STAGING_SUPABASE_PROJECT_REF` matching the DB URL and refuses the known production ref
- `npm run assert:staging-deploy` — used by Deploy Cloudflare Staging; does not deploy

`scripts/apply-migrations-remote.mjs` and `scripts/apply-0016.mjs` are default-deny. They do not default to a production project ref. Staging needs `DAN_ENV=staging`, `DAN_REMOTE_CONFIRM=apply-staging-only`, and `DAN_STAGING_SUPABASE_PROJECT_REF`. Production needs `DAN_ENV=production`, `DAN_REMOTE_CONFIRM=apply-production-only`, and an explicit `DAN_SUPABASE_PROJECT_REF`.
