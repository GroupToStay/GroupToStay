# GroupToStay → B2B Group Hotel Quotation Marketplace

This plan rebrands the **Organizer** role to **Agency**, removes budget-driven logic, adds a proper quotation marketplace with a comparison view, and refines hotel/agency dashboards. All changes are additive or rename-only at the data layer — existing rows, approvals, messages, RLS, and auth flows are preserved.

---

## 1. Database (single migration, non-destructive)

All renames happen at the **application/UI layer**. At the DB level we keep `organizer` to avoid breaking RLS, triggers, FKs, and existing data.

Additions only:

- `app_role` enum: add value `'agency'` as an **alias** (kept unused for now — existing `organizer` rows remain valid). UI maps `organizer ⇄ agency`.
- `profiles`: add nullable columns
  - `agency_type text` (CHECK in: umrah, hajj, travel, tour_operator, corporate, event, sports, school, government, other)
  - `business_address text`
  - `website text`
  - `city_id uuid references public.cities(id)` (if not already present — verify)
- `rfqs`: add nullable columns
  - `hotel_categories int[]` (multi-select star ratings; null = Any)
  - `accommodation_type text` (CHECK in: hotel, hotel_apartment, resort, any)
  - `meal_plan text` (CHECK in: room_only, bb, hb, fb)
  - `additional_requirements text`
  - Extend status enum/check to include: `draft`, `quoting`, `under_review`, `awarded`. Keep existing `open`, `closed`.
  - **Keep** `budget_*` columns nullable; stop writing to them. No drop.
- `quotes`: add
  - `viewed_at timestamptz`
  - `shortlisted_at timestamptz`
  - `room_type text`
  - `included_services text[]`
  - Status enum already supports pending/accepted/rejected — add `shortlisted`, `viewed` via CHECK extension.

`handle_new_user()` trigger extended to persist `agency_type`, `business_address`, `website` from `raw_user_meta_data`.

No table drops. No data deletions. No RLS rewrites.

## 2. Terminology layer (UI + i18n only)

- Add i18n keys: `role.agency`, `dashboard.agency.*`, etc. in `src/locales/en.json` + `ar.json`.
- Replace all visible "Organizer" strings → "Agency" across routes, components, headers, sidebar, notifications copy.
- Keep code identifiers (`organizer_id`, `is_rfq_organizer`, hooks like `useRoles`) **unchanged** to avoid breaking the codebase. Add a thin helper `roleLabel(role)` that returns "Agency" for `organizer`.

## 3. Registration (`src/routes/auth.tsx`)

- Rename the "Organizer" tab/option to "Agency".
- Add agency fields (when role = agency): Company Name, Contact Person, Business Address, Country, City, Agency Type dropdown, optional Website, optional CR Number, Notes.
- Remove any budget-related copy.
- Hotel signup unchanged (still has PMS section from previous turn).

## 4. Request creation (`src/routes/_authenticated/dashboard.rfqs.new.tsx` + `request-quote.tsx`)

- Country → City cascading dropdowns (reuse `country-city-select.tsx`; no free typing).
- Replace budget inputs with:
  - Hotel Categories (multi-select chips: Any / 1–5★)
  - Accommodation Type
  - Meal Plan
  - Additional Requirements (textarea)
- Submit writes new columns; legacy budget fields sent as null.

## 5. Agency dashboard

- Rename sidebar group "Organizer" → "Agency".
- Sections: Overview, Active Requests, Received Quotations, Awarded Requests, Messages.
- New route `src/routes/_authenticated/dashboard.quotations.tsx` — list all quotations across the agency's RFQs.
- **Comparison screen** `src/routes/_authenticated/dashboard.rfqs.$id.compare.tsx` — side-by-side table (Hotel | Rating | Location | Room Price | Total | Meal Plan | Services | Response Time | Action: Award).
- Awarding a quote sets RFQ status `awarded`, quote status `accepted`, other quotes auto-`rejected` (existing `acceptQuote` mutation extended).

## 6. Hotel dashboard

- New "Open Requests" view filtering matched RFQs (reuse `rfq_invitations` + status `open`/`quoting`).
- Cards show Agency Type, destination, dates, guests, rooms, requirements. Buttons: View Details, Send Quotation.
- Stats cards: New Requests, Active Quotations, Won, Lost, Confirmed Bookings, Revenue.

## 7. Request status lifecycle

- Status transitions handled in mutations:
  - Create → `open` (or `draft` if saved without submit; optional)
  - First quote received → `quoting`
  - Agency opens compare view → `under_review` (soft, optional)
  - Award → `awarded`
  - Manual close → `closed`
- Badge colors updated in status maps.

## 8. Notifications

Extend `create_notification` call sites:

- Hotel: on quote viewed, quote shortlisted, request awarded (already partially exists for accepted).
- Agency: on new quote, on hotel message (already exists).

## 9. Homepage (`src/routes/index.tsx`, `for-hotels.tsx`, `how-it-works.tsx`)

Update hero/marketing copy to:

- "One Request. Multiple Hotel Offers."
- Emphasize verified hotels, competitive quotations, side-by-side comparison.
- Remove any "budget" mentions.

## 10. Admin

No permission changes. Admin lists already show RFQs/quotes/hotels/profiles — add Agency Type column to agency list and surface new RFQ fields (categories, meal plan) read-only.

---

## Out of scope / explicitly preserved

- Auth logic, Supabase RLS policies, approval workflows, PMS section, edge functions, payments (none), existing data, multilingual support, current security memory.

## Technical notes

- DB role string remains `organizer`; UI label is "Agency" via helper.
- Migration is purely additive (`ALTER TABLE ... ADD COLUMN ... NULL`, enum/CHECK extensions). No `DROP`.
- `restrict_profile_company_fields` and `lock_*` triggers untouched.
- i18n keys added in both `en.json` and `ar.json`.

## Files touched

**New**

- `src/routes/_authenticated/dashboard.quotations.tsx`
- `src/routes/_authenticated/dashboard.rfqs.$id.compare.tsx`
- `src/components/agency-type-select.tsx`
- `src/lib/role-label.ts`

**Edited**

- Migration adding columns + extended `handle_new_user()`
- `src/routes/auth.tsx` (Agency registration fields)
- `src/routes/_authenticated/dashboard.rfqs.new.tsx` (remove budget, add new fields)
- `src/routes/_authenticated/dashboard.rfqs.$id.tsx` (status transitions, award flow)
- `src/routes/_authenticated/dashboard.rfqs.index.tsx` (terminology, new columns)
- `src/routes/_authenticated/dashboard.hotel.index.tsx` (stats, open requests)
- `src/routes/_authenticated/dashboard.admin.tsx` (agency type column)
- `src/routes/_authenticated/route.tsx` (sidebar labels + new routes)
- `src/routes/index.tsx`, `for-hotels.tsx`, `how-it-works.tsx`, `request-quote.tsx` (copy)
- `src/locales/en.json`, `src/locales/ar.json`

After approval I'll run the migration first, then ship the code changes in batches.
