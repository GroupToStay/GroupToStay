# GroupToStay V2 Design System

## Design Direction

GroupToStay V2 combines premium hospitality cues with the clarity and efficiency of an
enterprise operations product.

The visual system is:

- confident rather than decorative
- premium through proportion, typography, and restraint
- dense enough for repeated operational use
- warm enough for hospitality
- consistent across public, agency, hotel, and admin surfaces
- fully bilingual and direction-aware

## Brand Principles

1. Navy creates trust and anchors navigation and primary actions.
2. Gold signals premium value, verification, and high-value moments.
3. Neutral surfaces carry most product work.
4. Semantic colors communicate status, never decoration.
5. Public pages may be editorial; workspaces remain quiet and task-focused.
6. One icon family, one radius system, one spacing system.

## Color System

### Brand

| Token                | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| `primary`            | Core navy, primary actions, selected navigation |
| `primary-foreground` | Text and icons on navy                          |
| `gold`               | Premium CTA, verified/high-value accents        |
| `gold-foreground`    | Content on gold                                 |
| `brand-blue`         | Informational brand accent used sparingly       |

### Neutral surfaces

| Token        | Purpose                                     |
| ------------ | ------------------------------------------- |
| `background` | Primary page background                     |
| `surface`    | Workspace canvas and secondary page bands   |
| `card`       | Individual framed records and tools         |
| `secondary`  | Subtle controls and selected-neutral states |
| `muted`      | Quiet backgrounds and disabled states       |
| `border`     | Dividers and component boundaries           |

### Semantic

| Token     | Purpose                                       |
| --------- | --------------------------------------------- |
| `success` | Verified, accepted, approved, active, awarded |
| `warning` | Pending, submitted, review required, expiring |
| `error`   | Rejected, cancelled, suspended, destructive   |
| `info`    | Viewed, informational, in progress            |

Gold is not a success color. Success remains green. Gold is reserved for premium brand
moments, a winning quote, or a primary public conversion action.

## Typography

### Families

- Interface: Inter
- English display: Playfair Display
- Arabic interface and display: Tajawal

### Usage

| Style       | Use                                             |
| ----------- | ----------------------------------------------- |
| Display     | Public hero and major editorial statements only |
| H1          | Page title                                      |
| H2          | Major page section                              |
| H3          | Section or record-group title                   |
| H4          | Compact panel heading                           |
| Body        | General content                                 |
| Small       | Secondary details and helper text               |
| Caption     | Timestamps, metadata, table support text        |
| Label       | Form and filter labels                          |
| Numeric/KPI | Tabular sans numerals with strong weight        |

Operational cards, tables, sidebars, and compact panels use sans typography. Display type
must not be used merely to make a small card look important.

Letter spacing is `0`. Uppercase labels are avoided for Arabic and used sparingly in English.

## Spacing

The system uses a 4px base:

| Token | Value | Typical use                     |
| ----- | ----- | ------------------------------- |
| 1     | 4px   | icon/text micro-gap             |
| 2     | 8px   | compact controls                |
| 3     | 12px  | dense rows                      |
| 4     | 16px  | standard component padding      |
| 5     | 20px  | card padding                    |
| 6     | 24px  | page and section gap            |
| 8     | 32px  | desktop page spacing            |
| 10    | 40px  | major public section separation |
| 12    | 48px  | large public section separation |
| 16    | 64px  | editorial separation            |

### Page margins

- Mobile: 16px
- Tablet: 24px
- Desktop workspace: 24px to 32px
- Public maximum content width: 1280px
- Admin management pages use the available width

## Radius

- Small controls and compact tags: 4px
- Inputs, buttons, cards, menus, and panels: 6px to 8px
- Circular avatars, indicators, and icon-only status dots: full

Page sections are not floating cards. Nested cards are not allowed.

## Borders and Shadows

- Borders create most structure.
- `shadow-sm` is allowed for menus, sticky toolbars, and elevated records.
- Larger shadows are limited to modals, sheets, and public conversion surfaces.
- Gold-tinted shadows are limited to premium public CTAs and never used in data tables.

## Icon System

Lucide is the only icon family.

| Context          | Size       |
| ---------------- | ---------- |
| Inline label     | 14 to 16px |
| Button           | 16px       |
| Navigation       | 18px       |
| Page-header icon | 20px       |
| Empty state      | 24 to 32px |

Icons inherit color. Meaningful icon-only buttons require localized accessible labels and
tooltips when the symbol is not universally understood.

## Core Components

### Buttons

- Primary navy for clear product commands.
- Gold for the most important public conversion action and exceptional premium actions.
- Outline for secondary commands.
- Ghost for low-emphasis navigation and toolbar actions.
- Destructive for irreversible actions.
- Icon buttons use stable square dimensions and localized labels.

### Inputs and selects

- Minimum 40px height on desktop and 44px touch target on mobile.
- Labels remain visible; placeholders never replace labels.
- Validation appears next to the field and is announced accessibly.
- Focus uses the semantic ring token.

### Cards

Cards frame individual repeated records, metrics, dialogs, or tools. Whole page sections remain
unframed. Cards use an 8px maximum radius, one border, and restrained elevation.

### Status badges

Status badges always include:

- semantic color
- icon where scanning benefits
- localized label
- compact, stable height

Status vocabulary is centralized across RFQs, quotes, bookings, verification, invitations,
accounts, and hotels.

### Tables

- Primary information remains visible.
- Secondary information moves into a detail sheet on constrained widths.
- Actions use a three-dot menu.
- Headers are sticky where the surrounding layout supports it.
- Numeric values align consistently.
- Mobile transforms records into stacked list rows/cards when necessary.

### Loading, empty, and error states

- Loading uses stable skeleton dimensions.
- Empty states explain the state and offer one relevant action.
- Errors state what failed and provide a retry when possible.
- Access denied remains distinct from an empty result.

## Navigation

### Public header

- Brand is always visible.
- Public links collapse before clipping.
- Authentication actions wait for session and role initialization.
- Role-inappropriate CTAs are never shown.

### Workspace shell

- Desktop uses a persistent left navigation rail and compact top bar.
- Tablet uses a collapsible navigation surface.
- Mobile uses a sheet or drawer with stable touch targets.
- Page content begins with a shared page header.
- Agency, hotel, and admin have distinct labels and relevant navigation, not different visual
  systems.

### Breadcrumbs

Use breadcrumbs on deep record routes such as RFQ details, quote comparison, hotel editing,
and management details. Do not repeat the current page as a second visible title.

## Role Experience

### Guest

Public narrative, trust, how it works, pricing, contact, sign in, registration, and public RFQ
entry where currently supported.

### Agency

Prioritize request creation, active RFQs, received quotations, awarded outcomes, messages,
notifications, and verification status.

### Hotel

Prioritize invitations, quotes requiring action, won business, hotel readiness, messages, and
notifications.

### Admin

Prioritize operational queues, verification, RFQ health, accounts, hotels, subscriptions, and
system settings.

## Business Components

### RFQ summary

Shows status, destination, dates, group size, rooms, categories, quote count, and next action.

### RFQ timeline

Uses existing lifecycle data when available. No events are fabricated.

### Quote card and comparison

Highlights total price, rate details, meals, inclusions, validity, hotel, and status. Existing
actions remain unchanged.

### Booking summary

Shows existing booking status, hotel, agency, dates, group details, and related conversation.

### Conversation item

Shows participant/context, last message, timestamp, and unread state. The design is a
professional workspace, not a consumer chat clone.

### Notification item

Shows category, read state, time, message, and safe route target.

## Responsive Rules

### Mobile

- Single-column page flow
- 44px minimum touch targets
- Full-width primary actions where appropriate
- Stacked filters with a compact disclosure for advanced options
- Data records become responsive rows/cards
- No page-level horizontal scrolling

### Tablet

- Navigation remains collapsed until labels fit safely
- Two-column KPI and summary grids
- Detail panels may use sheets
- Form fields use one or two columns based on available width

### Desktop

- Persistent workspace navigation
- Dense, readable operational tables
- Full-width admin content
- Public content constrained to readable measures

Stable grid tracks, aspect ratios, and min/max constraints prevent layout shifts.

## RTL and LTR

- Use logical properties (`ms`, `me`, `ps`, `pe`) for directional spacing.
- Directional arrows and chevrons mirror when their meaning is spatial.
- Non-directional business icons do not mirror.
- Numeric content uses locale formatting without changing stored values.
- Tables preserve semantic column order and direction-aware alignment.
- Sidebar position follows document direction only when it improves navigation consistency.
- Calendar and date controls continue to use the application locale as the single source.

## Accessibility

- WCAG AA contrast target
- visible focus states
- semantic headings in order
- explicit form labels and errors
- keyboard-operable menus, dialogs, tabs, and comboboxes
- localized accessible names
- sufficient touch targets
- reduced-motion support
- status information is never color-only

## Motion

- 120ms to 200ms transitions for hover, focus, menu, and sheet states
- opacity and small position transitions only
- no motion that delays a primary operation
- honor `prefers-reduced-motion`

## Performance Rules

- No second component, icon, chart, or animation library without measured need.
- Preserve current route splitting.
- Keep authenticated-only code out of public entry paths.
- Lazy-load non-critical media.
- Avoid duplicated formatters and status maps.
- Do not introduce speculative memoization.

## Implementation Contract

1. Presentation refactors must preserve handlers, queries, mutations, and guards.
2. Shared components accept rendered content and callbacks; they do not own business rules.
3. Translation keys remain the only user-visible text source.
4. No database migration is part of the V2 redesign.
5. Each stage must pass formatting, TypeScript, ESLint, tests, and production build checks.
