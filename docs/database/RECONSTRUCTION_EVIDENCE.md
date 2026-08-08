# Reconstruction Evidence and Canonical Strategy

- Audit date: 2026-08-08
- Baseline: `7918ea532eeeba809357a05db07117dc4aeb103a`
- Candidate migration count: 80
- Production writes: none

## Ephemeral workflow

`.github/workflows/database-reconstruction.yml` runs on a GitHub-hosted Ubuntu runner with Supabase CLI `2.113.0`. The runner uses Docker only for an empty local Supabase database. The repository `supabase/` directory is copied to a temporary work directory and its local Docker project ID is replaced with `grouptostay_reconstruction`.

The runner refuses `DATABASE_URL`, `POSTGRES_URL`, `PGHOST`, `PGPASSWORD`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and `SUPABASE_PROJECT_REF`. It never calls `supabase link`, `db push`, `migration repair`, or any remote command. Logs redact connection strings, JWT-shaped values, Supabase keys, and named secret/token/password values before artifact upload.

`supabase db start` applies the migration directory in filename order and stops on the first error. A JSON artifact records the migration filename, error class, affected object, exit code, CLI version, and proof that no project link or Production credential was used. Candidate types and a normalized `public,auth,storage` schema fingerprint are produced only after a successful reconstruction.

## Current first blocker

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

## Blocker inventory

The 11 files from `20260712153351` through `20260712154229` are pure replay/import bundles and will cause additional duplicate type/table/policy/trigger errors if the first error is bypassed. Bypassing them one at a time would not be valid reconstruction. The four later July 12 files are unique or partially unique, but live policy evidence proves several effects are absent or superseded. Their per-file disposition is in `JULY_12_QUARANTINE_PROPOSAL.md`.

## Canonical migration strategy

1. Preserve the 56 shifted Lovable filenames and use `migration-provenance.json` as the canonical repository-to-ledger mapping. No rename is proposed now.
2. After owner approval, move the 11 pure July 12 replay bundles byte-for-byte to a non-executable archive with a signed hash manifest.
3. Decide the four unique July 12 files separately. Preserve the least-privilege ACL effect, do not recreate policies absent from the approved live baseline, and use a new additive migration for any approved surviving effect.
4. Keep the July 14 and July 26 historical files immutable. Their missing ledger rows are a separate provenance issue, not permission to replay Production.
5. Keep the exact restored global migration in executable history for zero-to-current reconstruction. Never execute it against the already-matching Production database.
6. Once the chain reconstructs, generate a normalized catalog fingerprint, candidate types, and behavioral trigger/RLS tests.
7. Only then draft an additive reconciliation migration and any ledger-only repair package. Neither is authorized by this pass.

## Candidate generated types

Not generated. The clean chain does not yet reconstruct, so generating types from a partial schema would be misleading. The expected candidate diff still includes at least `profiles.city_name` and `rfq_lifecycle_events`.

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
