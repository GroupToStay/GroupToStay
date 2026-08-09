# Canonical Localization Production Dry Run

- Target project: `atxecflhmphaqqkatjlm`
- Access mode: read-only provenance comparison
- Production writes: none
- Canonical source: `supabase/reference-data/cities-arabic.json`
- Canonical resolved-row checksum: `a0763bccedb304a6e7c09ed3fa936f82e55d31a33d106fd995cc21a25b7984ae`

## Recorded Production comparison

The Production read-only baseline captured on 2026-08-08 recorded 1,583 city rows, no null or
blank Arabic labels, and semantic city localization equal to the approved canonical snapshot.
The fourth-pass isolated reconstruction independently reproduced the same 1,583 stable rows and
checksum. No localization source, reconciliation migration, country mapping, or city key changed
in this pass.

| Check                                                                                  | Result |
| -------------------------------------------------------------------------------------- | -----: |
| Matched canonical stable keys `(country.code, city.name_en)`                           |  1,583 |
| Differing Arabic labels in recorded Production baseline                                |      0 |
| Missing canonical stable keys                                                          |      0 |
| Ambiguous canonical stable keys                                                        |      0 |
| Expected `name_ar` updates from `20260808190000_canonical_database_reconciliation.sql` |      0 |
| Schema, RLS, Auth, or non-localization data effect                                     |      0 |

## Read-only rerun query

A future live rerun must use a read-only transaction and compare the same stable keys and Arabic
labels to the versioned snapshot. It must not execute the reconciliation migration or an `UPDATE`.
The expected result remains zero updates unless Production city data has changed after this
baseline capture.

## Decision

Localization remains deterministic and is a zero-diff candidate against the recorded Production
baseline. Production migration execution remains unauthorized.
