# Account deletion (staging)

Only `feature/dan-v3-real-app-ui` and the designated staging Supabase project are in scope. No production deployment or migration is authorized.

## Identity and authorization

The Edge Function accepts `{ "confirm": true }` only, validates the bearer token with GoTrue `getUser`, then derives the user ID from that response. A caller-supplied ID is rejected. Server-only service-role access handles Storage deletion and GoTrue hard deletion. No browser secret is added.

`profiles.id` remains the historical party identifier. The old Auth-to-profile cascade FK is replaced with nullable `auth_user_id` and `deleted_at`, so deleting Auth cannot erase the counterparty's terminal history. This is pseudonymization: historical UUIDs remain, but there is no Auth identity, profile name, contact details or authentication connection. It is not a claim of mathematically irreversible anonymization.

Existing RLS remains enabled. Restrictive policies deny authenticated table/storage access for deleted or pending accounts. Existing privileged PL/pgSQL client RPCs acquire the account lock and check a live account before their unchanged business logic; anonymous boolean discovery helpers stay available. New RPCs must use the same guard. Sessions/identities/refresh tokens are removed by GoTrue hard deletion; any outstanding signed JWT is additionally denied by the application data/RPC guards.

## Policy

- Refuse deletion for BUYER_INTERESTED, SELLER_ACCEPTED, CONNECTED, paid but incomplete transactions, and OPEN/REVIEWING disputes. Use existing completion/cancellation/refund flows first. No new forced cancellation semantics.
- Delete Auth identities/sessions, verifications, notifications addressed to the user, blocks, reports involving the user, uploaded files, evidence authored by the user, exact coordinates, and unreferenced drafts/posts/responses/offers/ownerships.
- Redact profile name/area/bio, retained request text/location/scheduling/fulfillment data, response free text, offer notes/photos, shared chat body on both sides, locked snapshot personal payload, dispute text, relevant risk/audit details and provider/cancellation free-form references.
- Keep terminal match states, numeric prices, structured type, timestamps and history links for the remaining party. Locked snapshot redaction has a narrowly scoped private cleanup-only exception; clients still cannot edit locked terms.
- Retained records support counterpart history and integrity. No statutory retention duration or legal requirement is invented here. The business owner must set and publish the actual retention schedule before public operation; no production data is touched.

## Failure and concurrency

Reserve deletion while locking the profile/party matches. A pending account cannot transact or upload. Peer commitments also lock and check parties, preventing a match race. Storage bytes are removed through the API before Auth deletion. Storage/API failure leaves a retryable pending account; Auth and final DAN cleanup execute atomically inside GoTrue's database transaction. The Auth-delete trigger rechecks blockers and remaining objects and fails closed. Partially removed files cannot be restored, so the UI truthfully describes a pending deletion and offers retry instead of canceling midway.

## Client

Settings → deletion explanation → Delete → separate final confirmation. Loading, blocker guidance, deleting, error/retry and success are explicit; a ref lock prevents duplicate submit. Successful server deletion resets Auth, signs out locally, clears only DAN-owned storage and the current Supabase session, and replaces the document with the login success screen. The full reload clears in-memory data providers. Restored pages validate Auth again; stale sessions do not restore authenticated data.

## Deployment and verification

Apply `20261006054157_account_deletion.sql` only after tests/CI succeed. Deploy `supabase/functions/delete-account` only to the designated staging project. JWT gateway verification can be disabled only because the function validates each caller with GoTrue `getUser` before any privileged action (required for current asymmetric Auth tokens). Use standard Supabase server environment secrets, never `VITE_` secrets.

Rollback: disable the deletion endpoint/UI first. Do not re-add the old cascade FK after any deletion: terminal tombstones no longer have Auth users, and a rollback must never reconstruct deleted identities or personal data. Guards and retention links should remain until a forward repair migration is tested. Backups and access logs follow infrastructure retention controls separately; this feature does not claim immediate physical backup erasure.
