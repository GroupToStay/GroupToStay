# July 12 Mixed Migration Final Disposition

- Decision date: 2026-08-08
- Canonical authorization baseline: current Production behavior
- Production project: `atxecflhmphaqqkatjlm`
- Production writes: none
- Archive: `supabase/migration-archive/2026-07-12-mixed/`

## Decision rule

The repository executable chain reproduces the owner-approved Production-equivalent baseline.
Historical policy or ACL behavior that is absent from Production is not introduced by
reconciliation. Historical SQL is retained byte-for-byte in the archive and is never executed by
the reconstruction runner or CI.

## `20260712154405_a69b7885-b229-4ac5-8b07-db3231d60df0.sql`

| SQL effect                                                                                          | Production comparison                                                                                | Final disposition                                                    |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Revoke `authenticated`, `anon`, and `PUBLIC` execute on `prevent_non_admin_account_status_change()` | Production retains `authenticated` and `service_role` execute; this is not a baseline-equivalent ACL | **Deferred Security Hardening**. Archived; no replacement migration. |

## `20260712154452_7cbb1cd9-e932-4819-b60f-4a4e9427c326.sql`

| SQL effect                                              | Production comparison                                              | Final disposition                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| Drop `Agency owner can insert own events`               | Production retains the original owner policy                       | **Obsolete**. Do not remove the canonical policy. |
| Create `Agency owner can insert submission events only` | Absent from Production and superseded by later historical variants | **Non-canonical**. Archived; no replacement.      |
| Create `Admins can insert all verification events`      | Absent from Production                                             | **Non-canonical**. Archived; no replacement.      |

## `20260712154548_ef620850-2e80-48ea-9c74-86f31fe6957d.sql`

| SQL effect                                                                                                                                    | Production comparison                                               | Final disposition                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Replace `Users update own profile` with reviewer-field checks                                                                                 | Superseded by the later company-verification editability policy     | **Superseded**. The later canonical policy remains executable.                                  |
| Create seven `Active accounts only on ...` restrictive policies on RFQs, quotes, bookings, messages, chat messages, conversations, and hotels | All seven are absent from Production                                | **Non-canonical historical security proposal**. Archived; current trigger-only guards remain.   |
| Replace `Participants can update read tracking`                                                                                               | Production retains the original stricter policy                     | **Unsafe/obsolete**. Archived; no relaxation is replayed.                                       |
| Drop/recreate `trg_restrict_conversation_participant_updates`                                                                                 | The target trigger is represented elsewhere in the executable chain | **Production-equivalent and already represented elsewhere**. No replacement migration required. |

## `20260712165650_a5408296-3f3a-43ae-83c6-1cc1a388cff0.sql`

| SQL effect                                                                       | Production comparison                                                        | Final disposition                                       |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| Replace agency submission-event policy with an `actor_id = auth.uid()` condition | This policy variant is absent from Production; original owner policy remains | **Superseded/non-canonical**. Archived; no replacement. |

## Archive integrity

All four files retain their original filename, byte length, byte SHA-256, normalized SQL SHA-256,
and provenance in `supabase/migration-archive/manifest.json`. They are outside
`supabase/migrations/`, so an empty isolated reconstruction executes none of them.

## Result

No SQL effect remains uniquely required for the approved canonical baseline. Therefore this pass
adds no guarded replacement migration for the four archived files.
