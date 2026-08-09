# Canonical Generated Types Report

- Source: final successful isolated reconstruction on 2026-08-09
- Canonical schema fingerprint: `7d13a27c750922f78e405e93a9c873d5459888e2f6c4ad94cc35db871f239e15`
- Canonical catalog fingerprint: `b0c215980d192222d19da193b98eff7cae41bb6b6a715f348d9bfc851d44cb5d`
- Normalized generated-types SHA-256: `d775795e7a392344778d347fd65d59a82077225db39dd5457f9a49959c859d23`

## Promotion result

`src/integrations/supabase/types.ts` is promoted from the final empty reconstruction. The
reconstruction workflow normalizes only end-of-file whitespace and requires exact byte equality
between the generated artifact and the committed file.

Required coverage is present:

- `profiles.city_name`
- `rfq_lifecycle_events`
- `is_agency_rfq_eligible`

Additional meaningful generated changes are:

- the generated `graphql_public` schema and `graphql` function contract;
- generated nullability for `admin_audit_logs.ip_address`;
- generated nullability for `admin_get_user_auth_metadata.last_sign_in_at`;
- deterministic generator ordering and output shape.

## Decision

**GENERATED TYPES PROMOTED: YES.** Generated-type equality is now a blocking database
reconstruction gate.
