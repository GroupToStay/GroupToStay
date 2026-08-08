# Function Semantic Review

- Audit date: 2026-08-08
- Baseline: `7918ea532eeeba809357a05db07117dc4aeb103a`
- Production project: `atxecflhmphaqqkatjlm`
- Production writes: none

The raw `prosrc` hashes initially appeared to identify four unexplained differences. A quoted-content-aware token comparison now proves that all four live bodies have the same SQL token stream as the latest tracked body. The first three differ only because the live body is whitespace-compacted. `update_updated_at_column` is byte-identical after line-ending normalization. The machine-readable evidence is in `function-semantic-evidence.json`.

## `is_agency_rfq_eligible(uuid)`

- **Tracked definition hash:** `0f90eeb10966e500cba7553e3f4ecc54715e0ebfb5d064e92fd68e2fce5372ab`
- **Live definition hash:** `8ad5a8331fc38ec4b92745a69bffc95bfc581a62a0ecbb1e6b8c5e096f721867`
- **Semantic hash (both):** `6f55695e63457fd44ce8ef0f0972d67ad6bc4d3bc5f99d7bf8bad364290c740c`
- **Callers:** `require_verified_agency_for_rfq`; no application call and no direct RLS-policy reference was found.
- **Triggers:** indirectly invoked by both live RFQ `BEFORE INSERT` verification triggers.
- **Permissions/search path:** `SECURITY DEFINER`, `search_path=public`; live `EXECUTE` ACL is limited to `postgres` and `service_role` and the function is reached through trigger execution.
- **RLS/security impact:** centralizes verified-organizer and required-profile-field eligibility. Changing it could admit incomplete agencies or reject approved agencies.
- **Active-data dependency:** four RFQs exist. The function affects future inserts; existing RFQ rows are not rewritten by this audit.
- **Behavioral difference:** none found. Raw-hash difference is formatting only.
- **Later migration history:** the canonical tracked body is in the unledgered July 14 blocker-fix migration; the same semantic body exists live, consistent with manual/schema application rather than a ledgered replay.
- **Test coverage:** new token/hash regression coverage exists; no isolated behavioral database test can run until the migration chain reconstructs.
- **Recommended canonical version:** retain the July 14 tracked definition unchanged in the eventual canonical chain.
- **Confidence:** high.

## `record_rfq_lifecycle_event()`

- **Tracked definition hash:** `df0ea04b27d6af49970f18524ba61202b88eacc1e9bc39f36e4a52c58a6c97a3`
- **Live definition hash:** `e107d604916d4ab0ca0b3a536e921644b4cc730bb310cccb7382cf57a27f2849`
- **Semantic hash (both):** `45df0392d5bf2f19f98fd257b2571e6d426ab357bca5ef3c5c2c976d6a3c2342`
- **Callers/triggers:** `AFTER INSERT OR UPDATE` on `rfqs`, `AFTER INSERT OR UPDATE` on `quotes`, and `AFTER UPDATE` on `rfq_invitations`.
- **Permissions/search path:** `SECURITY DEFINER`, `search_path=public`; live `EXECUTE` ACL is limited to `postgres` and `service_role`.
- **RLS/security impact:** writes append-only lifecycle evidence as definer; direct client execution is revoked. It derives actor identity from `auth.uid()`.
- **Active-data dependency:** four RFQs, three quotes, three invitations, and eight lifecycle events exist. Future status/auditable edit events depend on this body.
- **Behavioral difference:** none found. Event selection, actor, foreign identifiers, and old/new statuses are token-identical.
- **Later migration history:** defined by the unledgered July 14 blocker-fix migration and present live with identical semantics.
- **Test coverage:** new token/hash regression coverage exists; database behavioral tests for every event transition remain required after reconstruction succeeds.
- **Recommended canonical version:** retain the July 14 tracked definition and its three trigger bindings.
- **Confidence:** high for definition parity; medium for exhaustive event behavior until database tests run.

## `require_verified_agency_for_rfq()`

- **Tracked definition hash:** `79103a175c6332a6fb36bff723f6c7e169552320f7af475b203d32c6c6bcf695`
- **Live definition hash:** `0c39f4f5a65e2345af0b9d9c1b264d7eab5dfe1447587766e3607e714000b628`
- **Semantic hash (both):** `1b05324176538f62856624bc48a7af102cecff2ff114e7b54b7ac5e697ec61e6`
- **Callers/triggers:** two live `BEFORE INSERT` triggers on `rfqs`; it calls `has_role` and `is_agency_rfq_eligible`.
- **Permissions/search path:** `SECURITY DEFINER`, `search_path=public`; live `EXECUTE` ACL is limited to `postgres` and `service_role`.
- **RLS/security impact:** blocks non-admin organizers that are not fully verified. It supplements, rather than widens, RLS.
- **Active-data dependency:** four RFQs exist; future inserts are guarded twice because of the duplicate trigger pair.
- **Behavioral difference:** none found. Admin bypass, eligibility call, error text, and returned row are token-identical.
- **Later migration history:** earlier versions checked fewer profile conditions; the July 14 migration supersedes them and the live semantic body matches that later definition.
- **Test coverage:** new token/hash regression coverage exists; insertion tests for verified, incomplete, and admin profiles remain required after reconstruction succeeds.
- **Recommended canonical version:** retain the July 14 definition; address the duplicate trigger separately with an additive migration after approval.
- **Confidence:** high.

## `update_updated_at_column()`

- **Tracked definition hash:** `c65132a2c298725f67acf5857b5f6ee3a5df5eb94047848b690650542f6de5fb`
- **Live definition hash:** `c65132a2c298725f67acf5857b5f6ee3a5df5eb94047848b690650542f6de5fb`
- **Semantic hash (both):** `951d65d5a5b24cd8b4b413ce00f0a74955d1d05219a107e1cccf86a46fc9c4fe`
- **Callers/triggers:** live `BEFORE UPDATE` triggers on `amenities`, `bookings`, `cities`, `conversations`, and `countries`.
- **Permissions/search path:** invoker function, `search_path=public`; live `EXECUTE` ACL is limited to `postgres` and `service_role`.
- **RLS/security impact:** no RLS bypass; it changes only `NEW.updated_at` within authorized updates.
- **Active-data dependency:** nine amenities, three bookings, 1,583 cities, three conversations, and 76 countries currently use the trigger.
- **Behavioral difference:** none; raw and semantic hashes match exactly.
- **Later migration history:** originally introduced in the first migration, then copied into the July 12 replay bundle without semantic change. The replay copy is not independent provenance.
- **Test coverage:** static body/hash coverage exists; a clean-database trigger test remains required.
- **Recommended canonical version:** preserve the original definition and treat the July 12 copy as replay evidence, not a new canonical change.
- **Confidence:** high.

## Decision

No function repair migration is proposed. The evidence converts all four items from unexplained definition drift to semantic matches. The remaining risks are reconstruction ordering, missing ledger provenance for July 14, and absent live database behavioral tests.
