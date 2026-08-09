# Final Production Reconciliation Evidence

## Scope and safety

- Evidence finalized: 2026-08-09
- Production project: `atxecflhmphaqqkatjlm`
- Production inspection: read-only catalog and aggregate queries
- Production writes, migrations, ledger, RLS, ACL, trigger, Auth, and business-data changes: 0
- Repository starting commit: `89f21863705137581a72c6596cdc5ac15afb49ea`

## Forward canonicalization migration

Migration: `20260809120000_canonicalize_production_authorization_baseline.sql`

Normalized SHA-256:
`f6a213c2529c41a3cec7151e8a5a7be7be073df42f9a7720a76dbff40d00c405`

It removes only these policies when present with the exact reviewed semantics:

| Policy                   | Command | Role          | USING                                     | WITH CHECK | Historical source                           |
| ------------------------ | ------- | ------------- | ----------------------------------------- | ---------- | ------------------------------------------- |
| `Admin updates all RFQs` | UPDATE  | authenticated | `has_role(auth.uid(), 'admin'::app_role)` | same       | `20260702153500_admin_management_pages.sql` |
| `Admin deletes all RFQs` | DELETE  | authenticated | `has_role(auth.uid(), 'admin'::app_role)` | none       | `20260702153500_admin_management_pages.sql` |

The migration verifies `public.rfqs`, RLS state, target-policy semantics, and the full canonical RFQ
policy set before removal. It accepts both policies being absent and verifies they remain absent
afterward. It contains no policy creation, grant, revoke, trigger, function, schema, or data change.

## Production no-op evidence

Fresh read-only Production policy evidence captured at
`2026-08-08T21:59:46.629804+00:00` contains 148 policies and neither target policy. Therefore
future execution against the current Production state is expected to produce:

- Policy object changes: 0
- RLS changes: 0
- ACL changes: 0
- Trigger changes: 0
- Business-data changes: 0
- Localization changes: 0
- Provenance change: the normal migration-ledger entry only

The migration has not been executed against Production.

## Canonical reconstruction

- Executable migrations: 67
- Archived files: 15
- Archived files executed: 0
- Clean isolated reconstruction: PASS
- Production connectivity, credentials, and project link: none
- Schema SHA-256: `7d13a27c750922f78e405e93a9c873d5459888e2f6c4ad94cc35db871f239e15`
- Catalog SHA-256: `b0c215980d192222d19da193b98eff7cae41bb6b6a715f348d9bfc851d44cb5d`
- Expected fingerprint equality: PASS

## Policy parity

Candidate and Production each contain 148 normalized policies.

- Candidate-only: 0
- Production-only: 0
- Semantic differences: 0
- Shared policy SHA-256:
  `f5485b3f92914d07d214a49b0f64e0226182643475c1654d8eba6cf03f754b78`

## Function and grant evidence

All 57 application function identities and reviewed semantics are resolved. The focused
`prevent_non_admin_account_status_change()` definition, owner, `SECURITY DEFINER` state, arguments,
and `search_path` match. Its Production authenticated EXECUTE remains deferred hardening.

Grant evidence remains complete rather than hidden:

- Candidate-only Storage table grants: 18, managed local-stack difference
- Production-only hosted-default table grants: 130, exact allowlisted evidence
- Production-only `service_role` table grants: 12, managed environment difference
- Production-only routine grants: 56 managed `service_role` plus one deferred authenticated ACL
- Unexplained grant differences: 0

The exact candidate and Production grant hashes remain pinned in tests. See
`GRANT_BASELINE_POLICY.md`.

## Generated types

`src/integrations/supabase/types.ts` now exactly matches the isolated generated artifact.

- SHA-256: `d775795e7a392344778d347fd65d59a82077225db39dd5457f9a49959c859d23`
- `profiles.city_name`: present
- `rfq_lifecycle_events`: present
- `is_agency_rfq_eligible`: present
- Generated-type drift gate: blocking

Additional authoritative changes are the generated `graphql_public` schema, corrected
`admin_audit_logs.ip_address` nullability, corrected `admin_get_user_auth_metadata.last_sign_in_at`
nullability, deterministic object ordering, and the generator's current output shape.

## Localization

- Matched rows: 1,583
- Differing rows: 0
- Missing rows: 0
- Ambiguous keys: 0
- Expected Production updates: 0
- Semantic checksum:
  `a0763bccedb304a6e7c09ed3fa936f82e55d31a33d106fd995cc21a25b7984ae`

## Deferred maintenance

- authenticated EXECUTE hardening
- duplicate-trigger cleanup
- July 26 ledger repair
- active-account authorization redesign
- managed Supabase ACL normalization

These are separately governed changes and are not part of PR2 canonicalization.

## Decision

Repository canonicalization is complete locally. Production remains unchanged. Final PR2 merge
readiness depends on exact-head GitHub Build Verification and Database Reconstruction checks.
