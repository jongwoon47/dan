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

- `npm run db:seed:staging` — staging DB only; refuses production env and the known production Supabase ref
- `npm run assert:staging-deploy` — used by Deploy Cloudflare Staging; does not deploy

`scripts/apply-migrations-remote.mjs` and `scripts/apply-0016.mjs` target a hardcoded production project ref. Do not use them for staging.
