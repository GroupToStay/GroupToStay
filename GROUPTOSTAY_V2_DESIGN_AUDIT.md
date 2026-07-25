# GroupToStay V2 Design Audit

## Scope

This audit records the current frontend architecture, implemented roles, routes, workflows,
shared components, and design inconsistencies before the GroupToStay V2 redesign.

The redesign is frontend-only. Existing authentication, authorization, database structures,
RLS policies, API contracts, routing, and business workflows remain the source of truth.

## What Already Exists

### Application architecture

| Area           | Current implementation                                                |
| -------------- | --------------------------------------------------------------------- |
| Framework      | React 19 with TanStack Start and Vite 7                               |
| Routing        | TanStack Router file routes with `defaultPreload: "intent"`           |
| Data fetching  | TanStack Query                                                        |
| Forms          | React Hook Form and Zod                                               |
| Backend        | External Supabase project through environment variables               |
| Authentication | Supabase Auth through the existing `AuthProvider` and route guards    |
| Authorization  | Database roles, route guards, RLS, and feature-level ownership checks |
| Styling        | Tailwind CSS v4 with CSS custom-property tokens                       |
| UI primitives  | shadcn New York style using Radix UI                                  |
| Icons          | Lucide React                                                          |
| Localization   | i18next, English and Arabic, with `ApplicationLocaleProvider`         |
| Notifications  | Sonner plus persisted Supabase notifications                          |
| Motion         | CSS and `tw-animate-css`; no separate animation framework             |
| Charts         | No chart dependency is installed                                      |

The stack is current and appropriate. V2 should consolidate the current foundations, not
replace them with a second component system.

### Roles

The implemented database roles are:

| Product label | Code/database value   | Notes                                                 |
| ------------- | --------------------- | ----------------------------------------------------- |
| Guest         | No authenticated user | Public routes only                                    |
| Agency        | `organizer`           | Some UI helpers also accept the alias `agency`        |
| Hotel         | `hotel`               | Hotel company/profile ownership is checked separately |
| Admin         | `admin`               | Admin routes use explicit guards                      |

Legacy authenticated users without a role are treated as organizers by the current role
hook. This compatibility behavior must remain unchanged.

### Supabase integration

The frontend uses:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- a lazy Supabase client with persisted sessions
- direct typed table queries
- existing database triggers, functions, policies, and RLS

The frontend does not currently call a separate REST application API or a frontend RPC
abstraction. V2 components must preserve the existing query and mutation boundaries.

### Database-backed product areas

The generated client types include:

- agencies and agency verification events
- hotels, hotel rooms, hotel amenities, and hotel types
- RFQs and RFQ invitations
- quotes
- bookings
- conversations, participants, chat messages, and legacy messages
- notifications
- profiles and user roles
- country, city, room, meal-plan, and amenity reference data
- subscription interest and platform settings

Storage usage includes hotel photos, agency documents, and chat attachments.

## Route Inventory

### Public and authentication

| Route                       | Purpose                                         | Current state                      |
| --------------------------- | ----------------------------------------------- | ---------------------------------- |
| `/`                         | Public marketplace homepage and quick RFQ entry | Complete, visually dense           |
| `/about`                    | About                                           | Complete                           |
| `/auth`                     | Sign in and registration                        | Complete                           |
| `/contact`                  | Contact form                                    | Complete                           |
| `/cookies`                  | Cookie policy                                   | Complete                           |
| `/for-hotels`               | Hotel partner information                       | Complete                           |
| `/hotel-list`               | Legacy hotel-list alias                         | Protected compatibility route      |
| `/hotels`                   | Hotel management/listing entry                  | Protected by product authorization |
| `/hotels/:id`               | Hotel detail                                    | Protected by product authorization |
| `/how-it-works`             | Marketplace explanation                         | Complete                           |
| `/pricing`                  | Pricing and subscription interest               | Complete                           |
| `/privacy`                  | Privacy policy                                  | Complete                           |
| `/request-quote`            | Public/full RFQ workflow                        | Complete                           |
| `/requests`                 | Request inventory                               | Protected compatibility route      |
| `/requests/:id`             | Request detail                                  | Complete                           |
| `/reset-password`           | Password recovery completion                    | Complete                           |
| `/subscription/checkout`    | Subscription checkout state                     | Partial/future-facing              |
| `/subscription/coming-soon` | Subscription wait state                         | Complete                           |
| `/terms`                    | Terms and conditions                            | Complete                           |
| `/trust`                    | Trust and security                              | Complete                           |

### Agency and shared authenticated routes

| Route                         | Purpose                     | Current state                |
| ----------------------------- | --------------------------- | ---------------------------- |
| `/dashboard`                  | Role-aware dashboard        | Complete, basic presentation |
| `/dashboard/profile`          | Personal profile            | Complete                     |
| `/dashboard/notifications`    | Notification center         | Complete                     |
| `/dashboard/messages`         | Conversation list           | Complete                     |
| `/dashboard/messages/:id`     | Conversation workspace      | Complete                     |
| `/dashboard/rfqs`             | Agency RFQ list             | Complete                     |
| `/dashboard/rfqs/new`         | Create RFQ                  | Complete                     |
| `/dashboard/rfqs/:id`         | RFQ management              | Complete                     |
| `/dashboard/rfqs/:id/compare` | Quote comparison            | Complete                     |
| `/dashboard/quotations`       | Received offers             | Complete                     |
| `/dashboard/agency-profile`   | Agency verification/profile | Complete                     |

### Hotel routes

| Route                    | Purpose                          | Current state |
| ------------------------ | -------------------------------- | ------------- |
| `/dashboard/invitations` | RFQ invitations and quote entry  | Complete      |
| `/dashboard/hotel`       | Hotel company/profile management | Complete      |
| `/dashboard/hotel/:id`   | Hotel property management        | Complete      |
| `/dashboard/hotel/pms`   | PMS connection information       | Complete      |

### Admin routes

| Route                          | Purpose                    | Current state         |
| ------------------------------ | -------------------------- | --------------------- |
| `/admin`                       | Admin overview             | Complete              |
| `/admin/users`                 | User management            | Complete              |
| `/admin/group-requests`        | RFQ management             | Complete              |
| `/admin/hotel-companies`       | Hotel company review       | Complete              |
| `/admin/hotel-listings`        | Hotel listing management   | Complete              |
| `/admin/agency-verifications`  | Agency verification review | Complete              |
| `/admin/subscription-interest` | Subscription leads         | Complete              |
| `/admin/subscriptions`         | Subscription placeholder   | Partial/future-facing |
| `/admin/settings`              | Platform settings          | Complete              |
| `/dashboard/admin`             | Legacy admin redirects     | Compatibility only    |

## Existing Workflow Map

### Agency

```text
Register
  -> verify email
  -> complete agency profile
  -> submit verification
  -> receive verification decision
  -> create RFQ
  -> matching hotel invitations
  -> receive quotations
  -> review and compare
  -> shortlist/reject/accept
  -> booking
  -> messages and notifications
```

Agency verification gates RFQ creation. RFQ fields, validation, and submission are already
shared through the RFQ feature module.

### Hotel

```text
Register
  -> complete hotel company/profile
  -> admin approval
  -> receive matching RFQ invitation
  -> review or decline
  -> submit/edit/withdraw quote
  -> quote decision
  -> booking when awarded
  -> messages and notifications
```

Hotel access is ownership-based and the hotel directory is not a public marketplace.

### Admin

```text
Login
  -> admin guard
  -> operational overview
  -> review users/agencies/hotels
  -> manage RFQs
  -> inspect subscriptions/settings
  -> monitor activity and statuses
```

Admin pages already use shared management components for metrics, filters, pagination,
status badges, row actions, and detail surfaces.

## Component Inventory

### Reusable product components

- public and authenticated site headers
- site footer and language switcher
- notification bell
- empty and access-denied states
- country, city, agency-type, and phone controls
- hotel photo
- PMS and subscription sections
- waitlist modal
- admin management primitives

### RFQ feature components

- shared RFQ fields
- categories multi-select
- enum selects
- date picker
- requirements field
- shared validation
- shared submit service
- shared search and option definitions

The RFQ architecture is already reusable. V2 should restyle these components in place.

### UI primitives

The repository has a broad Radix/shadcn primitive set. Buttons, cards, inputs, selects,
dialogs, sheets, menus, tabs, tables, tooltips, skeletons, calendars, and feedback
components should be normalized through tokens rather than replaced.

## Current Design and UX Issues

### System-level

1. Page shells are assembled independently for public, authenticated, and admin pages.
2. The authenticated shell uses a desktop-only card sidebar and lacks an intentional
   tablet/mobile workspace navigation model.
3. Spacing, radius, borders, and shadows vary by route.
4. Gold is used both as a premium accent and as a general-purpose surface color.
5. Status tones include an isolated purple scheme outside the core palette.
6. Display typography is used inside dense operational cards where compact sans typography
   would scan better.
7. Some headings use negative letter spacing, which is not appropriate for the bilingual
   typography system.
8. Loading feedback is inconsistent: plain text, card placeholders, and skeletons coexist.
9. Role workspaces do not yet share a common page-header, KPI, activity, or task pattern.

### Public experience

1. The homepage is a very large route component with many presentation sections.
2. Static marketplace statistics appear as if they are live business data.
3. The same trust claims and marketplace metrics are repeated.
4. The quick RFQ is useful and should remain the primary public conversion surface.
5. Public sections are card-heavy and need clearer narrative hierarchy.
6. Public hotel discovery must remain unavailable to guests, agencies, and hotels.

### Agency workspace

1. The dashboard exposes useful counts but does not clearly prioritize the next task.
2. RFQ status, quote progress, booking outcome, messages, and verification are visually
   separated rather than presented as one operational workspace.
3. The quote comparison route contains the right workflow but needs stronger hierarchy and
   scan patterns.

### Hotel workspace

1. Invitations, quotations, hotel profile, PMS, and messages use separate page patterns.
2. The dashboard needs a clearer queue for new invitations and quotes requiring attention.
3. Hotel profile completeness and approval state should be visible without obscuring core
   operations.

### Admin control center

1. Shared table primitives exist, but the admin shell and overview are not yet a unified
   executive operations surface.
2. Table density and detail presentation vary across management pages.
3. Filter toolbars, KPI cards, and row actions need one visual contract.
4. No chart library exists; V2 should use charts only if existing data and a lightweight
   implementation justify them.

### Operational workflows

1. RFQ, quote, booking, messaging, notification, profile, and verification pages need a
   shared status/timeline language.
2. Conversation context should remain visible without imitating a consumer chat app.
3. Status values are semantically rich but their visual mapping is page-specific.

## Duplicate and Inconsistent Patterns

- page title plus description plus actions
- KPI cards
- status badges
- role badges
- section cards
- filter toolbars
- empty/loading/error states
- record detail grids
- responsive row action menus
- sidebar navigation links
- data timestamps and numeric formatting

These patterns should become V2 primitives while retaining current events and data sources.

## What Is Missing

### Design system gaps

- documented semantic color roles
- role-aware workspace shell
- unified page-header system
- shared section and KPI patterns
- universal status and role badge mapping
- consistent data toolbar and record-detail treatment
- responsive workspace navigation
- documented RTL icon and spacing behavior
- documented loading, empty, error, and permission states

### Product UX gaps

- a role-specific workload summary for agency, hotel, and admin users
- consistent lifecycle visualization across RFQs, quotes, and bookings
- a coherent operations pattern for messaging and notifications
- trustworthy public content that avoids unverified statistics
- systematic responsive behavior for dense pages

## Reuse Strategy

V2 will reuse:

- all routes and route guards
- all Supabase queries and mutations
- all RLS and ownership rules
- all forms, schemas, and submit services
- all translation keys and locale ownership
- Radix/shadcn primitives
- Lucide icons
- TanStack Query and Router
- current responsive CSS tooling
- existing admin management components, upgraded into the shared system

No parallel business system or mock-data layer will be introduced.

## Redesign Roadmap

1. Normalize semantic tokens and primitive styling.
2. Build shared page, workspace, metric, status, and data-display components.
3. Refactor public navigation, footer, homepage, and authentication pages.
4. Refactor the agency workspace and RFQ/quote surfaces.
5. Refactor the hotel workspace and hotel-management surfaces.
6. Refactor the admin control center and all management pages.
7. Refactor messaging, notifications, profile, settings, and booking surfaces.
8. Complete LTR, RTL, responsive, accessibility, console, and regression validation.

## Risk Controls

- Preserve query and mutation bodies when moving presentation markup.
- Keep all route paths and guards unchanged.
- Avoid schema migrations.
- Do not expose public hotel discovery.
- Do not fabricate metrics, reviews, hotel inventory, or testimonials.
- Keep bundle growth measurable and avoid new UI/icon/animation libraries.
- Validate each role after every workspace stage.
