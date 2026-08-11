# V2 to V3 Deal Activation

## Purpose

Feature 7.5 connects eligible active V2 RFQ invitations to the canonical V3 Deal workspace without rewriting historical RFQs, quotations, bookings, conversations, or ownership.

## Activation Boundary

- One Deal is provisioned per RFQ invitation through `ensure_deal_for_invitation`.
- The server resolves the Agency organization from the RFQ's canonical legacy owner and the Supplier organization from the invitation's hotel mapping.
- The caller supplies only the invitation identifier. Organization ownership cannot be forged through command arguments.
- Provisioning is deterministic and idempotent. The invitation row is locked and `deals.source_invitation_id` remains unique.
- Active Agency roles are Owner, Admin, and Agent. Active Supplier roles are Owner, Admin, Sales, and Reservations.
- Platform administrators remain inspectors and cannot activate a Deal as a marketplace participant.

## Coexistence Rule

An eligible invitation with no legacy quotation may start V3 negotiation. Once a Deal exists, its structured workspace becomes the active commercial path and any existing V2 quotation is presented only as historical context.

An invitation that already has a V2 quotation but no Deal remains on the V2 path. Feature 7.5 performs no quotation conversion or historical backfill.

## Product Journey

1. A Supplier opens an eligible invitation and starts negotiation.
2. The Deal is provisioned and the Supplier submits the first immutable Offer Version.
3. The Agency finds the Deal through Active Negotiations or the RFQ/quotation context.
4. Agency and Supplier exchange immutable Counteroffer Versions.
5. The Agency accepts the selected Supplier Offer Version.
6. The Deal becomes agreed and contact reveal evidence is created atomically.
7. Deal Chat remains available for both participants.

## Runtime Activation

`VITE_V3_DEAL_ACTIVATION_ENABLED` controls presentation and navigation only. Its safe default is `false`, so a frontend deployment cannot query missing V3 objects before the database is activated. Database RLS and command authorization remain authoritative when the presentation switch is enabled.

## Production Activation Dependency

Production must apply the complete pending canonical migration chain through `20260811170000_v2_v3_deal_activation.sql` before enabling the runtime switch. Repository merge and database activation are separate approvals.

## Known Limits

- Historical V2 quotations are not converted into Offer Versions.
- The first activation release supports a new structured negotiation only when no legacy quotation already owns that invitation.
- The negotiation list is scoped to the current user's active Deal memberships and does not implement organization switching.
- Hosted authenticated certification requires an isolated migrated environment; Production is not a test environment.
