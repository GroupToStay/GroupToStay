# GroupToStay V2 - Production Readiness Report

## PHASE

GroupToStay V2 - Final Acceptance QA & Production Readiness Certification

## SUMMARY

GroupToStay V2 is **not ready for production**.

The public experience, external Supabase master data, English/Arabic rendering,
guest route protection, local production build, and local production-style
preview are operational. However, production certification is blocked by:

1. The current V2 commit is not deployed to the supplied Vercel Preview.
2. No Agency, Hotel, or Admin credentials were available for role-based
   end-to-end acceptance testing.
3. Quote awarding is implemented as three independent browser-side writes and
   is not atomic.
4. Required hotel quote lifecycle actions are absent from the current UI.
5. Awarded bookings have no booking management route or workspace.

No application fix, database write, migration, commit, push, merge, or deployment
was performed during this certification.

## TEST BASELINE

| Item                            | Value                                                        |
| ------------------------------- | ------------------------------------------------------------ |
| Local branch                    | `feature/grouptostay-v2-design`                              |
| Local commit                    | `912a9f7ff37363fdcd578154cf02ffa879149600`                   |
| Local preview                   | `http://127.0.0.1:4190/`                                     |
| External Supabase project       | `atxecflhmphaqqkatjlm`                                       |
| Supabase URL                    | `https://atxecflhmphaqqkatjlm.supabase.co`                   |
| Supplied Vercel Preview         | `https://group-to-stay-3pkx353qb-mohamed-ramadan.vercel.app` |
| Vercel source observed          | `fix/critical-production-blockers-preview` at `2deb2be...`   |
| Vercel deployment date observed | July 15, 2026                                                |
| V2 branch on GitHub remote      | Not found                                                    |

The Vercel Preview is both stale relative to the local V2 commit and protected by
Vercel SSO for unauthenticated automation. It cannot serve as a valid V2
production-candidate environment.

## WHAT ALREADY EXISTS

- TanStack Start/React application with SSR public routes and client-only
  authenticated workspace routes.
- Supabase authentication, role lookup, RLS-backed data access, Realtime
  messaging, notifications, file attachments, RFQs, quotes, invitations, and
  booking records.
- English and Arabic catalogs with cookie-backed SSR locale ownership.
- Guest, organizer/agency, hotel, and admin navigation structures.
- Agency verification checks before RFQ insertion.
- Admin management pages for users, hotel companies, hotel listings, agency
  verification, group requests, subscriptions, and settings.
- Safe internal notification-link filtering.
- Production security headers and CSP middleware.
- Local production preview command using the generated `.output` server.

## WHAT IS MISSING

- A Vercel Preview built from the current V2 commit.
- Credentials or an isolated test fixture for each authenticated role.
- Atomic quote award/booking transaction.
- Quote edit, withdrawal, and invitation-decline actions in the hotel workspace.
- Booking list/detail/management routes.
- Agency RFQ editing.
- Dedicated Admin Quotes, Bookings, Reports, Audit Logs, Security, System Health,
  and Analytics pages.
- Explicit organizer-only authorization for `/dashboard/quotations`.

## BLOCKER FINDINGS

### QA-ENV-001 - Current V2 is not deployed to the acceptance environment

**Description:** The supplied Vercel Preview does not contain the current V2
branch/commit.

**Steps to reproduce:**

1. Inspect the supplied Vercel deployment.
2. Compare its source branch/commit to the local V2 branch and commit.
3. Query the GitHub remote for `feature/grouptostay-v2-design`.

**Affected roles:** All.

**Evidence:** Vercel reports `fix/critical-production-blockers-preview` at
`2deb2be...`; local V2 is `912a9f7...`; no remote V2 branch exists.

**Root cause:** The V2 branch has not been pushed and no preview has been created
from it.

**Recommended fix:** After owner approval, push the V2 branch and create a new
non-production Vercel Preview with the external Supabase public environment
variables. Repeat this complete certification against that immutable preview.

### QA-RFQ-001 - Quote award flow is non-atomic and incomplete

**Description:** Accepting a quote performs three independent client-side writes:
accept quote, insert booking, award RFQ. A failure between writes leaves
contradictory business records. Competing active quotes are not explicitly
rejected in these mutations.

**Steps to reproduce:**

1. Inspect the award mutation in the RFQ detail page.
2. Inspect the award mutation in the quote comparison page.
3. Observe the separate `quotes.update`, `bookings.insert`, and `rfqs.update`
   calls without an RPC/transaction.

**Affected roles:** Agency, Hotel, Admin support.

**Files:**

- `src/routes/_authenticated/dashboard.rfqs.$id.tsx:114`
- `src/routes/_authenticated/dashboard.rfqs.$id.tsx:117`
- `src/routes/_authenticated/dashboard.rfqs.$id.tsx:128`
- `src/routes/_authenticated/dashboard.rfqs.$id.compare.tsx:47`
- `src/routes/_authenticated/dashboard.rfqs.$id.compare.tsx:50`
- `src/routes/_authenticated/dashboard.rfqs.$id.compare.tsx:61`

**Root cause:** Award orchestration is owned by the browser instead of a single
database transaction/RPC.

**Recommended fix:** Implement one authenticated, RLS-aware transactional RPC
that verifies ownership and current states, accepts the winner, rejects active
competitors, creates exactly one booking, awards the RFQ, and emits notifications
and lifecycle events atomically. This requires a separately approved business
logic/database phase.

### QA-RFQ-002 - Hotel quote lifecycle actions are unavailable

**Description:** The Hotel Invitations page supports quote submission but has no
implemented controls for invitation decline, quote editing, or quote withdrawal.

**Steps to reproduce:**

1. Open `src/routes/_authenticated/dashboard.invitations.tsx`.
2. Search for `declined`, `withdrawn`, edit-quote mutations, or corresponding
   actions.
3. Only submission UI is present; status badges alone know these states.

**Affected roles:** Hotel and Agency.

**Root cause:** Lifecycle statuses exist in shared types/badges and migrations,
but operational UI/mutations were not integrated into the V2 workspace.

**Recommended fix:** Complete the existing lifecycle using the current quotes,
invitations, notifications, and lifecycle-event infrastructure. Do not create a
parallel system.

### QA-BOOK-001 - No booking management experience exists

**Description:** A booking row can be created during award, but there is no
booking list, booking detail, or management route for participants.

**Steps to reproduce:**

1. Inventory `src/routes`.
2. Search for a route created for bookings.
3. Observe that booking access is limited to dashboard statistics and the award
   insert.

**Affected roles:** Agency, Hotel, Admin.

**Root cause:** The data model exists, but the booking product surface was never
implemented.

**Recommended fix:** Add role-protected booking list/detail workspaces that reuse
the existing booking table and permissions. This is a product implementation
phase, not a QA patch.

### QA-CERT-001 - Authenticated role workflows could not be certified

**Description:** No Agency, Hotel, or Admin credentials/session were available.
Creating new accounts would write production-like data and was intentionally not
done.

**Affected coverage:** Agency, Hotel, Admin, RFQ submission, quote lifecycle,
booking creation, realtime messaging, notifications, uploads, and authenticated
RLS isolation.

**Root cause:** The acceptance environment lacks documented isolated QA accounts
or a seeded disposable test tenant.

**Recommended fix:** Provide one non-production test account per role in the
current external Supabase staging project, with representative hotel/agency
profiles and safe `TEST_` records. Re-run the complete matrix.

## HIGH FINDINGS

### QA-AUTH-001 - Register links open Sign In instead of Sign Up

**Description:** `/auth?mode=signup` renders Sign In. Both desktop and mobile
header Register links use this query.

**Steps to reproduce:**

1. As a guest, select Register.
2. Confirm the URL is `/auth?mode=signup`.
3. Observe the heading and form remain Sign In.

**Affected roles:** Guest/new Agency/new Hotel.

**Root cause:** `validateSearch` accepts only `redirect`; `mode` is not parsed,
and component state always initializes to `"signin"`.

**Files:**

- `src/routes/auth.tsx:17`
- `src/routes/auth.tsx:59`
- `src/routes/auth.tsx:71`
- `src/components/public-site-header.tsx:75`
- `src/components/public-site-header.tsx:119`

**Recommended fix:** Type and validate `mode`, initialize the component from the
validated route search, and keep query/state synchronized without hydration
divergence.

### QA-AUTHZ-001 - Users with no role are treated as Agencies in the UI

**Description:** Any authenticated account with an empty `user_roles` result is
classified as organizer/agency.

**Steps to reproduce:** Inspect `useRoles()` and observe
`roles.includes("organizer") || roles.length === 0`.

**Affected roles:** Unassigned/visitor authenticated users.

**Root cause:** A convenience fallback conflates “no role” with organizer.

**File:** `src/hooks/use-role.tsx:23`

**Security impact:** Agency navigation and actions can be exposed to an unassigned
account. RLS may reject writes, but UI authorization is incorrect and creates a
broken-access-control surface.

**Recommended fix:** Use an explicit unassigned/visitor state. Require the
organizer role for organizer navigation and actions.

### QA-AUTHZ-002 - Agency quotations route lacks an explicit role guard

**Description:** `/dashboard/quotations` is authenticated but not organizer-only.
Hotels/admins may navigate to the Agency quotations surface and rely on query
ownership/RLS to return nothing.

**Affected roles:** Hotel, Admin.

**Root cause:** Unlike the Hotel Invitations and Admin layouts, this route has no
role-specific `beforeLoad`.

**File:** `src/routes/_authenticated/dashboard.quotations.tsx`

**Recommended fix:** Add the same explicit role-guard pattern used by
`dashboard.invitations.tsx` while preserving RLS as the final authorization
layer.

### QA-ADMIN-001 - Required Admin control-center modules are absent

**Description:** No dedicated routes exist for Admin Quotes, Bookings, Reports,
Audit Logs, Security, System Health, or Analytics. Bulk actions cannot be tested
because these pages do not exist.

**Affected role:** Admin.

**Root cause:** Current Admin scope ends at overview, users, hotels, agency
verification, group requests, subscriptions, and settings.

**Recommended fix:** Confirm required product scope, then implement missing
read-only/management pages against existing authorized data sources.

### QA-RFQ-003 - Agency RFQ editing is absent

**Description:** Agency RFQ list/detail supports creation, viewing, closing,
deleting, comparing, shortlisting, rejecting, and accepting, but no edit action
or route exists.

**Affected role:** Agency.

**Recommended fix:** Add editing only for lifecycle states already allowed by
business rules, with server/RLS validation.

## MEDIUM FINDINGS

### QA-A11Y-001 - Homepage has no main landmark

The guest homepage renders header, sections, and footer directly under a `div`.
The only `<main>` in `src/routes/index.tsx` belongs to the Admin dashboard branch.
Both browser DOM inspection and Lighthouse report `landmark-one-main`.

**Recommended fix:** Wrap the guest landing content in one semantic `<main>`.

### QA-A11Y-002 - Lighthouse accessibility defects

Local V2 Lighthouse reports:

- Insufficient contrast on low-opacity step-number decorations.
- Date buttons display `MM/DD/YYYY`, but accessible names contain only Check-in
  or Check-out (`label-content-name-mismatch`).
- Homepage missing a main landmark.

Accessibility score: **95/100** on mobile and desktop.

### QA-PERF-001 - Mobile lab performance is below release expectations

Local production-style mobile Lighthouse:

| Metric      | Result |
| ----------- | ------ |
| Performance | 52     |
| FCP         | 8.8 s  |
| LCP         | 9.2 s  |
| TBT         | 240 ms |
| CLS         | 0.006  |
| Speed Index | 8.8 s  |

Desktop performance is materially better: score 84, FCP 1.7 s, LCP 1.8 s, TBT
30 ms, CLS 0.008.

This is a local throttled lab result, not a valid deployed-production measure.
The current Vercel Preview cannot be measured as the V2 application because
unauthenticated Lighthouse is redirected to Vercel login.

The built JavaScript graph contains 145 chunks, 1,563,613 bytes raw and 490,781
bytes gzip in aggregate. The largest entry chunk is 629,788 bytes raw / 191,301
bytes gzip; the Supabase vendor chunk is 211,657 bytes raw / 55,110 bytes gzip.

### QA-SEO-001 - Invalid sitemap declaration

`public/robots.txt:4` contains `Sitemap: /sitemap.xml`. Lighthouse requires an
absolute sitemap URL.

**Recommended fix:** Use the final production origin after domain approval.

### QA-SEC-001 - CSP remains broader than a final external-Supabase deployment needs

The HTML CSP permits `'unsafe-inline'`, `'unsafe-eval'`, and Lovable frame/script
hosts. This is compatible with the current preview architecture but is broader
than ideal for the final Vercel deployment.

**Recommended fix:** After the deployment target is final, test removal of
`'unsafe-eval'`, use nonces/hashes where supported, and remove Lovable origins if
they are no longer required. Do not change CSP without a regression pass.

### QA-TEST-001 - Automated coverage is incomplete

Vitest passes 36 tests but skips 18. Existing tests do not cover the complete
award transaction, hotel quote editing/withdrawal/decline, booking workspace, or
role-by-role navigation and route authorization.

## LOW FINDINGS

### QA-REL-001 - QA Node version differs from repository engine

The repository expects Node `>=22.23.1 <23`; QA ran on Node `24.14.0`. All gates
passed, but CI and release validation should use the pinned Node 22 environment.

### QA-REL-002 - Large first-party JavaScript has no production source maps

Lighthouse reports missing source maps. This does not affect users directly but
reduces production incident diagnosability.

### QA-XBROWSER-001 - Browser matrix is incomplete

Chrome and Edge rendered the current local V2 homepage successfully. Firefox is
installed but its headless screenshot run did not complete reliably. Safari and
Mobile Safari are unavailable on this Windows environment. These remain release
coverage gaps.

## PASSED TESTS

### Public routes

| Route             | English | Arabic | RTL/LTR | Result   |
| ----------------- | ------- | ------ | ------- | -------- |
| `/`               | Pass    | Pass   | Pass    | Pass     |
| `/how-it-works`   | Pass    | Pass   | Pass    | Pass     |
| `/pricing`        | Pass    | Pass   | Pass    | Pass     |
| `/about`          | Pass    | Pass   | Pass    | Pass     |
| `/contact`        | Pass    | Pass   | Pass    | Pass     |
| `/trust`          | Pass    | Pass   | Pass    | Pass     |
| `/privacy`        | Pass    | Pass   | Pass    | Pass     |
| `/terms`          | Pass    | Pass   | Pass    | Pass     |
| `/cookies`        | Pass    | Pass   | Pass    | Pass     |
| `/for-hotels`     | Pass    | Pass   | Pass    | Pass     |
| `/auth`           | Pass    | Pass   | Pass    | Pass     |
| `/reset-password` | Pass    | Pass   | Pass    | Pass     |
| `/request-quote`  | Pass    | Pass   | Pass    | Pass     |
| Unknown route     | Pass    | Pass   | Pass    | HTTP 404 |

`/hotels` and `/hotel-list` correctly return localized Access Denied for guests.

### Guest route protection

The following routes redirect unauthenticated users to `/auth`:

- `/dashboard`
- `/dashboard/rfqs`
- `/dashboard/invitations`
- `/dashboard/messages`
- `/dashboard/notifications`
- `/dashboard/hotel`
- `/admin`
- `/admin/users`
- `/admin/group-requests`

### Localization and hydration

- English hard reload: no locale flash, raw keys, or hydration errors.
- Arabic hard reload: Arabic SSR, `lang="ar"`, `dir="rtl"`, no English flash,
  raw keys, or hydration errors.
- Locale persistence across reload: pass.
- Catalogs: 1,480 English keys and 1,480 Arabic keys.
- Catalog parity: 100%.
- Estimated UI coverage: 99.9%.
- The one audit `USER_VISIBLE` result is a false positive from the technical
  `Secure` cookie attribute.

### RFQ master data

- External Supabase countries loaded: 76.
- Saudi Arabia selected successfully.
- Corresponding cities loaded: Dammam, Jeddah, Madinah, Makkah, Riyadh, Taif.
- City selector enabled after country selection.
- Full RFQ advanced from Step 1 to Step 2 in Arabic.
- No RFQ was submitted and no data was written.

### Responsive checks

Settled current-V2 captures were inspected at 390, 768, 1024, 1440, and 1920
pixel widths. No document-level horizontal overflow was detected. The mobile
header uses the menu control at 390 and 768; desktop navigation and guest actions
fit at 1024 and above after session initialization settles.

Evidence:

- `C:\Users\DELL\AppData\Local\Temp\gts-v2-qa\homepage-390-settled.png`
- `C:\Users\DELL\AppData\Local\Temp\gts-v2-qa\homepage-768x1024.png`
- `C:\Users\DELL\AppData\Local\Temp\gts-v2-qa\homepage-1024x768.png`
- `C:\Users\DELL\AppData\Local\Temp\gts-v2-qa\homepage-1440x900.png`
- `C:\Users\DELL\AppData\Local\Temp\gts-v2-qa\homepage-1920x1080.png`
- `C:\Users\DELL\AppData\Local\Temp\gts-v2-qa\auth-390x844-settled.png`
- `C:\Users\DELL\AppData\Local\Temp\gts-v2-qa\request-quote-390x844-settled.png`
- `C:\Users\DELL\AppData\Local\Temp\gts-v2-qa\request-quote-768x1024-settled.png`
- `C:\Users\DELL\AppData\Local\Temp\gts-v2-qa\edge-home-1440.png`

### Anonymous Supabase restrictions

Anonymous REST checks:

| Resource               | Result         |
| ---------------------- | -------------- |
| `profiles`             | 401            |
| `rfqs`                 | 401            |
| `quotes`               | 401            |
| `hotels`               | 401            |
| `rfq_invitations`      | 401            |
| `rfq_lifecycle_events` | 401            |
| `user_roles`           | 200, zero rows |
| `bookings`             | 200, zero rows |
| `conversations`        | 200, zero rows |
| `chat_messages`        | 200, zero rows |
| `notifications`        | 200, zero rows |

No anonymous business record was returned. Authenticated RLS isolation could not
be certified without role accounts.

### Security headers

Local production preview emits:

- Content-Security-Policy
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy
- HSTS on HTTPS responses

Notification links accept only relative `/dashboard...` paths and reject
protocol-relative/external links.

## QUALITY GATES

| Gate                             | Result                             |
| -------------------------------- | ---------------------------------- |
| `pnpm install --frozen-lockfile` | Pass with Node engine warning      |
| `pnpm format:check`              | Pass                               |
| `pnpm exec tsc --noEmit`         | Pass                               |
| `pnpm exec eslint .`             | Pass                               |
| `pnpm test`                      | Pass: 36 passed, 18 skipped        |
| `pnpm i18n:audit`                | Pass                               |
| `pnpm build`                     | Pass with non-fatal build warnings |
| `pnpm preview`                   | Pass at `127.0.0.1:4190`           |

## UNVERIFIED ACCEPTANCE AREAS

The following could not be honestly marked passed without authenticated QA
accounts and a current V2 deployment:

- Registration email delivery and verification.
- Login/logout/session persistence for each role.
- Password-reset email delivery and redirect allow-list.
- Agency RFQ submit/edit/delete and verification enforcement in a real session.
- Hotel invitation accept/decline and quote submit/edit/withdraw.
- Quote comparison and award.
- Booking creation and transitions.
- Authenticated messages, typing, attachments, unread state, and participant
  isolation.
- Authenticated notifications, realtime, read state, and destinations.
- Admin tables, filters, dialogs, actions, and permissions.
- Authenticated file upload/download/storage policies.
- Cross-role RLS/API bypass attempts.
- Offline and forced 500 states.
- Firefox, Safari, Mobile Safari.
- Production INP and field Core Web Vitals.

## DATABASE CHANGES

None.

```text
Supabase schema changes: 0
Supabase data changes: 0
RLS changes: 0
Auth changes: 0
Storage changes: 0
Database migrations: 0
```

## FILES CHANGED BY THIS QA PHASE

- Added `GROUPTOSTAY_V2_PRODUCTION_READINESS_REPORT.md`.
- `pnpm i18n:audit` regenerated the existing reports under `docs/i18n/`.
- No application source file was changed by this QA phase.

Existing uncommitted critical-fix work was preserved and not reverted.

## GIT

- Branch: `feature/grouptostay-v2-design`
- Starting/current commit: `912a9f7ff37363fdcd578154cf02ffa879149600`
- Commit created: No
- Push performed: No
- Merge performed: No
- Release created: No
- Production deployment: Unchanged

## REMAINING PRODUCTION BLOCKERS

1. Deploy the exact V2 candidate commit to a new non-production Vercel Preview.
2. Provide isolated Agency, Hotel, and Admin QA accounts.
3. Replace browser-orchestrated award writes with one atomic server/database
   transaction.
4. Complete hotel quote edit, withdraw, and invitation-decline operations.
5. Provide booking list/detail/management workspaces.
6. Re-run the complete authenticated, RLS, realtime, upload, responsive,
   accessibility, performance, and cross-browser acceptance matrix.

## FINAL CERTIFICATION

❌ NOT READY FOR PRODUCTION
