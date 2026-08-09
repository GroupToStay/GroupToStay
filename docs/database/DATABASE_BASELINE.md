# Database Baseline

## Identity and scope

- Certification date: 2026-08-09
- Branch: `chore/v3-pr2-database-reconciliation`
- Starting Git commit: `89f21863705137581a72c6596cdc5ac15afb49ea`
- Production Supabase project: `atxecflhmphaqqkatjlm`
- Production access during reconciliation: read-only catalog and aggregate queries
- Production writes, migrations, ledger changes, RLS changes, and data changes: none

Current Production authorization behavior is the canonical V3 starting contract.

## Canonical repository chain

- Executable migrations: 67
- Archived non-executable July 12 files: 15
- Archived files executed during reconstruction: 0
- Latest migration:
  `20260809120000_canonicalize_production_authorization_baseline.sql`
- Latest migration normalized SHA-256:
  `f6a213c2529c41a3cec7151e8a5a7be7be073df42f9a7720a76dbff40d00c405`

Historical SQL was not rewritten. Eleven replay bundles and four mixed-history files remain
byte-preserved under `supabase/migration-archive/` and are excluded from executable migration
discovery and CI reconstruction.

The forward migration removes only these non-canonical repository policies when they exist:

- `public.rfqs.Admin updates all RFQs`
- `public.rfqs.Admin deletes all RFQs`

It validates their exact recorded definitions before removal, accepts their absence as canonical,
and verifies the complete expected RFQ policy set and RLS state afterward.

## Canonical reconstruction

An empty isolated Supabase database reconstructs successfully with Supabase CLI `2.113.0` and no
Production connectivity, credentials, or project link.

| Evidence            | Canonical value                                                    |
| ------------------- | ------------------------------------------------------------------ |
| Schema dump SHA-256 | `7d13a27c750922f78e405e93a9c873d5459888e2f6c4ad94cc35db871f239e15` |
| Catalog SHA-256     | `b0c215980d192222d19da193b98eff7cae41bb6b6a715f348d9bfc851d44cb5d` |
| Relations           | 34                                                                 |
| Columns             | 357                                                                |
| Constraints         | 111                                                                |
| Indexes             | 74                                                                 |
| Functions           | 57                                                                 |
| Triggers            | 57, including the `auth.users` profile trigger                     |
| Policies            | 148                                                                |
| Localization rows   | 1,583                                                              |

All six duplicate-trigger behavioral fixtures pass. Duplicate-trigger cleanup is intentionally
deferred and the current trigger topology remains unchanged.

## Authorization baseline

The normalized candidate and Production policy exports are identical:

- Candidate-only policies: 0
- Production-only policies: 0
- Semantic differences: 0
- Policy SHA-256 on both sides:
  `f5485b3f92914d07d214a49b0f64e0226182643475c1654d8eba6cf03f754b78`

Application grant fingerprints include only `anon` and `authenticated` privileges on `public`
objects. Hosted default ACLs, Storage objects, owner privileges, and `service_role` grants are
classified through the permanent rules in `GRANT_BASELINE_POLICY.md`; they are not normalized by
application SQL.

## Localization baseline

The canonical source is `supabase/reference-data/cities-arabic.json`.

- Matched stable keys: 1,583
- Differing Arabic labels: 0
- Missing keys: 0
- Ambiguous keys: 0
- Expected current Production updates: 0
- Stable semantic checksum:
  `a0763bccedb304a6e7c09ed3fa936f82e55d31a33d106fd995cc21a25b7984ae`

No additional Production localization migration is required.

## Generated types

`src/integrations/supabase/types.ts` is generated from the final empty reconstruction and has
SHA-256 `d775795e7a392344778d347fd65d59a82077225db39dd5457f9a49959c859d23`.

It includes `profiles.city_name`, `rfq_lifecycle_events`, and
`is_agency_rfq_eligible`. Reconstruction now fails with `generated_type_drift` whenever generated
types do not exactly match the committed file.

## Production state

Production already lacks both non-canonical policies. Applying the forward migration later would
make zero object-level changes and zero business-data changes; only normal migration provenance
would advance. Production execution and ledger alignment require a separate owner approval.

## Deferred maintenance

- `prevent_non_admin_account_status_change()` authenticated EXECUTE hardening
- duplicate-trigger cleanup
- July 26 ledger repair
- active-account authorization redesign
- managed Supabase ACL normalization

None of these deferred items blocks the canonical repository baseline.
