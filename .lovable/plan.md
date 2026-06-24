# PMS Information Collection — Additive Only

This change is **purely additive**. No existing workflow, permission, or RLS policy changes. Organizers and Admins keep current capabilities; Hotel users keep all current functionality and gain new optional PMS fields.

## Scope

Collect PMS metadata from hotel companies for future integration planning. No API connection, no sync, no availability logic changes.

## 1. Database (single migration)

Add to `public.profiles` (hotel company profile lives here today alongside `company_name`, `vat_number`, `cr_number`):

- `pms_enabled boolean` — null/true/false
- `pms_provider text` — preset name or "Other"
- `pms_provider_other text` — free text when provider = Other
- `api_available text` — CHECK in ('Yes','No','Not Sure') or null
- `technical_contact_name text`
- `technical_contact_email text`
- `technical_contact_phone text`

All nullable, no defaults beyond null. **No new RLS policies needed** — existing profile RLS already restricts a hotel user to their own row, admins via `has_role`, and blocks organizers. Existing `restrict_profile_company_fields` trigger is unaffected (we don't touch its locked columns).

## 2. Hotel Company Registration (`src/routes/auth.tsx`)

Append a new optional "Property Management System" section to the hotel signup form, after the existing company fields:

- Radio: "Do you use a PMS?" → Yes / No
- If **No** or unset: nothing more shown; submit with `pms_enabled = false` (or null if untouched)
- If **Yes**:
  - Provider dropdown: MyCloud PMS, Oracle Opera PMS, Cloudbeds, Mews, eZee Absolute, Hotelogix, Protel, Other
  - If Other → "Please specify" text input
  - API Available dropdown: Yes / No / Not Sure
  - Technical Contact Name / Email / Phone (email + phone validated client-side with zod)

Values pass through `raw_user_meta_data`; extend `handle_new_user()` trigger to persist them into `profiles`.

## 3. Hotel Profile Edit (`src/routes/_authenticated/dashboard.profile.tsx`)

Add a new "PMS Information" card below existing company section. Same fields as registration, editable and saved via existing profile update path. Visible only when the user has the hotel role (no UI change for organizers/admins viewing their own profile).

## 4. Admin Company Review (`src/routes/_authenticated/dashboard.admin.tsx`)

Extend the company select query with the new columns and add a "PMS Information" block inside each company card displaying: Uses PMS, Provider (+ Other text), API Available, Technical Contact Name / Email / Phone. Read-only display.

## 5. Admin PMS Statistics Widget

New "PMS Statistics" card on the admin dashboard showing counts grouped by `pms_provider` (including "Other" and "Not specified"). Implemented as a client-side aggregation over the already-fetched company list — no new server function, no schema change.

## 6. Hotel Dashboard — PMS Integration Placeholder

New route `src/routes/_authenticated/dashboard.hotel.pms.tsx` (linked from the hotel dashboard nav as "PMS Integration"):

- Status badge: **Not Connected**
- Informational copy: "PMS synchronization will become available in a future release."
- No buttons, no actions.

## 7. Security / Validation

- Zod schemas on registration + profile forms: email format, phone digits/length, required fields enforced only when `pms_enabled = true`.
- RLS: relies on existing profile policies — hotel sees own row, admin sees all, organizer blocked. No new grants.
- All new columns nullable so existing rows and existing insert paths keep working.

## 8. Non-regression

No edits to: organizer flows, RFQs, hotels table, quotes, bookings, messaging, notifications, subscriptions, auth gates, search, hotel CRUD, approval triggers. Migration only adds nullable columns + extends one trigger function — no policy or constraint changes on existing columns.

## Technical Notes

- Files touched: `src/routes/auth.tsx`, `src/routes/_authenticated/dashboard.profile.tsx`, `src/routes/_authenticated/dashboard.admin.tsx`, new `src/routes/_authenticated/dashboard.hotel.pms.tsx`, plus i18n keys in `src/locales/en.json` and `src/locales/ar.json`.
- One migration: add 7 columns to `profiles` + `CREATE OR REPLACE FUNCTION handle_new_user()` extending the existing INSERT with the new fields from `raw_user_meta_data`.
- `src/integrations/supabase/types.ts` regenerates automatically post-migration.
