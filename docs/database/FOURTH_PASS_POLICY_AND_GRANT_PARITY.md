# Fourth-Pass Policy and Grant Parity

- Audit date: 2026-08-08
- Production project: `atxecflhmphaqqkatjlm`
- Production access: existing read-only catalog evidence only
- Production writes: none

## Canonical decision

Current Production authorization behavior is the baseline contract. The canonical executable
chain does not replay the eight owner-rejected July 12 policy changes or the deferred direct
`EXECUTE` revocation. This removes historical drift from the candidate while preserving the
approved behavior represented by the normal migration history.

## Candidate fingerprint after final July 12 disposition

| Category                                                  |           Candidate | Production snapshot | Decision                                                                                                                                                                           |
| --------------------------------------------------------- | ------------------: | ------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policies                                                  |                 150 |                 148 | Two policy objects remain unexplained by the historical aggregate snapshot; no policy is added or removed without object-level Production evidence.                                |
| Routine grants                                            |                  76 |                 133 | Local-stack/role-owner grant expansion remains an environment and provenance difference. The deferred trigger-function revoke was intentionally removed from the executable chain. |
| Column grants                                             |               4,892 |               5,847 | Environment/role-owner grant expansion; no application table or column change in this pass.                                                                                        |
| Table grants                                              |                 821 |                 945 | Environment/role-owner grant expansion; no application table or column change in this pass.                                                                                        |
| Functions                                                 |                  57 |                  57 | Semantic function definitions were previously reviewed; remaining aggregate fingerprint delta is tracked as ACL/formatting provenance.                                             |
| Relations, columns, constraints, indexes, enums, triggers | exact object counts | exact object counts | No new fourth-pass drift.                                                                                                                                                          |

## Object-level decisions for the archived effects

| Table / function                                                                            | Candidate decision                                | Production decision                                | Security impact                                            |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| `public.rfqs`, `quotes`, `bookings`, `messages`, `chat_messages`, `conversations`, `hotels` | No July 12 restrictive active-account policy      | No corresponding Production policy                 | Preserves current trigger-only account-status enforcement. |
| `public.profiles`                                                                           | Later company-verification owner policy remains   | Production-equivalent later policy is the baseline | Does not reopen reviewer-controlled fields.                |
| `public.conversations`                                                                      | Existing participant read-tracking policy remains | Production baseline retains it                     | Does not relax conversation updates.                       |
| `public.agency_verification_events`                                                         | Original owner insert policy remains              | Production retains it                              | Does not introduce an absent admin/actor-id policy.        |
| `public.prevent_non_admin_account_status_change()`                                          | Current direct execute grant remains              | Production grant remains                           | Deferred least-privilege hardening; no ACL change.         |

## Fresh evidence resolution

The required read-only object export was completed on 2026-08-08. The two candidate-only policies
are `Admin updates all RFQs` and `Admin deletes all RFQs`; Production has no candidate-missing
policy and no shared-policy semantic difference. Grant differences are now separated into
application-role ACL drift, Supabase-managed defaults, local Storage-stack differences, and one
canonical trigger-function ACL reconstruction gap.

See `FINAL_PRODUCTION_RECONCILIATION_EVIDENCE.md`, `policy-diff-current.json`,
`grant-diff-current.json`, and `function-acl-diff-current.json`. No Production object was changed.
