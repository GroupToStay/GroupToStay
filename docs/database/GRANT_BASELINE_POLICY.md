# Grant Baseline Policy

## Purpose

This policy separates application-owned authorization from Supabase-managed environment defaults
without globally ignoring grant drift.

## Application-semantic grants

The canonical catalog fingerprint includes privileges where:

- the object belongs to `public`;
- the grantee is `anon` or `authenticated`; and
- the object is a relation, column, or routine.

These grants are fingerprinted as `application_table_grants`, `application_column_grants`, and
`application_routine_grants`. Any change fails reconstruction until the reviewed expected
fingerprint is updated.

## Managed categories

The following differences are environmental, but remain visible in exact exports:

1. `storage.*` grants, including local `iceberg_*` objects, are Storage-managed.
2. `service_role` grants are hosted/local Supabase defaults and are not application API grants.
3. `postgres` owner privileges are ownership mechanics, not client authorization.
4. Extension/runtime roles are environment-managed.

No rule ignores all grants for a schema or role without retaining object-level evidence.

## Hosted default ACL allowlist

The approved Production-only hosted-default baseline is limited to the exact privileges represented
by grant SHA-256 `0024d8405f899aa0fac51d8c1fbd41b7038d09c3b683606d8fe2a8c422ffe68a`.
The candidate baseline is SHA-256
`6fe10d7a4d9819d5cf7455ac9e3e176a9180b70837ce65a4a2740e691de5ed52`.

Role/relation scope:

- `anon`: 91 privileges across 26 explicitly listed relations in
  `scripts/compare-database-evidence.mjs`.
- `authenticated`: 39 privileges across 16 explicitly listed relations in the same file.

The comparison must satisfy both the allowlisted role/relation scope and the pinned full grant
hashes. A new relation, role, privilege, grantability state, or grantor changes the evidence and
fails tests until separately reviewed.

Column differences derived from an allowlisted table grant are classified as derived evidence,
not independent ACL changes.

## Deferred function ACL

Production grants authenticated EXECUTE on
`public.prevent_non_admin_account_status_change()`, while the candidate does not. The function
definition is identical and the owner deferred revocation. This one difference is recorded as
`canonical_production_acl_reconstruction_gap`; it must not be normalized or silently removed by
PR2.

## CI invariants

CI must fail when:

- an application-semantic candidate fingerprint changes;
- policy parity is no longer exact;
- a grant export SHA changes without review;
- any difference is classified as `unexplained_blocker`;
- managed classification expands beyond the explicit rules above; or
- generated Supabase types drift from the reconstructed schema.

Managed differences are classification evidence, not permission to add broad application grants.
