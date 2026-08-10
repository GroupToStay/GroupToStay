# Private Deal Chat Foundation

## Purpose

Private Deal Chat gives the Agency and Supplier organizations on a Deal a protected channel for operational clarification. It is not a commercial command surface. Offer Versions, counteroffers, acceptance, rejection, withdrawal, expiry, and Deal agreement remain authoritative only through the structured Deal and Offer commands.

## Architectural decision

Feature 6 extends the existing `conversations` and `chat_messages` model instead of creating parallel Deal messaging tables. A conversation is in exactly one context:

- V2 RFQ context: the existing RFQ, hotel, organizer, hotel-owner, participant, attachment, notification, and policy contracts remain unchanged.
- V3 Deal context: `deal_id` identifies one canonical conversation per Deal, while organization membership derives access dynamically.

Deal messages add `sender_organization_id`. The Deal UI deliberately does not select `sender_id`, email, phone, contact names, or raw participant identifiers.

## Ownership and authority

Conversation read authority derives from active membership in the Deal's buyer or supplier organization. The canonical enterprise-admin policy provides inspection only and does not grant sender authority.

Send authority is narrower:

| Side         | Authorized organization roles     |
| ------------ | --------------------------------- |
| Agency buyer | Owner, Admin, Agent               |
| Supplier     | Owner, Admin, Sales, Reservations |

Inactive memberships, viewer roles, dual-sided authority, unrelated organizations, anonymous callers, and platform admins without marketplace membership cannot send.

## Commands

`ensure_deal_conversation` provisions one conversation per Deal. It is idempotent and relies on a unique Deal key for concurrent calls.

`send_deal_message` validates the authenticated caller, active membership, organization side, role, conversation, Deal participation, Deal state, and message bounds. The command stores trimmed plain text and returns only safe message identity metadata. Direct authenticated inserts into Deal message history are denied.

Both commands use an empty search path, least-privilege grants, and fail-closed errors. Closed and cancelled Deals remain readable but reject sends. Active and agreed Deals permit sends by authorized roles.

## Privacy and immutability

- Messages are plain text and rendered through React text nodes.
- Deal messages contain 1 to 4,000 characters.
- Deal messages cannot carry attachments in Feature 6.
- Ordinary participants cannot update or delete messages.
- The database rejects mutation of Deal message history even through later privileged paths.
- Participant labels are only Agency and Supplier context labels.
- Contact reveal is not inferred from Deal or message state.

The separate `is_deal_conversation_participant` helper intentionally does not extend the V2 participant helper. This prevents Deal membership from granting access to V2 attachment-storage or broadcast policies.

## Realtime

The workspace uses the existing `chat_messages` Postgres Changes publication, filtered to one authorized conversation. It removes the channel on conversation change or unmount and refetches the RLS-protected projection after an insert. No global realtime layer, typing state, presence, or read receipt model is introduced.

## Audit and notifications

Conversation creation records one security-sensitive event in `admin_audit_logs`. Messages are not duplicated into audit logs because the immutable message row is the communication record.

The V2 notification trigger remains unchanged. Deal conversations have no V2 `conversation_participants` rows, so Feature 6 does not emit Deal-message notifications. A permission-aware organization notification projection is deferred.

## Backward compatibility

- No V2 conversation or message is backfilled.
- RFQ conversation uniqueness and participant rows remain unchanged.
- V2 direct message insertion keeps its existing user-participant policy and requires a non-Deal conversation.
- V2 attachments, notifications, unread tracking, typing, routes, and UI are unchanged.
- No global route or layout queries V3 chat objects.

## Known limitations

Feature 6 does not include attachments, voice notes, editing, deletion, read receipts, typing indicators, presence, unread synchronization, contact reveal, or hosted authenticated V3 certification. Those additions require their own domain and privacy review.
