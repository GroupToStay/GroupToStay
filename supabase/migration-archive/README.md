# Supabase Migration Archive

Files below this directory are historical evidence, not executable Supabase migrations. Supabase CLI discovers migrations only from `supabase/migrations/`; archived SQL must never be copied into an automated migration run or executed against a database.

## 2026-07-12 replay bundles

The 11 files in `2026-07-12-replays/` were proved to be pure replay/import bundles: they repeat SQL effects already established by the earlier canonical migration history and fail a clean reconstruction at the first duplicated object. They were moved byte-for-byte from `supabase/migrations/` under the owner's third-pass authorization. They remain reviewable in Git and are mapped in `manifest.json`.

These files have no matching Production migration-ledger rows. Their Production relationship is historical import evidence only; archiving them does not change Production and must not be interpreted as a ledger repair.

The manifest records each original executable path, archive path, byte length, byte SHA-256, normalized SQL SHA-256, classification, and disposition. Archive integrity is enforced by automated tests.

## 2026-07-12 mixed policy history

The four files in `2026-07-12-mixed/` were individually classified in
`docs/database/JULY_12_MIXED_FINAL_DISPOSITION.md`. They are preserved byte-for-byte as
non-executable provenance. The owner selected current Production authorization behavior as the
canonical baseline: the active-account policies and verification-policy variants in these files
are not replayed, and the direct trigger-function execute revocation remains deferred security
hardening. Archiving this history makes the executable chain reproduce the approved baseline; it
does not alter any Production policy, grant, trigger, data, or migration ledger.
