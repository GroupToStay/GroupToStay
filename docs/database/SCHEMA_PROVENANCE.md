# Schema Provenance

## Trust chain

The approved database trust chain is:

1. immutable, ordered SQL migrations in the repository;
2. a clean, disposable Supabase reconstruction;
3. a normalized catalog manifest containing object definitions, privileges, RLS, and stable hashes;
4. generated TypeScript types produced from that reconstructed schema;
5. a read-only comparison to the approved Production project;
6. an explicitly approved, additive deployment or narrowly scoped ledger repair.

Production is not a migration-development environment. A missing ledger row is not evidence that
its SQL should be replayed.

## Baseline provenance

- Git baseline: `7918ea532eeeba809357a05db07117dc4aeb103a`
- Supabase project reference: `atxecflhmphaqqkatjlm`
- Audit date: 2026-08-08
- Repository migration files: 81 after exact ledger-sourced global restoration and the guarded reconciliation candidate
- Executable migration files: 70 after the approved archive of 11 pure replay bundles
- Production ledger rows: 60
- Exact stored-statement matches under shifted Lovable versions: 56
- Production writes during audit: 0

No credentials, connection strings, JWTs, keys, data rows, or user-identifying values belong in
this document or in a catalog manifest.

## Migration creation rules

- Use a unique UTC timestamp and a descriptive snake-case suffix.
- Never edit SQL already applied to a shared or Production environment.
- Prefer additive changes and guards that fail when safety assumptions are false.
- Do not use `DROP`, `TRUNCATE`, destructive type rewrites, or bulk data replacement without an
  approved data-preservation and rollback plan.
- Define RLS and grants in the same migration as a sensitive table.
- Revoke direct execution of internal trigger functions.
- Harden every `SECURITY DEFINER` function with an explicit `search_path` and least-privilege grants.
- Record deterministic verification queries and expected catalog hashes.
- Regenerate generated types only from the approved, fully reconstructed schema.
- Never insert a ledger row merely to silence the migration tool. Physical equality must be proven.
- Never place database credentials or service-role keys in frontend workflows or build metadata.

## Ledger repair evidence

Before a Production ledger write, the change request must include:

- exact version and name;
- repository SQL hash;
- matching live object hashes and normalized definitions;
- proof that all data and security effects already exist;
- explanation of why replay is unsafe;
- the exact ledger operation;
- verification queries;
- recovery steps for an incorrect ledger entry.

Ledger repair changes provenance only. It must not be used where the physical schema is partial,
superseded, or definitionally different.

## Proposed drift check

The CI-compatible design uses an ephemeral Supabase stack and no Production credentials:

1. start the pinned Supabase CLI/container versions on an isolated CI runner;
2. apply only the approved migration chain to a blank database;
3. run `supabase db lint` and fail on migration errors;
4. dump normalized public/auth-trigger/storage-policy catalog manifests;
5. generate TypeScript types from the ephemeral database;
6. compare the manifest and types against tracked snapshots;
7. run focused RLS tests using disposable users/data;
8. destroy the ephemeral stack.

The frontend build workflow must not receive a database password or service-role credential.
Live Production drift, if later automated, belongs in a separate protected workflow using an
environment-scoped read-only database role, explicit approval, masked output, and no pull-request
execution from forks.

The owner-approved workflow is now present at `.github/workflows/database-reconstruction.yml` and
pins Supabase CLI `2.113.0`. It creates a temporary copy of `supabase/`, replaces the local Docker
project ID, refuses remote database/project environment variables, invokes only `supabase db start`,
records the first failing migration/error class/object, sanitizes public artifacts, and tears down
the local stack. It does not use `supabase link`, Production credentials, customer data, or Vercel
secrets. Candidate types and a normalized schema fingerprint are emitted only if clean
reconstruction succeeds.

The snapshot is canonical for the currently approved live state. The original historical translation provenance is unknown.

The reconstruction gate validates the canonical 1,583-row live snapshot and its immutable checksum
`eebc37b6132a04a96cdb9756b0ff6fa823a46bd96c05e76e8eb4b20effd41b9a`. Because the historical
migrations generated country and city UUIDs at execution time, clean-run parity is evaluated by
the stable semantic key `(country.code, city.name_en)` and `name_ar`, using the separately captured
Production country-ID mapping. It also emits a
category-level catalog fingerprint for relations, columns, constraints, indexes, enums, functions,
triggers, policies, table/column/routine grants, and extensions.
The reviewed clean-reconstruction fingerprint is pinned at
`supabase/tests/expected-candidate-catalog-fingerprint.json`; changing schema without updating that
reviewed evidence fails the isolated workflow. The Production comparison and unresolved drift
classifications are recorded separately in `docs/database/catalog-fingerprint-comparison.json`.

## Future release gate

A database change is releasable only when:

- clean reconstruction passes;
- catalog drift is intentional and documented;
- generated types have no unexplained diff;
- migration lint and RLS tests pass;
- the target ledger transition is known in advance;
- a read-only preflight validates assumptions;
- the owner explicitly approves every Production write.
