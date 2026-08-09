# Schema Provenance

## Trust chain

The canonical database trust chain is:

1. immutable ordered SQL under `supabase/migrations/`;
2. byte-preserved non-executable history under `supabase/migration-archive/`;
3. an empty isolated Supabase reconstruction;
4. normalized catalog and authorization exports;
5. deterministic reference-data checksums;
6. generated TypeScript types from the reconstructed schema;
7. read-only comparison with the approved Production project;
8. owner-approved Production execution, if separately required.

Production is never used as a migration-development or type-generation environment.

## Canonical identity

- Executable migration count: 67
- Archive count: 15
- Supabase CLI: `2.113.0`
- Schema SHA-256: `7d13a27c750922f78e405e93a9c873d5459888e2f6c4ad94cc35db871f239e15`
- Catalog SHA-256: `b0c215980d192222d19da193b98eff7cae41bb6b6a715f348d9bfc851d44cb5d`
- Generated types SHA-256:
  `eb680947c1337510b21a09b41f673556c15f1725aebcf506e40c64f3e4c769e1`
- Canonical policy count: 148

The final forward migration is
`20260809120000_canonicalize_production_authorization_baseline.sql`, normalized SHA-256
`f6a213c2529c41a3cec7151e8a5a7be7be073df42f9a7720a76dbff40d00c405`.

## Fingerprint boundaries

The canonical fingerprint includes relations, columns, constraints, indexes, enums, functions,
triggers, policies, RLS state, extensions, and application-semantic grants.

Application-semantic grants are `anon` and `authenticated` privileges on `public` relations,
columns, and routines. Storage, `service_role`, owner, extension, and hosted default differences
are excluded only through documented category rules and exact evidence hashes. The permanent rule
is defined in `GRANT_BASELINE_POLICY.md`.

## Reference-data provenance

Arabic city localization is versioned in `supabase/reference-data/cities-arabic.json`. Clean-run
parity uses `(country.code, city.name_en)` because historical seed migrations generated UUIDs at
execution time. The mapping is one-to-one, covers 1,583 rows, and has no missing or ambiguous keys.

## Generated-type invariant

CI enforces this blocking invariant:

`migrations -> empty schema -> generated types -> committed types -> exact byte equality`

The reconstruction artifact remains public-safe and contains no credentials or customer data.

## Migration rules

- Never rewrite an applied historical migration.
- Prefer one guarded forward migration over replay or silent ledger repair.
- Abort when object identity or semantics differ from reviewed evidence.
- Keep application changes separate from Supabase-managed environment defaults.
- Never infer physical equality from ledger identity alone.
- Require explicit owner approval for every Production write or ledger transition.

## Current Production relationship

Production already represents the approved object-level authorization state. The final forward
migration is required for fresh repository reconstruction, but is expected to be object-level
no-op on current Production. It has not been executed there.
