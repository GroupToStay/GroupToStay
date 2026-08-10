# Deal and Offer Workflow

## Purpose

Feature 3 adds the first command-controlled state machine to the Feature 2 Deal and Offer
foundation. State changes are organization-authorized, serialized at the database, auditable, and
atomic. Existing V2 RFQ, invitation, quote, booking, messaging, and ownership workflows remain
unchanged.

## Transition Matrix

| Entity | From        | To          | Authorized actor                           | Command                    |
| ------ | ----------- | ----------- | ------------------------------------------ | -------------------------- |
| Deal   | `active`    | `agreed`    | Buyer Owner/Admin/Agent                    | Accept a submitted Offer   |
| Deal   | `active`    | `cancelled` | Buyer Owner/Admin/Agent                    | Cancel Deal                |
| Deal   | `agreed`    | `closed`    | Buyer Owner/Admin/Agent                    | Close Deal                 |
| Offer  | `submitted` | `accepted`  | Buyer Owner/Admin/Agent                    | Accept Offer               |
| Offer  | `submitted` | `rejected`  | Buyer Owner/Admin/Agent                    | Reject Offer               |
| Offer  | `submitted` | `withdrawn` | Supplier Owner/Admin/Sales/Reservations    | Withdraw Offer             |
| Offer  | `submitted` | `expired`   | Active buyer or supplier commercial member | Expire after `valid_until` |

`closed`, `cancelled`, `accepted`, `rejected`, `withdrawn`, and `expired` are terminal in this
feature. Cancelling an agreed Deal is deliberately deferred because no approved reversal,
contract, or booking policy exists yet. Platform administrators retain inspection authority only;
they do not acquire marketplace mutation authority.

## Command Boundary

Authenticated clients have no direct `UPDATE` or `DELETE` grants on `deals` or `offers`. Lifecycle
changes are exposed only through narrowly scoped PostgreSQL commands:

- `accept_deal_offer`
- `reject_deal_offer`
- `withdraw_deal_offer`
- `expire_deal_offer`
- `cancel_deal`
- `close_deal`

The commands validate `auth.uid()`, active organization membership, organization role, resource
ownership, and current state. They use an empty `search_path`, return generic authorization errors
for inaccessible resources, and are executable only by the authenticated database role. Anonymous
execution and direct access to the internal audit helper are revoked.

## Atomic Acceptance

Offer acceptance uses one database transaction and a consistent lock order:

1. Resolve the Offer's Deal.
2. Lock the Deal row.
3. Validate active buyer authority.
4. Lock the selected Offer row.
5. Validate active Deal, submitted Offer, and server-authoritative validity time.
6. Mark the selected Offer accepted.
7. Reject every competing submitted Offer for the Deal.
8. Mark the Deal agreed.
9. Write Offer, competitor, and Deal audit records.

Any failed validation or audit write rolls back the complete command. A partial unique index allows
at most one accepted Offer per Deal even if a future caller violates the command boundary. The Deal
lock serializes acceptance, withdrawal, rejection, expiration, cancellation, and closure for the
same Deal. Repeating acceptance for the already accepted Offer on its agreed Deal returns an
idempotent success without repeating audit effects.

## Audit Model

The workflow reuses `admin_audit_logs`; it does not create a parallel event store. Each successful
transition records the entity, previous status, new status, authenticated actor, timestamp, Deal
context, and command-specific metadata. These records support administrative evidence only and do
not replace the future immutable Deal event model.

## Commercial Immutability

Feature 2 commercial fields remain immutable after submission. Workflow commands update only the
status column and cannot alter amount, currency, validity, notes, ownership, source references, or
creation timestamps.

## V2 Compatibility

The migration adds one index and seven workflow functions. It does not alter or backfill V2 RFQs,
invitations, quotes, bookings, Hotels, conversations, messages, notifications, lifecycle events, or
their ownership columns. Agreement is a V3 milestone only and creates no booking.

## Errors and Concurrency

- `42501` indicates unavailable or unauthorized workflow access without confirming hidden object
  existence.
- `55000` indicates a disallowed current-state transition or expired acceptance window.
- `40001` indicates a stale concurrent state change and is safe for the caller to re-read.
- The accepted-Offer unique index rejects any second winner at the storage boundary.

## Deferred Scope

This feature does not implement Offer Versions, counteroffers, Agreement records, identity reveal,
Chat, booking conversion, payments, commissions, settlement, Trust, Disputes, Search, AI, or a Deal
workspace UI.
