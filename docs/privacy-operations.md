# DAN privacy operations — 2026-10-07

Owner/contact confirmed by the operator: 원종운, jongun0361@hanyang.ac.kr.
Scope: static public policy/support pages only. No Auth/schema/config changes.

## Retention decisions

The operator delegated selection of the retention period. Adopted service policy:

- Personal account/profile/content: existing account deletion cleanup.
- Terminal records left after deletion: at most one year from that party's
  `profiles.deleted_at`, with free text and Auth identity already removed.
- Support mailbox correspondence: one year from case closure.
- Applicable legal preservation exceptions require a documented reason,
  scope and expiry; do not assert blanket mandatory ecommerce retention.

These are operator duties, not a claim of an implemented automatic expiry job.
The existing deletion migration retains historical profile UUIDs and has no
time-based purge. It must not be described as irreversible anonymization.

## Operator workflow

1. Record each deletion date and one-year deadline in an access-restricted
   retention register; do not copy the deleted identity into this register.
2. Review deadlines monthly and perform cleanup by each deadline. The first
   public-policy deadline is one year after its effective date for deletions
   on that date; existing older tombstones require review before public release.
3. Before cleanup, identify the party's terminal matches and linked request,
   response, offer, snapshot, dispute and audit records using the actual FKs.
   Retained UUIDs can still be linkable; removing free text alone is insufficient.
4. Use a reviewed server-side cleanup procedure to remove or irreversibly
   unlink the expired party's historical identifier while preserving the live
   counterparty's legitimate record. Test on staging first. Never blindly
   cascade-delete profiles, matches or the counterparty's content.
5. If safe unlinking is not yet available, escalate before the deadline;
   indefinite retention is not compliant with the published one-year policy.
6. Delete expired support correspondence and attachments from the mailbox
   and normal recoverable trash, subject to documented legal holds.
7. Track infrastructure log/backup retention separately; account deletion
   does not establish immediate physical backup erasure.

## Evidence and limits

- Current serving app bundles were inspected via source and preserved unchanged.
- Supabase primary project region verified read-only: ap-northeast-2 (Seoul).
- Optional current-place lookup sends exact coordinates to Nominatim. It is
  disclosed, not incorrectly described as local-only location processing.
- NoopAnalyticsProvider is active; no advertising/behavior SDK claim was added.
- Provider policies linked on the public page are not proof of DAN's consent
  implementation or a substitute for actual transfer records.

Before public release, verify applicable Korean international-transfer notice/
consent requirements, actual provider processing countries/contact/retention,
mailbox provider details, and align Apple privacy labels and in-app access to the
policy with actual collection. Do not mark those gates complete just because
the policy URL returns HTTP 200. No App Store review or privacy questionnaire
submission is part of this change.
