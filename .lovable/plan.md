
# GroupToStay — Full MVP Build Plan

A B2B group-accommodation marketplace. Organizers post one RFQ, matched hotels submit quotes, organizer compares, negotiates, and accepts. Bilingual EN/AR with RTL.

Given the size, I'll build it across several turns in this order. Each turn is shippable and testable.

## Roles (Supabase auth + `user_roles` table)
- **organizer** — submits RFQs, reviews quotes, messages hotels, accepts/declines.
- **hotel** — manages hotel profile + rooms, sees matching RFQs, submits/edits quotes.
- **admin** — manages users, hotels, RFQs, featured listings, commission %.
- **guest (public)** — browses hotels, reads how-it-works, submits an RFQ (prompted to register on submit).

## Routes (TanStack Start, file-based)
Public (top-level): `/`, `/how-it-works`, `/for-hotels`, `/pricing`, `/hotels` (browse), `/hotels/$id`, `/request-quote` (guest-friendly RFQ wizard), `/auth`, `/auth/callback`, `/about`, `/contact`.

Protected (`_authenticated/`): `/dashboard` (role-routed), `/dashboard/rfqs`, `/dashboard/rfqs/$id`, `/dashboard/rfqs/new`, `/dashboard/quotes`, `/dashboard/quotes/$id`, `/dashboard/messages`, `/dashboard/hotel` (hotel role: my hotel + rooms), `/dashboard/admin/*` (admin only — users, hotels, rfqs, settings).

## Data model (Supabase, all with RLS + GRANTs)
- `profiles` (id=auth.users, full_name, org_name, phone, country, locale, role-cache)
- `user_roles` (user_id, role enum: organizer|hotel|admin) + `has_role()` SECURITY DEFINER fn
- `hotels` (owner_id, name, slug, city, country, address, lat/lng, star_rating, description, amenities[], cover_image, gallery[], status: pending|approved|suspended, featured boolean)
- `hotel_rooms` (hotel_id, room_type, capacity, count_available, base_price, currency)
- `rfqs` (organizer_id, title, group_type enum: umrah|hajj|tourism|corporate|government|sports|education|event|other, destination_city, destination_country, check_in, check_out, nights, guests_count, rooms_needed, room_type_pref, board_type enum: room_only|breakfast|half_board|full_board, budget_min, budget_max, currency, special_requirements, status enum: draft|open|closed|awarded|cancelled, deadline)
- `rfq_invitations` (rfq_id, hotel_id, status: pending|viewed|quoted|declined) — auto-created by matching
- `quotes` (rfq_id, hotel_id, total_price, price_per_room_night, currency, board_included, inclusions, valid_until, notes, status: submitted|shortlisted|accepted|rejected|withdrawn)
- `messages` (rfq_id, sender_id, recipient_id, body, created_at) — direct negotiation thread per RFQ↔hotel pair
- `bookings` (rfq_id, quote_id, organizer_id, hotel_id, total_amount, commission_amount, status: confirmed|cancelled|completed, contract_url)
- `platform_settings` (key, value json) — commission %, featured price, etc.

Matching: when an RFQ is created with status `open`, a trigger inserts `rfq_invitations` for every approved hotel where `city = rfq.destination_city`. Hotels then see them in their dashboard.

## Server functions (`src/lib/*.functions.ts`)
- `rfqs.functions.ts`: createRfq, listMyRfqs, getRfq, closeRfq, awardQuote
- `quotes.functions.ts`: submitQuote, listQuotesForRfq, listMyQuotes, updateQuoteStatus
- `hotels.functions.ts`: listHotels (public, filterable), getHotel, upsertMyHotel, listInvitations
- `messages.functions.ts`: sendMessage, listThread
- `admin.functions.ts`: listUsers, setRole, approveHotel, suspendHotel, setFeatured, updateSettings
All authenticated fns use `requireSupabaseAuth`; admin fns also check `has_role`.

## Design system
Tokens in `src/styles.css` using the brand palette (oklch equivalents of #0F172A primary, #D4AF37 gold secondary, slate neutrals, semantic success/warning/error). Inter for UI + Playfair Display for hero/display. Custom shadcn variants: `Button` (default, gold, outline, ghost, hero), `Badge` (status colors), `Card` (elevated, premium). Generated hero image of a luxury hotel lobby + group meeting.

## i18n / RTL
- `react-i18next` with `en` and `ar` resource bundles.
- Locale persisted in `profiles.locale` (or `localStorage` for guests).
- `<html lang>` + `dir="ltr|rtl"` toggled at the root route.
- Language switcher in header.
- All UI strings come from translation keys from day one.

## Build order (turn-by-turn)
1. **This turn**: design system + landing page + how-it-works + for-hotels + pricing + i18n scaffolding + EN/AR + RTL toggle + auth page wired to Supabase + hero imagery. Schema migration (all tables, RLS, grants, trigger). Public hotels browse page (reads approved hotels). Guest RFQ wizard (saves to DB, requires auth on submit).
2. **Next**: organizer dashboard (RFQ list, detail, quotes comparison, messaging, accept/award).
3. **Next**: hotel dashboard (profile + rooms, invitations inbox, submit quote, my quotes, messages).
4. **Next**: admin dashboard (users, hotels approval, featured, settings, RFQ oversight).
5. **Polish**: notifications (toasts + in-app), full Arabic copy pass, empty states, loading, error boundaries on every route, SEO meta per route, sitemap.xml, robots.txt.

## Out of scope for v1 (called out so expectations are clear)
- Real payments / Stripe — bookings record commission but no charge.
- File uploads for contracts — placeholder URL field (can wire Supabase Storage next).
- Email notifications — toasts only in v1.
- Mobile native app — web only, fully responsive.

## Approve to proceed
On approval I'll execute turn 1 (design system, schema migration, public site, auth, guest RFQ flow, i18n+RTL). Each subsequent turn builds the next dashboard. Tell me if you want any reordering, role removed, or features cut.
