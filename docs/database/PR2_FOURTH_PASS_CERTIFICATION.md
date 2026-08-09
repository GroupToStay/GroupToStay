# GroupToStay V3 PR2 Repository Certification

- Branch: `chore/v3-pr2-database-reconciliation`
- Starting commit: `89f21863705137581a72c6596cdc5ac15afb49ea`
- Production project: `atxecflhmphaqqkatjlm`
- Production writes, migrations, RLS, ACL, trigger, ledger, data, and configuration changes: none

## Outcome

The repository has a deterministic 67-migration executable chain and a 15-file byte-preserved,
non-executable July 12 archive. The forward canonicalization migration removes only the two
candidate-only RFQ admin policies, after validating their exact historical definitions. Current
Production already lacks both policies, so future Production execution is expected to be an
object-level no-op.

## Evidence

| Evidence                      | Result                                                             |
| ----------------------------- | ------------------------------------------------------------------ |
| Executable migrations         | 67                                                                 |
| Archived July 12 files        | 15                                                                 |
| Clean reconstruction          | pass; no Production connection, credential, or project link        |
| Canonical policy count        | 148                                                                |
| Policy parity                 | 0 candidate-only; 0 Production-only; 0 semantic differences        |
| Candidate catalog fingerprint | `b0c215980d192222d19da193b98eff7cae41bb6b6a715f348d9bfc851d44cb5d` |
| Candidate schema fingerprint  | `7d13a27c750922f78e405e93a9c873d5459888e2f6c4ad94cc35db871f239e15` |
| Localization parity           | 1,583/1,583 stable rows; checksum match                            |
| Duplicate-trigger fixtures    | six before/after cases pass; cleanup remains deferred              |
| Generated types               | promoted; exact equality is blocking                               |

## Authorization boundary

Managed Supabase ACL differences are classified through an explicit grant baseline. The deferred
authenticated EXECUTE hardening, duplicate-trigger cleanup, July 26 ledger repair, active-account
redesign, and managed ACL normalization are not part of PR2.

## Production boundary

Production remains unchanged. Applying the forward migration and advancing the Production
migration ledger require separate owner approval after PR2 review.
