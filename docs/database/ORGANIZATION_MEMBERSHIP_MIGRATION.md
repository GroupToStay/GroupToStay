# Organization Membership Migration

## Identity

- Migration: `20260809170000_organization_membership_foundation.sql`
- Classification: additive V3 foundation
- Production execution: not authorized by this branch
- Legacy ownership rewrites: none
- Authentication, Storage, RFQ, Quote, Booking, Conversation, and Notification schema changes: none

## Added Objects

- 3 tables: organizations, organization memberships, Hotel compatibility mappings
- 4 enums: organization type/status and membership role/status
- deterministic identity, provisioning, authorization, validation, synchronization, and audit
  functions
- RLS-enabled read policies for members and existing platform administrators
- indexes for user membership, organization membership, organization status, and Hotel mapping

## Preconditions

The migration aborts when prerequisite tables are absent, only part of the organization foundation
already exists, enum definitions differ, marketplace ownership signals conflict, a marketplace
owner lacks a Profile, or an existing Hotel mapping conflicts.

## Backfill Rules

1. Organizer role or existing RFQ ownership produces Agency evidence.
2. Hotel role or existing Hotel ownership produces Supplier evidence.
3. Agency and Supplier evidence for one user is ambiguous and aborts.
4. Platform Admin without marketplace resources is not mapped.
5. Platform Admin with unambiguous existing marketplace resources is mapped because the data proves
   current ownership.
6. Names are copied only for organization identity display; they are never used to merge records.
7. Existing owner columns remain unchanged.

Postconditions require every eligible legacy owner to have one deterministic organization and Owner
membership, every owned Hotel to map to the correct Supplier organization, and no orphan membership.

## Security

Authenticated callers receive SELECT only. There are no direct INSERT, UPDATE, DELETE, role-change,
or transfer grants. Internal trigger functions are revoked from `PUBLIC`, `anon`, and
`authenticated`. Read helpers use current JWT identity and existing platform permission helpers.

The disposable security fixtures prove:

- one user can have multiple memberships
- one organization can have multiple members
- cross-organization reads are isolated
- inactive membership/account authority is denied
- forged organization IDs fail
- direct membership creation and self-escalation are denied
- platform Admin inspection remains available
- anonymous access is denied
- repeated provisioning does not duplicate records

## Rollback Analysis

Before commit, any migration failure rolls back all DDL, backfill, and audit writes. After a future
Production commit, physical rollback would remove V3 foundation objects and their generated audit
entries; that operation is intentionally not supplied because it would be destructive. Operational
rollback is to keep V2 on legacy ownership and disable consumers of the new foundation. No current
frontend or V2 policy depends on the new objects.

## Performance

Member lookup uses `(user_id, status, organization_id)`. Organization management uses
`(organization_id, status, membership_role)`. Hotel ownership mapping is one indexed lookup by
Hotel or organization. Existing public and V2 workflow queries gain no mandatory join.

## Production Safety

Merging this migration does not execute it. Production application requires a separate owner
approval, read-only preflight, backup/restore readiness, controlled migration execution,
postcondition verification, and V2 regression smoke tests.
