# Deal and Offer Foundation

## Purpose

Feature 2 introduces the first organization-owned V3 commercial records without replacing any V2
workflow. A Deal is the commercial relationship between one buyer organization and one supplier
organization. An Offer is a supplier's commercial submission inside that Deal.

V2 RFQs, invitations, quotes, bookings, Hotels, ownership columns, triggers, RPCs, and policies
remain authoritative and unchanged.

## Domain Model

```text
Agency organization (buyer)
  -> Deal <- Supplier organization
       |          |
       |          -> Hotel compatibility mapping
       -> Offers owned by the Deal supplier

Optional V2 trace:
RFQ -> Invitation -> Hotel -> Deal
```

### Deal

A Deal has exactly one Agency buyer and one Supplier. Its first status vocabulary is intentionally
small: `active`, `agreed`, `closed`, and `cancelled`. Feature 2 creates active Deals but does not
implement the later agreement or transition command model.

The nullable `source_rfq_id`, `source_invitation_id`, and `source_hotel_id` fields are one coherent
compatibility triple. Ordinary authenticated creation requires all three and verifies that:

- the RFQ organizer is an active member of the buyer Agency;
- the invitation belongs to that RFQ and Hotel;
- the Hotel maps to the selected Supplier;
- the RFQ, invitation, Hotel, organizations, membership, and account are eligible and active.

Source-less Deals remain structurally possible for future guarded backend workflows, but normal
clients cannot create them in this feature. One V2 invitation can map to at most one Deal.

### Offer

An Offer belongs to one Deal and repeats the Supplier ID as a constrained ownership key. A
composite foreign key guarantees that the Offer supplier is exactly the Deal supplier. The minimal
commercial snapshot contains amount, ISO-style three-letter currency, optional validity time, and
optional notes.

New Offers begin as `submitted`. Submitted ownership and commercial terms are immutable. The
status vocabulary reserves `accepted`, `rejected`, `withdrawn`, and `expired`, but Feature 2 grants
no direct client update path. Later versioning and command features must introduce guarded state
transitions rather than widening table policies.

## Ownership and Security

Platform roles and organization memberships remain separate.

| Actor                      | Deal read | Deal create                         | Offer read | Offer create |
| -------------------------- | --------- | ----------------------------------- | ---------- | ------------ |
| Buyer Owner/Admin/Agent    | Own       | Valid V2-sourced Deal for own buyer | Own Deal   | No           |
| Buyer Viewer               | Own       | No                                  | Own Deal   | No           |
| Supplier commercial member | Own       | No                                  | Own Deal   | Own Supplier |
| Supplier Viewer            | Own       | No                                  | Own Deal   | No           |
| Unrelated organization     | No        | No                                  | No         | No           |
| Inactive member            | No        | No                                  | No         | No           |
| Platform administrator     | Inspect   | No implicit marketplace authority   | Inspect    | No           |
| Anonymous                  | No        | No                                  | No         | No           |
| Service role / guarded API | Yes       | Yes                                 | Yes        | Yes          |

Both tables have RLS enabled. Authenticated grants are limited to `SELECT` and `INSERT`; no direct
`UPDATE` or `DELETE` grant exists. Structural trigger functions use an empty search path and are not
executable by ordinary users. The one caller-visible helper validates only a Deal sourced from an
RFQ owned by the caller's active buyer organization. Deal creation is limited to Agency Owner,
Admin, and Agent roles. Offer submission is limited to Supplier Owner, Admin, Sales, and
Reservations roles. Creation timestamps are assigned by PostgreSQL rather than trusted from the
client.

## V2 Compatibility

The migration performs no historical backfill and changes no V2 table. Creating a Deal or Offer
does not mutate RFQs, invitations, quotes, bookings, Hotels, messages, notifications, or their
lifecycle events. Existing pages and API contracts continue to operate solely on V2 records.

## Future Boundaries

This foundation deliberately does not implement Offer Threads, Offer Versions, counteroffers,
Agreement commands, identity reveal, Chat, payments, commissions, Trust, Disputes, Search, or AI.
Future Offer Versioning may project or migrate this initial immutable Offer representation through
an explicitly reviewed additive migration.

## Performance

Indexes cover buyer and supplier Deal worklists, V2 source lookups, Deal Offer history, and supplier
Offer status. Public pages incur no new joins because no existing frontend query was changed.

## Known Limitations

- Client Deal creation is limited to a valid existing V2 invitation.
- Offer status transitions are reserved but not exposed.
- There is no Deal or Offer UI in Feature 2.
- There is no historical V2 RFQ or quote conversion.
- Multi-offer version semantics are deferred to the approved Offer Versioning feature.
