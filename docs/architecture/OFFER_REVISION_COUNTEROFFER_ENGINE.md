# Offer Revision and Counteroffer Engine

## Purpose

Feature 5 evolves the existing immutable `offers` record into an immutable Offer Version without replacing the Deal and Offer foundation. A counteroffer is a new version in the same commercial thread. It is never an update to submitted terms.

This feature remains additive. Existing RFQ, invitation, quote, booking, messaging, notification, and legacy ownership behavior is unchanged.

## Domain model

- A Deal may contain multiple Offer Threads so the competing commercial alternatives already supported by Features 2 and 3 remain representable.
- An Offer Thread belongs to exactly one Deal.
- Each existing Offer becomes version 1 of its own thread during reconstruction or migration.
- Every Offer Version identifies its thread, monotonic version number, submitting organization, and optional parent version.
- `superseded` means a newer counteroffer replaced the prior actionable version. It is intentionally distinct from commercial rejection.
- At most one version per Deal can be accepted, preserving the Feature 2 unique invariant.

## Turn and authority model

- A participating Supplier may submit an initial Offer.
- An active Agency member may counter the latest submitted Supplier version.
- An active Supplier member may counter the latest submitted Agency version.
- A party cannot counter its own latest version.
- Only the latest submitted version in a thread is actionable.
- Buyer/Agency acceptance remains the sole commercial finalization authority.
- Suppliers may reject an Agency counter but cannot accept it or finalize the Deal.
- Inactive memberships, unrelated organizations, anonymous callers, and platform administrators have no commercial mutation authority.

The database validates all authority. Frontend action visibility is presentation only.

## Command model

`submit_initial_deal_offer` creates a thread and version 1 atomically. Its caller-supplied request ID provides retry idempotency without introducing the future global command bus.

`counter_deal_offer` locks Deal, Offer Thread, and parent Offer Version in that order. It validates the current turn, supersedes the parent, inserts the next immutable version, advances the thread sequence, and records audit evidence in one transaction.

Retrying the same counter against the same parent with identical terms returns the existing child. A changed retry or stale parent fails closed.

`accept_deal_offer` now targets an exact latest Supplier Offer Version. It accepts that version, rejects other actionable versions, agrees the Deal, and records all evidence atomically.

## Concurrency guarantees

- Row locks serialize state-changing commands per Deal and Offer Thread.
- Unique `(offer_thread_id, version_number)` prevents duplicate sequence numbers.
- One child per parent prevents concurrent divergent responses to one version.
- The existing accepted-Offer partial unique index prevents two winners per Deal.
- Conditional updates detect counter/accept/withdraw races and stale state.
- A late audit failure rolls the command transaction back.

## Security and privacy

- Offer Threads use RLS and are visible only to active Deal participants or canonical platform inspectors.
- Authenticated users receive no direct Offer Thread writes and no direct Offer update/delete grant.
- Command functions use `SECURITY DEFINER`, an empty explicit `search_path`, `auth.uid()`, active membership checks, role checks, and Deal participant validation.
- Internal trigger and audit helpers are not executable by anonymous or authenticated callers.
- Audit metadata contains commercial identifiers and state only, never contact identity.

## Workspace behavior

The Negotiation Workspace groups history by Offer Thread and renders versions in sequence order. Every version displays submitter side, amount, currency, validity, notes, time, and status. Only the latest actionable version displays commands.

Counteroffer forms prefill the prior version for efficient revision, hold unsaved values locally, and call the canonical counter command. Successful submission refetches authoritative state. Stale or concurrent changes trigger a safe localized refresh message.

## Known limitations

- The retry mechanism is local to initial and counteroffer commands. A shared command/idempotency foundation remains future work.
- No mutable server-side draft exists. Unsaved counteroffer state is local to the open dialog.
- Chat, contact reveal, contracts, booking conversion, payments, commissions, Trust, Disputes, Search, and AI remain out of scope.
- Hosted authenticated V3 integration requires a migrated non-Production backend and is certified separately.
