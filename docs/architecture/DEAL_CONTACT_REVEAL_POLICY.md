# Deal Contact Reveal Policy

## Purpose

V3 Deal participants negotiate through immutable Offer Versions and Private Deal Chat without receiving direct contact details before agreement. Contact reveal is a Deal-scoped authorization capability, not a frontend visibility convention.

## Policy

- Before agreement, the Agency and Supplier receive only the safe marketplace and property context already authorized by the Deal.
- Accepting an eligible Supplier Offer Version is the only Feature 7 reveal trigger.
- Acceptance, Deal agreement, immutable reveal evidence, and reveal audit evidence commit in one transaction.
- Participants retain approved contact access after an agreed Deal is closed.
- A Deal cancelled before agreement has no reveal authorization.
- Platform administration remains a separate authority layer. Administrators may inspect non-PII reveal evidence but cannot invoke the participant contact projection.
- Contact values remain live in canonical business profiles. Feature 7 does not duplicate PII or create contract-grade snapshots.

## Field-Level Visibility Matrix

| Field                          | Canonical source                                                            | Before agreement                                       | Agency after agreement                                                                | Supplier after agreement      | Platform admin                              | Justification                                       |
| ------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------- | --------------------------------------------------- |
| Business name                  | `organizations.display_name`                                                | Safe marketplace context only where already authorized | Supplier business name                                                                | Agency business name          | Existing administrative profile access only | Identifies the contracting business                 |
| Business contact person        | Agency `profiles.contact_person_name`                                       | Hidden                                                 | Not returned for Supplier because no canonical supplier business-contact field exists | Agency contact person         | Existing administrative profile access only | Agency explicitly records a business contact person |
| Business email                 | Agency `contact_person_email`; Supplier `contact_email`                     | Hidden                                                 | Supplier business email                                                               | Agency business contact email | Existing administrative profile access only | Transaction coordination after agreement            |
| Business phone                 | Agency `contact_person_phone`; Supplier `phone_number`, then `phone`        | Hidden                                                 | Supplier business phone                                                               | Agency business contact phone | Existing administrative profile access only | Transaction coordination after agreement            |
| Business WhatsApp              | Agency `contact_person_whatsapp`                                            | Hidden                                                 | Not returned because no canonical Supplier WhatsApp field exists                      | Agency business WhatsApp      | Existing administrative profile access only | Explicit Agency business contact channel            |
| Business address               | Agency `full_address`, then `business_address`; Supplier `business_address` | Hidden                                                 | Supplier business address                                                             | Agency business address       | Existing administrative profile access only | Operational and contracting context                 |
| Organization type              | `organizations.organization_type`                                           | Derivable safe role context                            | Supplier                                                                              | Agency                        | Reveal evidence only                        | Labels the counterpart without exposing IDs         |
| Reveal time and policy version | `deal_contact_reveals`                                                      | Hidden                                                 | Visible through projection                                                            | Visible through projection    | Reveal evidence visible                     | Explains why contact is available                   |

The projection never returns Auth email, user IDs, organization IDs, role assignments, verification internals, technical contacts, billing contacts, or administrative metadata.

## Reveal Evidence

`deal_contact_reveals` contains one immutable record per Deal. It references the accepted Offer Version and records the trigger, policy version, and server timestamp. A deferred Deal constraint requires agreed and closed Deals to retain valid reveal evidence. Existing agreed V3 data causes migration preconditions to fail because Feature 7 performs no unreviewed customer-data backfill.

## Authorization Boundary

`get_deal_counterparty_contact(deal_id)` is the only participant contact read boundary. It resolves the caller from `auth.uid()`, requires exactly one active Deal-side membership with an approved commercial role, verifies an agreed or closed Deal and reveal evidence, resolves the opposite organization server-side, and returns an allowlisted projection. It accepts no organization identifier from the client.

The reveal table grants participants no direct read or mutation access. Direct profile RLS remains unchanged. Anonymous users, inactive members, unrelated organizations, dual-sided memberships, and platform admins without Deal membership fail closed.

## Chat Guidance

Private Deal Chat remains plain text and does not become a commercial or contact system. Before agreement, the workspace warns participants not to share direct contact details. The warning is advisory because Feature 7 does not introduce unreliable regex blocking or automated moderation. After agreement, Chat points to the Deal contact section but never posts contact values into message history.

## Compatibility and Limits

- V2 profile, hotel, messaging, RFQ, quote, booking, and contact visibility behavior is unchanged.
- No V2 or historical Deal data is backfilled.
- Contact values are live rather than historical snapshots. Contract-grade snapshots belong to the later Agreement/Contract context.
- Supplier WhatsApp and Supplier business-contact person remain unavailable until canonical fields are approved.
- Access-read logging is deferred; the immutable reveal event is audited without PII values.
