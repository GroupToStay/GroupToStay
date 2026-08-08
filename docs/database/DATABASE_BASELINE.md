# Database Baseline

## Identity and scope

- Reconciliation date: 2026-08-08
- Git baseline: `7918ea532eeeba809357a05db07117dc4aeb103a`
- Branch: `chore/v3-pr2-database-reconciliation`
- Supabase project reference: `atxecflhmphaqqkatjlm`
- Production access mode: catalog and aggregate `SELECT` only
- Production writes performed: none

This baseline is an audit snapshot, not authorization to repair the Production ledger, schema,
policies, functions, triggers, storage configuration, or data.

## Repository history

The starting baseline contained 79 SQL files in `supabase/migrations`. The owner-approved,
repository-only restoration of `20260729180000_global_country_city_experience.sql` brings the
candidate chain to 80 files. There are no duplicate filename versions. The complete per-file
inventory is in [MIGRATION_INVENTORY.md](./MIGRATION_INVENTORY.md).

The repository migration chain is not currently replayable as a clean history:

- 56 tracked files have exact statement-hash matches in Production under legacy Lovable versions
  that differ from their filenames by two to seven seconds.
- 11 files dated 2026-07-12 are replay/import bundles. Static non-comment line overlap against the
  earlier tracked history is 98.8% to 100%, and they contain unguarded `CREATE TYPE`, `CREATE TABLE`,
  policy, trigger, and function statements. Replaying them after the earlier files is unsafe.
- Four later July 12 files contain unique hardening changes but have no ledger rows and are only
  partially represented in the live schema.
- Five named files outside July 12 have no ledger row: the two July 2 files, the named July 4
  hardening file, the July 14 blocker fix, and the July 26 quote lifecycle migration.
- `20260729180000_global_country_city_experience` has now been restored to the repository from the
  exact trusted ledger SQL payload. Its normalized SHA-256 matches the ledger; it has not been
  executed against Production.
- No tracked or ledger migration exists for the known
  `20260801170000_complete_city_arabic_localization` operation. The approved live city labels are
  now captured as deterministic reference data, not asserted to be the missing historical source.

## Production migration ledger

The live ledger has 60 rows:

- 56 legacy timestamp-drift rows whose stored SQL hashes exactly match tracked files.
- Three exact version/name rows: `20260727120000`, `20260727123000`, and `20260728153000`.
  Their ledger statement arrays are empty, so the physical catalog—not the ledger payload—is the
  definition evidence.
- One formerly ledger-only row, `20260729180000_global_country_city_experience`, with one stored
  statement payload. The restored repository file and ledger payload share normalized SHA-256
  `0b37a1ed8a8bd402696b1618959160852f651bd6b68abb8f7125d01c06cff6f9`.

The full execution order and classification are recorded in
[MIGRATION_RECONCILIATION.md](./MIGRATION_RECONCILIATION.md).

## Physical Production catalog

Read-only catalog hashes make this snapshot comparable without storing definitions or data:

| Category                        | Count | Stable audit hash / note                                                       |
| ------------------------------- | ----: | ------------------------------------------------------------------------------ |
| Public tables                   |    31 | All have RLS enabled                                                           |
| Public views                    |     3 | `agencies_public`, `hotels_public`, `unmapped_locations`; all security-invoker |
| Public columns, including views |   357 | `dcfd6fa6291b764272037853d0bae58c`                                             |
| Public constraints              |   111 | `37f3eb8dd90d60d6b474f3bb5224674d`                                             |
| Public foreign keys             |    51 | Zero unvalidated                                                               |
| Public check constraints        |    16 | Zero unvalidated                                                               |
| Public indexes                  |    74 | `8e7016c18880d74528132b497ccb2102`                                             |
| Public functions/procedures     |    57 | `8063d9a8eb5e4dd3eb88ab03308cda3a` over definitions/configuration              |
| Public non-internal triggers    |    56 | `3c15bb5f5a80d09df8bacb6de979db60`                                             |
| Auth profile trigger            |     1 | `auth.users.on_auth_user_created` -> `public.handle_new_user`                  |
| RLS policies                    |   148 | `42edc65b68ca60fbfdf297ee54313daa`                                             |
| Public-table policies           |   129 | No policy is assigned to `anon`                                                |
| Storage object policies         |    19 | `51b01c03bb0ceb60403d7c39775e4f0d`                                             |
| Public enums                    |    12 | Values match the tracked generated enum types                                  |
| Public views                    |     3 | Definition hashes captured in the reconciliation report                        |
| Extensions                      |     5 | `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`     |

All 55 `SECURITY DEFINER` functions have an explicit `search_path`. No public or anonymous role has
direct execute privilege on a public function. Nineteen functions are executable by
`authenticated`. One of those is an internal trigger function; direct execution cannot invoke a
PostgreSQL trigger function, but the grant is still provenance/security debt.

The sole storage policy assigned to `anon`, `agency_docs_no_anon`, is `RESTRICTIVE`, not
permissive. It does not grant writes. There is no anonymous public-table policy and no broad
`true` sensitive-table `SELECT` policy.

## Data safety snapshot

Only aggregate counts and integrity checks were read:

| Object               | Rows |
| -------------------- | ---: |
| profiles             |   10 |
| hotels               |    1 |
| rfqs                 |    4 |
| rfq_invitations      |    3 |
| quotes               |    3 |
| bookings             |    3 |
| conversations        |    3 |
| messages             |    0 |
| chat_messages        |    5 |
| notifications        |   11 |
| rfq_lifecycle_events |    8 |
| admin_audit_logs     |    3 |

Three RFQs are awarded and three quotes are accepted. This active lifecycle data makes replay of
quote/award migrations unsafe. There are no orphaned profile country/city references or RFQ city
references, and all 51 foreign keys are validated.

Production has 1,583 cities and 76 countries. Every row has a nonblank Arabic label and no Arabic
label equals its English label. The read-only reference-data hashes are:

- Cities: `58ae5b9aac034ab0d3848f8c5ecf2b46`
- Countries: `4c794bd1c46f761a319e00e579868fbf`

The deterministic city reference snapshot contains all 1,583 rows ordered by city ID. Its
quoted-content-preserving canonical row SHA-256 is
`eebc37b6132a04a96cdb9756b0ff6fa823a46bd96c05e76e8eb4b20effd41b9a`.

`profiles.city_name` exists with its length check, but all ten current rows are null in that column.

## Generated types

`src/integrations/supabase/types.ts` is stale. It omits:

- the live `public.rfq_lifecycle_events` table, which has eight rows;
- the live nullable `public.profiles.city_name` column and its generated Row/Insert/Update fields.

The 12 enum definitions and the other observed public table/view names match. Types must not be
regenerated until the owner approves the canonical physical schema and reconciliation strategy.

## Repository security review

The tracked-file scan found no private key, GitHub/Vercel token, database password, JWT secret,
PostgreSQL connection URI, service-role credential, or private API credential. Pattern matches in
the server client, test documentation, and provenance tests are variable names and negative-test
assertions, not credential values. `.env.example` is the only tracked environment file; the root
`.env` is absent. No temporary OIDC/credential file is tracked.

## Reconstruction status

A full disposable Supabase reconstruction was attempted locally but could not start because the
host has Docker Desktop without an operational engine: WSL2/virtualization is disabled. No local
database was created and Production was not used as a reconstruction target. An owner-approved
GitHub Actions workflow now defines an isolated `supabase db start` reconstruction using pinned
Supabase CLI `2.113.0`, no project link, and no Production credentials.

Static reconstruction proves the tracked final object-name set contains the 57 observed public
functions and the 56 observed public triggers plus the `auth.users` profile trigger. It does not
prove that the full 80-file candidate chain can execute; the July 12 replay bundles prove the
opposite.
Full definition-level expected-schema certification therefore remains pending an isolated
Supabase-capable runner.

## Baseline decision

This snapshot is sufficient to reject blind replay and to propose an owner-gated repair plan. It
is not sufficient to authorize Production reconciliation writes.
