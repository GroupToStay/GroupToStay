# Negotiation Workspace v1

## Purpose

The Negotiation Workspace is the first authenticated V3 product surface for a Deal. It presents
the RLS-authorized Deal, immutable Offer history, commercial state, and only the lifecycle commands
already defined by Feature 3. It is additive and does not replace any V2 RFQ, quotation, booking,
or messaging page.

## Route and Data Boundary

The canonical route is `/deals/$dealId` under the existing authenticated pathless layout. A UUID is
validated before any query. Direct refresh is supported by TanStack Router and the route inherits
the existing authentication redirect.

The route is deliberately absent from global navigation in v1. No public or authenticated layout
performs an eager V3 query, so environments whose migration alignment is deferred continue to load
all V2 routes normally. Direct access in such an environment produces a localized unavailable
state rather than exposing a PostgREST or SQL error.

The typed data layer reads `deals`, `offers`, the caller's relevant organization memberships, and
optional V2 source context. RLS remains authoritative. Optional source data that RLS does not
expose is omitted rather than treated as an application failure. Counterparty organization IDs and
contact details are never rendered.

## Authority and Commands

The presentation model derives a fail-closed actor context from active memberships:

- buyer Owner, Admin, or Agent: accept/reject Offers, cancel active Deals, close agreed Deals;
- supplier Owner, Admin, Sales, or Reservations: withdraw own submitted Offers;
- either authorized commercial side: mark an Offer expired after its validity timestamp;
- inactive, ambiguous, unrelated, or administrative inspection contexts: read-only.

These checks only determine which controls to present. Every mutation calls one existing Feature 3
RPC. The browser never updates `deals.status` or `offers.status` directly. Pending commands disable
all command controls, and stale/state errors invalidate the Deal query before showing a safe
localized message.

Acceptance uses an accessible confirmation dialog that explains the atomic effects: the selected
Offer becomes accepted, competing submitted Offers become rejected, and the Deal becomes agreed.
It explicitly states that no Booking is created.

## Information Architecture

The workspace contains:

1. Deal header, status, and caller context.
2. Commercial summary using the accepted Offer, current submitted Offer, or latest historical
   Offer in that order.
3. Chronological immutable Offer history with status, value, validity, notes, and authorized
   commands.
4. Deal/source context and a privacy reminder.
5. Explicit loading, unavailable, backend-disabled, network, stale, and generic failure states.

The layout uses the existing workspace shell, cards, badges, buttons, alerts, and dialogs. It stacks
on mobile, keeps controls at least 44 pixels high, uses semantic headings and articles, announces
mutation outcomes, supports keyboard focus restoration through Radix, and preserves LTR/RTL
behavior. Currency values are isolated with left-to-right bidirectional formatting in both locales.

## Database and Rollout Impact

Feature 4 introduces no migration, view, RPC, policy, grant, or generated-type change. Hosted
authenticated integration requires a non-Production environment with the already-approved V3
migrations. Production migration alignment remains a separate owner-controlled operation.
