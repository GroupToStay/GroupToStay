# Next.js Route Migration

## Runtime model

Next.js 16 App Router owns route matching, metadata, redirects, authentication, and role gates.
Existing screen components remain reusable client components while the migration settles; App Router
pages import those components directly. No page renders through a legacy route-object wrapper.

Supabase authentication uses `@supabase/ssr` browser/server clients with the public key only. The
request proxy refreshes cookies and preserves safe deep-link return paths. The authenticated layout
validates the user again before rendering. PostgreSQL RLS remains the final data authorization layer.

## Route contracts

| Route group | Previous TanStack behavior | Next.js behavior | Authorization | Redirect/test invariant |
| --- | --- | --- | --- | --- |
| `/`, `/about`, `/contact`, `/pricing`, `/trust`, legal pages | Public component plus route head | Server page metadata plus imported client screen | Public | Canonical metadata and public smoke tests |
| `/auth` | Search validation and authenticated redirect | Proxy validates redirect and redirects authenticated sessions | Public until signed in | External and recursive redirects rejected |
| `/request-quote`, `/requests/*` | Public RFQ pages with validated search | Native pages; existing form validation remains in the screen | Public/RLS | Invalid search values use domain defaults |
| `/hotels/*`, `/hotel-list` | Public route with existing role-sensitive screen | Native pages and safe metadata | Existing screen plus RLS | No raw internal data for unauthorized users |
| `/subscription/checkout` | `beforeLoad` redirect | Native `redirect()` | Public | Always redirects to `/subscription/coming-soon` |
| `/dashboard/*` | Authenticated parent `beforeLoad` | Proxy plus server authenticated layout | Authenticated | Unauthenticated deep links return through `/auth?redirect=` |
| `/dashboard/rfqs/*` | Organizer-only parent route | Server organizer layout | Agency/Organizer | Hotel/Admin redirected to `/dashboard` |
| `/dashboard/hotel/*`, `/dashboard/invitations` | Hotel-only `beforeLoad` | Server Supplier layouts | Hotel/Supplier | Agency/Admin redirected to `/dashboard` |
| `/dashboard/negotiations`, `/deals/*` | Deal RLS and organization authority | Server marketplace-participant layout plus RLS | Active marketplace users | Platform Admin cannot become a participant |
| `/dashboard/bookings/*`, `/dashboard/messages/*` | Authenticated routes with RLS | Authenticated server layout plus unchanged RLS screens | Authenticated/RLS | Deep links survive refresh |
| `/admin/*` | `requireAdminPermission` in `beforeLoad` | Server admin layout and per-page permission checks | Platform Admin permission | Denied users redirect before screen render |
| `/dashboard/admin` | Legacy tab redirect | Native server redirect map | Platform Admin | Unknown tab redirects to `/admin` |
| `/dashboard/profile`, `/admin/settings` | Legacy redirects | Native server redirects | Authenticated; admin settings also requires permission | Query target preserved |

## Public configuration

Browser configuration is limited to `NEXT_PUBLIC_SUPABASE_URL`, one public Supabase key, and
`NEXT_PUBLIC_V3_DEAL_ACTIVATION_ENABLED`. Legacy `VITE_*` values intentionally fail validation so a
Next build cannot silently ship without configuration. Service-role keys, database credentials, and
management tokens are never imported into the application runtime.

## Localization and metadata

The `gts_lang` cookie supplies the initial HTML `lang` and `dir`. Client language changes update the
same cookie and refresh the route without changing URLs. English and Arabic catalogs retain their
individual namespaces and the merged compatibility namespace used by existing screens.

Next Metadata APIs own titles, canonical URLs, Open Graph data, robots, sitemap, and homepage
structured data. The canonical origin is `https://group-to-stay.vercel.app`.

## Build provenance

Build metadata is generated before `next build` into `public/build-metadata.json`, which Next copies
into the deployment. The verification copy remains under `.output/public`. Only version, Git SHA,
branch, environment, timestamp, Node, and pnpm are serialized.
