# Organization and Membership Model

## Purpose

GroupToStay V3 moves marketplace authority from a one-user/one-company assumption to explicit
organization membership. Feature 1 establishes that foundation additively. It does not replace
current V2 ownership, platform roles, verification, RFQs, quotations, bookings, conversations, or
notifications.

The compatibility model is:

```text
auth.users
  -> organization_memberships
  -> organizations
  -> organization_hotel_mappings -> hotels

profiles.id / rfqs.organizer_id / hotels.owner_id remain authoritative for V2 workflows.
```

## Entity Model

### Organization

`organizations` represents a marketplace legal or operating party. Its deliberately small
canonical identity includes:

- type: `agency`, `supplier`, or future `corporate_buyer`
- legal and display names
- operational status
- optional country
- creator and transitional `legacy_owner_user_id`
- timestamps and an archival timestamp

The legacy owner is a compatibility key, not a permanent single-user ownership rule.

### Organization Membership

`organization_memberships` is the organization-scoped authority assignment. A user can hold many
memberships and an organization can have many members. Membership status is independent of the
organization's status.

Supported foundation roles are:

| Organization    | Roles                                     |
| --------------- | ----------------------------------------- |
| Agency/buyer    | Owner, Admin, Agent, Viewer               |
| Supplier        | Owner, Admin, Sales, Reservations, Viewer |
| Corporate buyer | Owner, Admin, Agent, Viewer               |

The role validator rejects supplier-only roles on buyer organizations and the agency-only Agent
role on suppliers. New role values require an additive architecture-reviewed migration.

### Hotel Compatibility Mapping

`organization_hotel_mappings` associates each current Hotel listing with exactly one supplier
organization. The listing itself is not renamed or replaced. A later Supplier Unit feature can
adopt this relationship without changing current Hotel APIs.

## Authority Layers

Platform authority and organization authority are deliberately separate:

1. Platform roles and permissions: Super Admin, Admin, Assistant Admin, and enterprise permissions.
2. Organization membership: Owner, Admin, Agent, Sales, Reservations, or Viewer.
3. Resource ownership: current V2 owner columns and, later, organization IDs on V3 aggregates.

An Admin does not receive a marketplace organization merely because they administer the platform.
An Admin is mapped only if existing marketplace resources prove an organization relationship.

## Ownership Transition

| Current concept       | Feature 1 mapping                                       |
| --------------------- | ------------------------------------------------------- |
| Agency profile/user   | Agency organization plus Owner membership               |
| Hotel account/company | Supplier organization plus Owner membership             |
| Hotel listing         | Compatibility mapping to supplier organization          |
| `rfqs.organizer_id`   | Resolves through organization legacy-owner identity     |
| Legacy organizer role | Preserved; provisions an Agency organization            |
| Legacy hotel role     | Preserved; provisions a Supplier organization           |
| Platform Admin        | Platform authority; no automatic marketplace membership |

No V2 ownership column is dropped, rewritten, or made nullable by this feature.

## Backfill

The migration derives organization type from role and owned-resource evidence. It never merges
accounts by name. It aborts if the same user has both agency and supplier evidence, if a
marketplace owner lacks a Profile, or if a Hotel mapping conflicts with deterministic ownership.

Organization and owner-membership IDs are deterministic hashes of stable user/type inputs. Unique
constraints and `ON CONFLICT` handling make repeated provisioning idempotent. Existing account
status initializes and synchronizes the compatibility organization and owner membership status.

New marketplace roles provision the same model through an internal trigger. New and transferred
Hotel ownership synchronizes only the compatibility mapping; existing Hotel ownership protections
remain authoritative.

## RLS Model

All three new tables have RLS enabled.

- Anonymous users receive no table privileges.
- Authenticated users receive read-only table privileges.
- Active members can read their organization.
- Users can read their own membership; organization Owner/Admin roles can inspect their members.
- Platform administrators can inspect records through existing enterprise permissions.
- Ordinary users cannot insert, update, delete, invite, transfer, or self-escalate memberships.
- Service-role access remains available for guarded backend operations and migration tooling.

Helper functions use `SECURITY DEFINER` only where RLS recursion must be avoided. Each uses an empty
search path, fully qualified objects, explicit grants, and current authenticated identity for
authorization decisions.

## Authorization Helpers

- `is_active_organization_member(organization_id)`: active account, organization, and membership.
- `user_organization_role(organization_id)`: current user's active membership role.
- `can_manage_organization(organization_id)`: Owner/Admin membership or applicable platform
  permission.
- `organization_represents_legacy_owner(organization_id, user_id)`: compatibility ownership lookup.

Internal deterministic-ID and provisioning functions are not executable by ordinary authenticated
users. The legacy-owner resolver is likewise service-only until a later RLS policy has an approved
need for it.

## Audit Contract

The existing `admin_audit_logs` infrastructure is reused. No parallel audit table exists.

- Organization creation: `organization.created`
- Membership creation: `organization_membership.created`
- Role change: `organization_membership.role_changed`
- Suspension: `organization_membership.suspended`
- Removal status: `organization_membership.removed`
- Reactivation: `organization_membership.reactivated`

Membership removal is a status transition for application workflows. Direct delete is not granted
to authenticated users.

## Backward Compatibility

Current V2 queries, mutations, routes, RLS policies, RPCs, and frontend role routing continue to use
their existing ownership fields. The frontend receives regenerated types but no new navigation,
switcher, onboarding, or organization-management UI in Feature 1.

This avoids extra joins on public pages and keeps current Agency verification, Hotel approval, RFQ,
Quote, Award, Booking, Messaging, Notification, and Admin behavior unchanged.

## Future Deal Relationship

Deal Foundation will reference `buyer_organization_id` and `supplier_organization_id`. A future
Supplier Unit will belong to `organization_id` and can absorb the Hotel compatibility mapping.
Feature 1 creates neither entity and does not pre-implement their state or permissions.

## Known Limitations

- There is no organization invitation or mutation workflow yet.
- There is no organization switcher; existing users remain visually single-organization.
- Organization names are captured at provisioning and are not yet a replacement for Profile or
  Hotel verification data.
- V2 resources remain user-owned until a later explicitly approved compatibility migration.
- Organization archival and advanced membership lifecycle commands require later guarded APIs.
