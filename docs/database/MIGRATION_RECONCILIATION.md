# Migration Reconciliation

## Audit conclusion

Production must not receive a migration replay or ledger repair in the first pass. The repository
and live database share most object effects, but their provenance is split across shifted Lovable
versions, replay/import files, missing ledger rows, one ledger-only migration, manual hotfixes, and
untracked reference-data localization.

## Drift classification summary

| Class                                               |                        Count / scope | Finding                                                                                                                     |
| --------------------------------------------------- | -----------------------------------: | --------------------------------------------------------------------------------------------------------------------------- |
| A. Exact match                                      |                        3 ledger rows | July 27 enterprise/admin, July 27 grant hardening, July 28 verification editability                                         |
| B. Legacy Lovable import / expected timestamp drift |           56 ledger/repository pairs | Stored statement hashes exactly match; filename versions differ by 2-7 seconds                                              |
| C. Migration file exists, ledger entry missing      |                             20 files | 15 July 12 files plus July 2 (2), named July 4, July 14, and July 26                                                        |
| D. Ledger entry exists, file missing                |                                    1 | `20260729180000_global_country_city_experience`                                                                             |
| E. Schema applied manually                          |               Multiple object groups | Named hardening/lifecycle objects and reference-data localization are physically present without complete ledger provenance |
| F. Partial application                              | July 12 unique hardening and July 14 | Some policies/grants differ or are superseded; object names alone are not ledger-repair evidence                            |
| G. Unknown / requires investigation                 | Localization and environment history | No source migration or ledger row for the August localization operation                                                     |
| H. Unsafe drift                                     | Migration chain and duplicate guards | July 12 replay bundles, duplicate semantic triggers, and active lifecycle data make blind replay unsafe                     |

No item is classified as safe for an immediate Production write.

## Complete live ledger order

Empty names below are how the legacy rows are stored. Class B rows were matched by normalized
stored-statement MD5, not by timestamp proximity alone.

| Order | Version          | Name                                                  | Class |
| ----: | ---------------- | ----------------------------------------------------- | ----- |
|     1 | `20260613080914` | _(empty)_                                             | B     |
|     2 | `20260613081052` | _(empty)_                                             | B     |
|     3 | `20260613081409` | _(empty)_                                             | B     |
|     4 | `20260614071334` | _(empty)_                                             | B     |
|     5 | `20260614071415` | _(empty)_                                             | B     |
|     6 | `20260614072158` | _(empty)_                                             | B     |
|     7 | `20260615070804` | _(empty)_                                             | B     |
|     8 | `20260615070959` | _(empty)_                                             | B     |
|     9 | `20260615080418` | _(empty)_                                             | B     |
|    10 | `20260615080509` | _(empty)_                                             | B     |
|    11 | `20260615114233` | _(empty)_                                             | B     |
|    12 | `20260615114316` | _(empty)_                                             | B     |
|    13 | `20260615131018` | _(empty)_                                             | B     |
|    14 | `20260615150907` | _(empty)_                                             | B     |
|    15 | `20260615164116` | _(empty)_                                             | B     |
|    16 | `20260615174148` | _(empty)_                                             | B     |
|    17 | `20260615233026` | _(empty)_                                             | B     |
|    18 | `20260615233146` | _(empty)_                                             | B     |
|    19 | `20260616114824` | _(empty)_                                             | B     |
|    20 | `20260617174039` | _(empty)_                                             | B     |
|    21 | `20260619154304` | _(empty)_                                             | B     |
|    22 | `20260619154744` | _(empty)_                                             | B     |
|    23 | `20260619155929` | _(empty)_                                             | B     |
|    24 | `20260619181151` | _(empty)_                                             | B     |
|    25 | `20260619181446` | _(empty)_                                             | B     |
|    26 | `20260619181537` | _(empty)_                                             | B     |
|    27 | `20260619182551` | _(empty)_                                             | B     |
|    28 | `20260620075125` | _(empty)_                                             | B     |
|    29 | `20260620161145` | _(empty)_                                             | B     |
|    30 | `20260620161404` | _(empty)_                                             | B     |
|    31 | `20260620192749` | _(empty)_                                             | B     |
|    32 | `20260620192840` | _(empty)_                                             | B     |
|    33 | `20260621114942` | _(empty)_                                             | B     |
|    34 | `20260621115139` | _(empty)_                                             | B     |
|    35 | `20260622145759` | _(empty)_                                             | B     |
|    36 | `20260622155954` | _(empty)_                                             | B     |
|    37 | `20260622161401` | _(empty)_                                             | B     |
|    38 | `20260623074759` | _(empty)_                                             | B     |
|    39 | `20260624075623` | _(empty)_                                             | B     |
|    40 | `20260625080351` | _(empty)_                                             | B     |
|    41 | `20260701085817` | _(empty)_                                             | B     |
|    42 | `20260701113953` | _(empty)_                                             | B     |
|    43 | `20260701114125` | _(empty)_                                             | B     |
|    44 | `20260701154023` | _(empty)_                                             | B     |
|    45 | `20260701154147` | _(empty)_                                             | B     |
|    46 | `20260701155151` | _(empty)_                                             | B     |
|    47 | `20260701155743` | _(empty)_                                             | B     |
|    48 | `20260704143736` | `20260704143733_5c02d2c2-e22e-4a8b-9543-ead2f7f54c84` | B     |
|    49 | `20260706081635` | `20260706081631_a29f3cfc-c9fb-4002-98ba-7735e32ec542` | B     |
|    50 | `20260706105614` | `20260706105611_c077ad47-da4b-4e85-952d-e2a759607d4f` | B     |
|    51 | `20260706105816` | `20260706105813_29a88dc5-ca66-47dc-a836-dc47b777665b` | B     |
|    52 | `20260706115924` | `20260706115922_8e24edae-c8a7-4e81-98a5-72b8fcd08c7b` | B     |
|    53 | `20260706143817` | `20260706143812_d76039d2-1935-425d-9134-8b175dd8be37` | B     |
|    54 | `20260708095336` | `20260708095333_2ebbdc2f-313e-4a6c-8739-4cd0914b0e1e` | B     |
|    55 | `20260708102155` | `20260708102152_bdc908b9-b224-4ce0-97ce-ce0047f2fed0` | B     |
|    56 | `20260708103403` | `20260708103400_cc4240b5-2271-49ac-8ddd-0472db21c7c9` | B     |
|    57 | `20260727120000` | `enterprise_admin_approval_center`                    | A     |
|    58 | `20260727123000` | `harden_enterprise_admin_grants`                      | A     |
|    59 | `20260728153000` | `fix_company_verification_editability`                | A     |
|    60 | `20260729180000` | `global_country_city_experience`                      | D/E   |

## Expected versus live schema

Static final-object reconstruction finds the same public table names, 57 public function names,
56 public trigger names, and the `auth.users` profile trigger in the repository and Production.
Definition hashes show that name equality is not full parity:

- 50 of 57 public function bodies match the last tracked definition after CRLF normalization.
- Three mismatches are exactly explained by the missing global migration:
  `restrict_profile_company_fields`, `validate_agency_verification_submission`, and
  `validate_rfq_row`. Each current `prosrc` occurs verbatim in the stored global migration payload.
- Four mismatches lack a complete tracked provenance chain:
  `is_agency_rfq_eligible`, `record_rfq_lifecycle_event`,
  `require_verified_agency_for_rfq`, and `update_updated_at_column`.
- Four pairs of differently named live triggers invoke the same guard on the same table:
  - `restrict_organizer_booking_updates_trg` and `trg_restrict_organizer_booking_updates`;
  - `trg_require_verified_agency_conversation` and
    `trg_require_verified_agency_for_conversation`;
  - `trg_require_verified_agency_rfq` and `trg_require_verified_agency_for_rfq`;
  - `validate_rfq_row_trg` and `trg_validate_rfq_row`.

The duplicate triggers are also produced by the tracked replay history. They are not safe to remove
without confirming side effects and error ordering, but they are not a clean baseline.

## Known drift analysis

### `20260729180000_global_country_city_experience`

- Repository: missing.
- Ledger: row present, one 65,345-character statement payload; normalized MD5
  `4b32d7e3fc9af63cd2417ee321e930cc`.
- Live schema: nullable `profiles.city_name` plus
  `profiles_city_name_length_check`; the three function bodies named above exactly match the ledger
  payload. Cities were also seeded/updated.
- Data: no current profile uses `city_name`.
- Classification: D/E.
- Proposed action: repository-only restoration of the exact ledger payload after owner approval;
  never replay it in Production.

### `20260801170000_complete_city_arabic_localization`

- Repository: missing.
- Ledger: missing.
- Live data: 1,583/1,583 cities and 76/76 countries have nonblank, non-English-equal Arabic labels.
- Classification: E/G; data-only manual change is the leading inference.
- Proposed action: capture an approved deterministic reference-data snapshot and an idempotent new
  reconciliation migration or seed strategy. Do not fabricate a historical ledger row.

### `profiles.city_name`

- Repository migrations/types: absent.
- Live: nullable text, 2-100 trimmed-character check, zero non-null rows.
- Provenance: exact global-ledger evidence.
- Proposed action: restore the missing migration source, then regenerate types.

### Generated types

- Missing `profiles.city_name`.
- Missing the whole `rfq_lifecycle_events` table despite eight live rows.
- Enums and other observed table/view names match.
- Proposed action: generated-types-only correction after the schema baseline is approved.

### July 12 migrations

- Ledger: all 15 rows missing.
- First 11: 98.8-100% non-comment-line overlap with earlier tracked migrations; contain unguarded
  create and replacement statements; unsafe replay/import artifacts.
- Last four: unique grant/policy hardening. Production does not contain the seven `Active accounts
only on ...` restrictive policies, and the internal
  `prevent_non_admin_account_status_change` trigger function remains executable by
  `authenticated`. Later trigger-based enforcement partly supersedes the policy approach.
- Proposed action: owner decision to quarantine all replay files outside the executable migration
  directory, then express approved remaining hardening in a new additive migration.

### July 14 blocker migration

- Ledger: missing.
- Live: `rfq_lifecycle_events`, its triggers, and active rows exist.
- Definitions: most artifacts exist, but three relevant function bodies do not equal the tracked
  final definitions.
- Classification: C/E/F. Not eligible for ledger-only repair.
- Proposed action: select the approved live/repository semantics and create one additive
  canonicalization migration; preserve lifecycle rows.

### July 26 quote lifecycle migration

- Ledger: missing.
- Live: normalized bodies for `award_quote`, `enforce_quote_submission_eligibility`,
  `enforce_invitation_lifecycle`, `mark_invitation_quoted`,
  `restrict_organizer_quote_updates`, and `notify_organizer_on_quote_withdrawal` match the tracked
  definitions. Required triggers and the `viewed` enum state are present.
- Data: three awarded RFQs, three accepted quotes, and three bookings depend on this behavior.
- Classification: C/E; a possible ledger-repair candidate only after policy, grant, trigger, enum,
  and constraint hashes are packaged as exact evidence.
- Replay risk: would replace lifecycle functions/triggers and could reject or duplicate effects
  around active records.

### July 2 and named July 4 migrations

- Ledger: missing.
- Live: hotel directory functions/views/policies and admin-management policies exist, but later
  hardening and enterprise migrations supersede portions of their definitions.
- Classification: C/E/F.
- Proposed action: no historical replay and no ledger-only repair; resolve through repository
  history normalization and the final additive baseline migration if a definition differs.

### Enterprise/admin migrations

- Ledger: exact July 27 version/name rows; statement arrays are empty.
- Live: enterprise tables, grants, policies, functions, and trigger definitions are present.
  Reviewed function bodies match the tracked definitions after line-ending normalization.
- Security: all `SECURITY DEFINER` functions have explicit `search_path`; anonymous execute is zero.
- Proposed action: no schema action. Preserve rows and document the empty-payload legacy exception.

### Company verification functions

- July 28 ledger row exists.
- The later global migration changed `restrict_profile_company_fields` and
  `validate_agency_verification_submission`; current live bodies exactly match the global payload.
- The validation and lock triggers are present. Two profiles are verified and eight are draft.
- Proposed action: restore global source; no replay.

### RLS and manual hotfixes

- Every public table has RLS enabled.
- No public-table policy targets `anon`; no sensitive `SELECT` policy has an unconditional `true`
  predicate.
- The single anonymous storage policy is restrictive and grants nothing.
- Policy drift remains around the absent July 12 active-account policies and superseding
  trigger-based enforcement. This is security debt requiring an explicit architecture decision,
  not a reason to broaden access.

## Proposed reconciliation plan

No step below is authorized for Production by this document.

1. **Repository-only correction:** rename the 56 content-identical migration files to their actual
   Production ledger versions, preserving SQL bytes. Produce an old-to-new map and verify no
   relevant non-Production environment relies on the repository timestamps.
2. **Requires owner decision:** move the 11 July 12 replay/import bundles out of the executable
   migration directory. Decide separately whether the four unique July 12 hardening files are
   quarantined and replaced by a current additive migration.
3. **Repository-only correction:** restore
   `20260729180000_global_country_city_experience.sql` from the exact ledger payload and verify its
   payload hash. This is source restoration, not a Production execution.
4. **Requires owner decision:** choose the canonical semantics for the four unexplained function
   mismatches and the four duplicate-trigger pairs. Default recommendation: preserve proven live
   behavior, remove duplicates only in a new guarded migration, and add verification assertions.
5. **Additive corrective migration:** after decisions 2 and 4, create one non-destructive migration
   that canonicalizes only approved function, trigger, policy, grant, and reference-data drift.
   It must fail if definitions/data assumptions do not match the audit hashes.
6. **Ledger reconciliation:** consider `20260726130000` only after its complete object manifest is
   proven equal. Do not repair July 2, July 4, July 12, or July 14 ledger rows while definitions are
   partial/superseded.
7. **Generated-types-only correction:** regenerate from a clean approved reconstruction, then
   review the `city_name` and `rfq_lifecycle_events` additions manually.
8. **Documentation-only:** preserve the legacy timestamp map, empty-statement ledger exception, and
   reference-data hashes.
9. **CI:** add the ephemeral Supabase drift workflow described in `SCHEMA_PROVENANCE.md` only after
   the executable migration chain is repaired and an owner approves the workflow change.
10. Run a read-only Production preflight, obtain explicit owner approval for the exact SQL/ledger
    writes, execute one category at a time, and verify hashes after each category.

## Ledger repairs proposed

No ledger write is proposed for immediate execution.

The only current candidate is `20260726130000_v2_1_rc1_quote_lifecycle`. Before approval it still
needs a signed evidence package covering every function, trigger, enum, grant, policy, and
constraint changed by that file. If equality is proven, the intended correction would add exactly
version `20260726130000` and name `v2_1_rc1_quote_lifecycle` without executing its SQL. Recovery
would remove only that newly inserted ledger row after re-verifying no schema operation occurred.

The 56 shifted versions should be reconciled by repository filename correction, not duplicate
Production ledger rows. The global row should be reconciled by restoring its repository file.

## Corrective migrations proposed

One future additive reconciliation migration is preferred over replaying historical files. Its
approved scope may include:

- canonical definitions for the four unexplained function mismatches;
- guarded removal of duplicate semantic triggers;
- least-privilege correction for direct trigger-function execution;
- the owner-selected active-account enforcement model;
- deterministic localization reference-data reconciliation;
- verification blocks that compare expected object/data hashes before changing anything.

It must not drop tables, truncate data, change IDs/ownership, weaken RLS, or rewrite historical
migrations. It must not be applied without a separate owner approval containing the exact SQL.

## Current gate

- GO for repository documentation and further isolated verification: **YES**
- GO for Production ledger/schema/RLS/data writes: **NO**
- Ready to implement owner-approved reconciliation changes: **NO, pending the decisions above**
