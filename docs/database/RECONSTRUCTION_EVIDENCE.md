# Reconstruction Evidence and Canonical Strategy

- Audit date: 2026-08-08
- Baseline: `7918ea532eeeba809357a05db07117dc4aeb103a`
- Candidate migration count: 80
- Production writes: none

## Ephemeral workflow

`.github/workflows/database-reconstruction.yml` runs on a GitHub-hosted Ubuntu runner with Supabase CLI `2.113.0`. The runner uses Docker only for an empty local Supabase database. The repository `supabase/` directory is copied to a temporary work directory and its local Docker project ID is replaced with `grouptostay_reconstruction`.

The runner refuses `DATABASE_URL`, `POSTGRES_URL`, `PGHOST`, `PGPASSWORD`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and `SUPABASE_PROJECT_REF`. It never calls `supabase link`, `db push`, `migration repair`, or any remote command. Logs redact connection strings, JWT-shaped values, Supabase keys, and named secret/token/password values before artifact upload.

`supabase db start` applies the migration directory in filename order and stops on the first error. A JSON artifact records the migration filename, error class, affected object, exit code, CLI version, and proof that no project link or Production credential was used. Candidate types and a normalized `public,auth,storage` schema fingerprint are produced only after a successful reconstruction.

## First run blocker (resolved by approved archive)

Static execution-order analysis identifies the deterministic first repository blocker:

- **Migration:** `20260712153351_2b072552-53fa-42d9-a145-a69d792938cd.sql`
- **Class:** duplicate object / replay migration
- **First affected object:** `public.app_role`
- **Cause:** the file begins by recreating the enum already created by `20260613080917_acae207a-07d5-4e50-9434-78ac8fb76f8b.sql` with unguarded `CREATE TYPE`.

GitHub Actions run
[`31263370680`](https://github.com/GroupToStay/GroupToStay/actions/runs/31263370680),
against commit `cbea16bc53906c4d7dbf75e5ad3b9623739b647f`, confirmed this exact failure with
Supabase CLI `2.113.0`. The report recorded `productionConnectivityUsed=false`,
`productionCredentialsUsed=false`, `projectLinkUsed=false`, migration
`20260712153351_2b072552-53fa-42d9-a145-a69d792938cd.sql`, class `duplicate_object`, and affected
object `app_role`. The public-safe artifact upload succeeded; candidate types and a schema
fingerprint were correctly not generated.

Local execution remains unavailable because the host Docker engine cannot start while
WSL2/virtualization is disabled. The workflow did not suppress or repair the migration error.

## Third-pass reconstruction result

The owner-approved byte-for-byte archive of the 11 pure replay bundles is commit
`fbc36a396da7b1d3d281bb58ec39efebb0b9f5b3`. GitHub Actions Database Reconstruction run
[`31264515142`](https://github.com/GroupToStay/GroupToStay/actions/runs/31264515142) then applied the
complete remaining executable chain successfully with Supabase CLI `2.113.0`. The report recorded
`productionConnectivityUsed=false`, `productionCredentialsUsed=false`, `projectLinkUsed=false`,
`status=succeeded`, `exitCode=0`, `firstFailure=null`, schema dump SHA-256
`77388cd8a30036c6148cfd764d7dba1b1e90031cf360d92ef2ac3340c90557de`, and successful candidate
type generation.

This proves executable ordering, not approved schema parity. The four mixed July 12 migrations still
produce policy/ACL differences from Production. Their object-level evidence is in
`july-12-unique-effects.json`; active-account intent remains an owner decision.

The upgraded postcondition gate in run
[`31265405078`](https://github.com/GroupToStay/GroupToStay/actions/runs/31265405078) proved that all
1,583 reconstructed cities exist but their generated UUIDs and canonical label checksum were not
portable across a clean database. The clean-run checksum was
`6d8c0f331248746fec6f6369a370daafd3617e379a6b9743c0a1d79aabff694a`, not the approved
`eebc37b6132a04a96cdb9756b0ff6fa823a46bd96c05e76e8eb4b20effd41b9a`. The executable migrations
therefore did not reproduce the approved localization state. The single generated migration
`20260808190000_canonical_database_reconciliation.sql` now loads the canonical snapshot into a
temporary table and resolves each live country UUID through the separately captured 76-row
Production UUID-to-ISO-code map. It addresses a city by the stable unique key
`(country.code, city.name_en)`, updates only differing Arabic labels, and verifies the result. The
Production city and country UUIDs remain snapshot provenance; they are not fabricated as clean-run
identifiers. The migration has not been executed against Production.

## Blocker inventory

The 11 files from `20260712153351` through `20260712154229` are archived under
`supabase/migration-archive/2026-07-12-replays/` with exact hashes. The four later July 12 files are
unique or partially unique, but live policy evidence proves several effects are absent or
superseded. Their per-effect disposition is in `july-12-unique-effects.json`.

## Canonical migration strategy

1. Preserve the 56 shifted Lovable filenames and use `migration-provenance.json` as the canonical repository-to-ledger mapping. No rename is proposed now.
2. Keep the 11 pure July 12 replay bundles byte-for-byte in the non-executable archive with its enforced hash manifest.
3. Decide the four unique July 12 files separately. Preserve the least-privilege ACL effect, do not recreate policies absent from the approved live baseline, and use a new additive migration for any approved surviving effect.
4. Keep the July 14 and July 26 historical files immutable. Their missing ledger rows are a separate provenance issue, not permission to replay Production.
5. Keep the exact restored global migration in executable history for zero-to-current reconstruction. Never execute it against the already-matching Production database.
6. Once the chain reconstructs, generate a normalized catalog fingerprint, candidate types, and behavioral trigger/RLS tests.
7. Only then draft an additive reconciliation migration and any ledger-only repair package. Neither is authorized by this pass.

## Candidate generated types

Generated as a short-lived public-safe workflow artifact after clean reconstruction. The permanent
gate now records an exact type diff and structured table/view/function/enum member changes without
overwriting `src/integrations/supabase/types.ts`. `profiles.city_name` and
`rfq_lifecycle_events` are explicitly asserted in the candidate report. Final replacement remains
deferred until the canonical schema decisions are approved.

## Permanent CI drift gate

After the canonical chain is approved, promote the diagnostic workflow into a required PR gate:

1. reconstruct an empty local Supabase database with a pinned CLI/image set;
2. run database lint and isolated behavioral/RLS tests;
3. export a deterministic catalog manifest for types, columns, constraints, indexes, functions, triggers, policies, grants, extensions, and storage policy metadata;
4. compare its SHA-256 fingerprint with a reviewed repository snapshot;
5. generate TypeScript types locally and compare them with the committed generated types;
6. fail on any migration, catalog, security, or type diff;
7. upload only sanitized local artifacts and destroy the stack.

Routine PR validation requires no Production connectivity. A future live-drift job, if approved, must be a separate protected workflow with a dedicated read-only role and environment approval.
