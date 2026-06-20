# Phase 4 — Platform Overhaul

A large multi-part change spanning registration UX, dashboards, hotel management, subscriptions (Coming Soon + waitlist), admin review workflows, and role-based security. Scope is large so I'm grouping by part with the concrete files and DB changes.

---

## Part 1 — Registration Improvements (Organizer + Hotel signup)

**Files:** `src/routes/auth.tsx` (and any shared signup form components)

- Replace free-text phone with **CountryCode dropdown + phone input** component (new: `src/components/phone-input.tsx`). Codes: SA +966, EG +20, AE +971, QA +974, KW +965, BH +973, OM +968 (+ a longer GCC/MENA list).
- Store `country_code` and `phone_number` separately on `profiles`; compute `full_phone` on submit.
- Remove free-text country; use existing `useCountries()` master data → store `country_id` on `profiles`.
- Organizer ID Type select: **Saudi National ID | Iqama**. Number input: digits only, hard cap 10 chars (no helper text shown).

**DB:** add `profiles.country_code text`, `profiles.phone_number text`, `profiles.country_id uuid references countries(id)`. Keep existing `phone`/`country` for back-compat (populated from new fields).

---

## Part 2 — Organizer Dashboard

**Files:** `src/routes/_authenticated/dashboard.tsx` (sidebar), `src/routes/_authenticated/dashboard.profile.tsx`

- Sidebar label: "Organization Settings" → **"My Profile"** for organizers.
- Profile page: editable Name, Email, Phone (country code + number). Remove editable country field (display-only, derived from signup).

---

## Part 3 — Hotel User Dashboard

### 3a. Hotel Profile Management (approved hotels editable)
**Files:** `src/routes/_authenticated/dashboard.hotel.$id.tsx`

- Allow approved hotel owners to edit: name, description, city/country, contact, amenities (multi-select), rooms (CRUD via `hotel_rooms`), images (upload/replace/delete via `hotel-photos` bucket).
- All writes go to Supabase; respect RLS (owner_id = auth.uid()).

### 3b. Subscription (Coming Soon + Waitlist) — per UPDATE block
**Files:**
- New `src/routes/subscription.coming-soon.tsx` (public route under `/subscription/coming-soon`)
- New `src/routes/subscription.checkout.tsx` → redirects to coming-soon while flag off
- New `src/components/waitlist-modal.tsx`
- Update `src/routes/_authenticated/dashboard.hotel.index.tsx` (subscription cards)
- Update `src/routes/pricing.tsx` (hide organizer plan from hotel users; CTA = Coming Soon + Notify Me)

Behavior:
- Hide "Hotel Free Listing" if hotel exists; show "Create Hotel Profile" if not.
- Replace all Upgrade/Pay buttons with **Coming Soon** (primary) + **Notify Me** (secondary).
- "Notify Me" opens modal → inserts into `subscription_interest` with `requested_plan` = professional|featured.
- Display "Payment Services Launching Soon" badge.
- Feature flag `subscriptions_enabled` in `platform_settings` (default false). When false → checkout redirects to coming-soon. Payment gateway code stubs prepared but not invoked.

**DB:**
```sql
CREATE TABLE public.subscription_interest (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  hotel_id uuid references public.hotels(id) on delete set null,
  full_name text not null,
  email text not null,
  hotel_name text,
  requested_plan text not null check (requested_plan in ('professional','featured')),
  status text not null default 'waiting' check (status in ('waiting','notified')),
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
-- GRANTs + RLS: authenticated insert (own user_id or null), admin select/update all.
-- Insert seed row: platform_settings('subscriptions_enabled','false').
```

---

## Part 4 — Hotel User Profile
Same as Part 2 profile rules (no editable country, phone uses country-code component).

---

## Part 5 — Admin Main Navigation
**Files:** `src/components/site-header.tsx`

- When current user has admin role: hide public links (Hotels, Contact, For Hotels, How It Works, Pricing, About). Show only Dashboard, Admin Functions, Sign Out.

---

## Part 6 — Admin Review: Hotel Companies
**Files:** `src/routes/_authenticated/dashboard.admin.tsx` + new `src/routes/_authenticated/dashboard.admin.company.$id.tsx`

- Tabs: Pending / Approved / Rejected.
- "View Company" button → review page (CR, VAT, contact, docs).
- **Approve** → status `approved` (locked: trigger blocks further status changes).
- **Reject** → status `rejected` (allow "Reconsider" → back to pending → approve allowed).

**DB:** trigger on `profiles.hotel_approval_status` rejecting transitions away from `approved`.

---

## Part 7 — Admin Review: Hotel Listings
**Files:** existing admin hotel tab + new `src/routes/_authenticated/dashboard.admin.hotel.$id.tsx`

- Tabs: Pending / Approved / Suspended.
- **Approve** → status `approved` (locked).
- **Reject** → status `suspended` (final). Detach from owner so owner may create a new hotel (set `owner_id = null` and `archived = true`), previous hotel remains visible in admin archive.

**DB:** add `hotels.archived boolean default false`; trigger preventing leaving `approved`; allow null owner_id transition on suspend.

---

## Part 8 — Admin Review Pages
Covered by the new dedicated review routes in Parts 6 & 7 with "View Company" / "View Hotel" buttons in admin lists.

---

## Part 9 — Admin Settings
**Files:** `dashboard.profile.tsx`

- If user has `admin` role: render read-only view (Name, Email, Country, Phone). No edit controls.

---

## Part 10 — Security & Role Enforcement

**Files:** `src/routes/_authenticated/route.tsx` (or per-route `beforeLoad`), `src/components/access-denied.tsx`

- Add role gates on every dashboard route:
  - Organizer-only: `dashboard.rfqs.*`, `dashboard.invitations`
  - Hotel-only: `dashboard.hotel.*`
  - Admin-only: `dashboard.admin.*`
- Hide unauthorized sidebar items.
- Backstop with RLS (already in place via `has_role`).

---

## Technical notes

- One Supabase migration covers: new profile columns, `subscription_interest` table + GRANTs/RLS, `platform_settings` seed for `subscriptions_enabled`, `hotels.archived` column, status-lock triggers for company + hotel approval.
- Phone component + country-code list shared between signup and profile pages.
- Payment gateway integration kept as type-only stub (`src/lib/payments/`) with no network calls until feature flag is on.
- All new tables/columns: timestamps + update triggers; RLS scoped to `auth.uid()` and `has_role`.

---

## Order of execution
1. DB migration (one batch).
2. Shared components: `PhoneInput`, `WaitlistModal`, payment stub module.
3. Registration + profile pages.
4. Hotel dashboard management editing + subscription cards.
5. Coming-Soon route + checkout redirect.
6. Admin review pages + status-lock UI.
7. Site header role-aware nav + per-route role guards.
8. QA pass: build + manual smoke of each flow.
