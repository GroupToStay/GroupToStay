# Active-Account Enforcement Decision Evidence

- Audit date: 2026-08-08
- Production project: `atxecflhmphaqqkatjlm`
- Production writes: none
- Decision status: **OWNER DECISION REQUIRED**

## Current Production semantics

Production has `profiles.account_status` with `active`, `suspended`, and `disabled` values, `is_account_active(uuid)`, and `enforce_active_account()`. Four live triggers enforce the status for non-admin users:

| Table      | Events                    |
| ---------- | ------------------------- |
| `rfqs`     | `BEFORE INSERT OR UPDATE` |
| `quotes`   | `BEFORE INSERT OR UPDATE` |
| `bookings` | `BEFORE INSERT OR UPDATE` |
| `messages` | `BEFORE INSERT`           |

Production has none of the seven restrictive `Active accounts only on ...` policies. Therefore account status does not independently hide rows or block every command on RFQs, quotes, bookings, messages, chat messages, conversations, or hotels.

`prevent_non_admin_account_status_change()` runs as a `BEFORE UPDATE` trigger on `profiles`. Its current body permits an admin or a principal with `manage_users`; other callers cannot change `account_status`. Its current ACL grants direct EXECUTE to `authenticated` and `service_role`. Directly invoking a PostgreSQL trigger function is not a valid ordinary function call, so removing the authenticated grant is least-privilege hardening, but the live ACL difference is not silently changed in this pass.

## Tracked July 12 semantics

`20260712154548_ef620850-2e80-48ea-9c74-86f31fe6957d.sql` adds seven `AS RESTRICTIVE FOR ALL` policies. Those policies apply both `USING` and `WITH CHECK`, so they affect visibility and all mutation commands. For RFQs, quotes, bookings, and messages this is broader than the earlier triggers; for chat messages, conversations, and hotels it introduces new account-status authorization behavior.

`20260712154405_a69b7885-b229-4ac5-8b07-db3231d60df0.sql` revokes authenticated direct execution of the profile trigger function. That ACL effect is absent from Production.

## Application and test assumptions

The application exposes account-status administration and excludes `account_status` from owner-editable profile patches. It does not perform a general client-side account-status gate for RFQ, quote, booking, messaging, conversation, or hotel reads. Existing tests verify that an owner patch cannot include `account_status`; they do not specify whether suspended users retain read access or whether chat/conversation/hotel operations are blocked.

Relying on client checks would not substitute for database authorization, but the current application and test suite do not establish the intended breadth of a future database rule.

## Security consequences

- Keeping current Production behavior preserves four write guards and existing row visibility.
- Enabling the seven policies blocks suspended/disabled users from reads and additional commands. That may be desirable, but it is an authorization change and can hide active lifecycle records.
- Removing the four existing triggers would weaken current write protection and is not proposed.
- Revoking direct EXECUTE on the internal trigger function is least-privilege hardening and should be decided separately from the all-command policy model.

## Decision required

The evidence does not establish one unambiguous intended model. Owner approval is required for:

1. retain Production's four trigger-only guards and omit the seven unledgered restrictive policies from the canonical final state; or
2. adopt the seven all-command policies as a deliberate authorization change with role/route regression tests; and
3. independently approve or defer the authenticated EXECUTE revocation on `prevent_non_admin_account_status_change()`.

No candidate migration in this pass changes active-account semantics or the live function ACL.
