# Localization Certification Report

## Release Scope

Phase 1.4C certifies the English and Arabic localization layer without changing application roles, authorization, workflows, APIs, Supabase schema, or business rules.

Status: **OPEN - authenticated role and non-Chromium evidence pending**.

## Automated Localization Evidence

| Check                             | Result |
| --------------------------------- | ------ |
| English keys                      | 1,475  |
| Arabic keys                       | 1,475  |
| Catalog parity                    | 100.0% |
| Estimated UI coverage             | 100.0% |
| Missing English / Arabic          | 0 / 0  |
| Broken static references          | 0      |
| Duplicate definitions             | 0      |
| Namespace collisions              | 0      |
| Interpolation mismatches          | 0      |
| Hardcoded `USER_VISIBLE` findings | 0      |
| Risk assessment                   | Low    |

The 84 statically unused entries remain documented in `UnusedKeys.md`. They are retained for dynamic, compatibility, and future-ready flows.

## Pages Verified

Browser-verified in both English and Arabic:

- Landing page
- About
- Pricing
- Contact
- Trust and Security
- How It Works
- For Hotels
- Terms and Conditions
- Privacy Policy
- Cookie Policy
- Sign in and registration
- Reset Password invalid-link state
- Public RFQ wizard
- Hotel directory access-denied states
- Subscription coming-soon and waitlist flow
- Auth redirects for dashboard, hotel, agency, and admin routes
- Localized 404 state

HTTP/SSR verification returned the expected HTML and status for 32 known routes, including all public, dashboard, admin, hotel, agency, notification, messaging, profile, and settings entry points. Protected routes were additionally verified in a signed-out browser and redirect to the localized authentication page.

Live authenticated interiors remain pending for:

- Agency dashboard and Agency Profile
- Hotel dashboard, hotel editor, invitations, quotations, and PMS
- Admin overview, users, group requests, hotel companies, hotel listings, agency verifications, and settings
- Authenticated messages, notifications, profile, empty states, and data-dependent dialogs

Completing these items requires existing test accounts for the Agency, Hotel, and Admin roles. No production accounts were created or mutated during certification.

## Components And Forms

Verified shared components:

- Site header, mobile navigation, language switcher, and footer
- Country and city selectors
- Searchable category multi-select
- Accommodation and meal-plan selectors
- Date pickers and calendar navigation
- RFQ count, requirements, and date fields
- Authentication and registration forms
- Contact form
- Subscription waitlist dialog
- Access denied, 404, loading, and error-boundary copy

Certification fixes:

- Added programmatic label associations and localized accessible names to shared RFQ, auth, profile, hotel, quote, PMS, contact, and waitlist controls.
- Added `aria-pressed` and labelled groups to account-role and PMS choice controls.
- Added localized labels to icon-only photo and room actions.
- Replaced corrupted Arabic country fallback values and removed English-only country/city rendering from Agency Profile.
- Added explicit `method="post"` to every form while preserving existing JavaScript submissions.
- Localized all React DayPicker accessibility labels through the DayPicker locale extensions.

## RTL And LTR

- English renders with `lang="en"` and `dir="ltr"`.
- Arabic renders with `lang="ar"` and `dir="rtl"`.
- Page titles, headings, navigation, forms, selectors, country values, calendars, validation copy, and legal content follow the application-selected language.
- No raw translation keys, error boundary, or mixed-language first-page state was found after locale stabilization.
- Arabic country selectors and date pickers open without runtime errors.

## Responsive Matrix

The shared RFQ form was measured at 320, 375, 390, 414, 768, 1024, 1280, 1440, and 1920 pixels. All tested widths reported matching document/client widths, no horizontal overflow, and no controls outside the viewport.

Homepage mobile layout was verified at 320 pixels in English and Arabic. Mobile navigation remained available, the hero heading fit, and no horizontal overflow or error boundary appeared.

## Accessibility

- Public pages use one primary `h1` and semantic secondary headings.
- Visible images on audited public screens have alt attributes.
- Visible icon-only buttons on audited screens have accessible names.
- Public RFQ, auth, registration, contact, and waitlist forms have no visible unlabeled controls.
- Shared authenticated form components now expose labels and accessible names at source level.
- Existing focus-visible styles remain enabled on shared buttons, links, inputs, selects, and textareas.

Formal screen-reader sessions and automated color-contrast measurements were not available in the current environment. They remain release evidence items rather than known product defects.

## Browser Matrix

| Runtime                          | Result                                         |
| -------------------------------- | ---------------------------------------------- |
| Chromium in-app browser          | Pass for certified public and signed-out flows |
| Chrome mobile viewport emulation | Pass for tested responsive flows               |
| Edge                             | Pending - runtime unavailable                  |
| Firefox                          | Pending - runtime unavailable                  |
| Safari / Mobile Safari           | Pending - runtime unavailable                  |

## Performance And Runtime

- No application error page appeared in certified production flows.
- No raw locale keys or browser-locale dependency was detected.
- Locale switching updates content, direction, document language, and route metadata together.
- Production build retains an approximately 628 kB main client chunk. This is non-blocking localization technical debt and should be addressed with route-level code splitting in a dedicated performance phase.

## Production Evidence

The connected Lovable project synchronized GitHub through commit `b1b74e8` during certification and served a fresh `index-BiTvSKYP.js` bundle. The final Phase 1.4C documentation and accessibility commit still requires publication and a final live bundle check.

## Remaining Release Blockers

1. Live role-by-role certification needs Agency, Hotel, and Admin test accounts.
2. Edge, Firefox, Safari, and Mobile Safari runtimes are unavailable in the current environment.
3. Formal assistive-technology and color-contrast evidence is not available.

Phase 1.4C must remain open until the required evidence is supplied or the release owner explicitly accepts those environmental limitations.
