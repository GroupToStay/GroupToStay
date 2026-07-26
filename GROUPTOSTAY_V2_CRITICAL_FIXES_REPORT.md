# GroupToStay V2 — Critical Fixes Report

## PHASE

GroupToStay V2 Critical Fixes

## Executive Summary

All five acceptance blockers were resolved and verified against the production-style local
build. The runtime now uses the external Supabase project, the server and client begin with the
same saved locale, RFQ country and city selectors load live Supabase data with explicit states,
`pnpm preview` serves the actual Nitro build, and the React pre-mount warning no longer occurs.

The verification was non-destructive. No Supabase schema, data, RLS, authentication, storage, or
migration changes were made. No commit, push, deployment, or production change was performed.

## SUMMARY

- External Supabase runtime project: `atxecflhmphaqqkatjlm`
- Legacy runtime project present in built frontend: no
- English SSR: `lang="en"` and `dir="ltr"`
- Arabic SSR: `lang="ar"` and `dir="rtl"`
- Active countries returned from Supabase: 76
- Saudi Arabia cities returned in the tested dataset: 6
- Browser console after targeted validation: 0 errors and 0 warnings
- Production-style preview: passed

## V2-ENV-001

### Root Cause

The tracked local `.env` still targeted the former Lovable Cloud project
`divgqjlotvmlmkzjtlzw`. It also exposed the public client key through the existing
`VITE_SUPABASE_PUBLISHABLE_KEY` name, while the three application clients accepted only
`VITE_SUPABASE_ANON_KEY`. This made the runtime environment-dependent and caused the acceptance
build to use the wrong project or fail to initialize the public client.

### Fix

- Updated the local acceptance environment to the external project URL and matching public key.
- Updated the browser client, public REST client, and authenticated server middleware to accept
  `VITE_SUPABASE_ANON_KEY`, with compatibility for the existing
  `VITE_SUPABASE_PUBLISHABLE_KEY` name.
- Kept all credentials environment-provided. No key was hardcoded in application source.
- Did not introduce or expose a service-role key.

### Supabase Project Used

`https://atxecflhmphaqqkatjlm.supabase.co`

### Verification

- A read-only REST request returned 76 active countries.
- The final built public assets contain `atxecflhmphaqqkatjlm`.
- The final built public assets do not contain `divgqjlotvmlmkzjtlzw`.
- Browser RFQ queries loaded countries and cities from the external project.
- `supabase/config.toml` still contains historical CLI project metadata. It is not imported by
  the application, is absent from the frontend bundle, and was intentionally left unchanged
  because this task prohibits backend and migration configuration changes.

## V2-I18N-001

### Root Cause

The server always rendered English. After hydration began, a client-only `queueMicrotask`
restored the localStorage language and mutated i18next and document direction. For saved Arabic
users this created different server and client trees, producing a visible English-to-Arabic
flash, hydration mismatch, React tree regeneration, and transient untranslated content.

### Fix

- Added the shared `gts_lang` cookie as the locale source readable by both server and browser.
- The language switch persists the selected locale to localStorage and the same-site cookie.
- The TanStack Start router reads the request cookie on the server and the same cookie in the
  browser.
- i18next changes to that locale before router creation and before rendering starts.
- The root document derives `lang` and `dir` from the initialized application locale.
- Removed the post-hydration microtask and both hydration-warning suppression attributes.
- Unsupported locale values safely normalize to English.

### SSR Locale

The server reads `gts_lang` from the incoming cookie. Missing or unsupported values resolve to
English.

### Client Initial Locale

The client reads the same cookie before router creation. The initial browser tree therefore uses
the same locale as the server tree.

### Hydration Results

- English hard reloads: 3 of 3 rendered English from the first document.
- Arabic hard reloads: 3 of 3 rendered Arabic from the first document.
- Hydration errors: 0
- Hydration mismatch warnings: 0
- React tree regenerations: 0
- Raw `footer.copyright` output: 0 occurrences

### Arabic Results

`/`, `/auth`, `/request-quote`, `/how-it-works`, and `/pricing` returned Arabic SSR markup with
`lang="ar"` and `dir="rtl"`. Desktop and 390 px mobile browser checks retained Arabic without a
language flash.

### English Results

The same five routes returned English SSR markup with `lang="en"` and `dir="ltr"`. Desktop and
390 px mobile browser checks retained English without a language flash.

## V2-RFQ-001

### Root Cause

The frontend Supabase clients did not recognize the public key variable available in the
acceptance environment. The country query therefore failed before returning data. The shared
selector then converted missing query data to an empty array and rendered no loading, error, or
empty explanation, making a configuration failure look like an empty database.

The city query was also enabled before a country was selected, creating an unnecessary
unfiltered request.

### Fix

- Restored public-client initialization through the environment key compatibility described in
  V2-ENV-001.
- Preserved the existing Supabase country and city queries and shared selector architecture.
- Enabled the city query only when a country ID exists.
- Added localized loading, loaded, empty, error, and retry states.
- Disabled selectors while their required data is unavailable.
- Memoized normalized query data used by the shared selector effect.
- Did not hardcode or duplicate country or city data.

### Country Query

The existing `countries` query filters active records and orders the source data. The external
Supabase project returned 76 active country rows.

### City Query

The existing `cities` query runs after country selection and filters by `country_id`. Selecting
Saudi Arabia returned six cities in the tested external dataset.

### Homepage Result

The homepage Country selector displayed 76 options. Selecting Saudi Arabia enabled the City
selector, which displayed Dammam, Jeddah, Madinah, Makkah, Riyadh, and Taif. Selecting Dammam and
continuing navigated to the full RFQ route with the selected IDs.

### `/request-quote` Result

The selected country and city were retained by the full RFQ flow. Required Step 1 title
validation blocked an incomplete step. After entering a temporary `TEST_` title, the flow
advanced to Step 2 without submitting or writing an RFQ.

### English Result

Country and city options, query states, and validation feedback rendered in English.

### Arabic Result

The selector displayed 76 Arabic country labels. Selecting `المملكة العربية السعودية` enabled
six Arabic city labels: `الدمام`, `جدة`, `المدينة المنورة`, `مكة المكرمة`, `الرياض`, and
`الطائف`. The Arabic Step 1 flow advanced to Step 2 after local validation.

## V2-REL-001

### Root Cause

The package preview script invoked `vite preview`. TanStack Start's preview integration expected
`dist/server/server.js`, but the configured Nitro Cloudflare build emits
`.output/server/index.mjs`. Direct Nitro preview also expected Wrangler, which is not an installed
project dependency and is not required by the existing Vercel architecture.

### Fix

- Replaced the invalid preview command with `node scripts/preview.mjs`.
- Added a dependency-free Node bridge around the generated Nitro Fetch handler.
- Added safe serving for `.output/public` assets, MIME types, immutable asset caching, and path
  traversal protection.
- Kept the existing TanStack Start, Nitro, Vite, and Vercel build architecture unchanged.
- Added no dependency.

### Build Result

`pnpm build` passed and produced `.output/server/index.mjs` plus the public asset directory.

### Preview Result

`pnpm preview` started the production build at `http://127.0.0.1:4190/` during final validation.
`/`, `/auth`, and `/request-quote` returned HTTP 200. The generated JavaScript entry asset also
returned HTTP 200.

### Browser Result

The production-style preview rendered, hydrated, loaded Supabase master data, switched locales,
and completed the targeted RFQ interactions in a real browser.

## V2-REACT-001

### Root Cause

The state-update-before-mount warning shared the localization root cause. The i18n initialization
scheduled an asynchronous language mutation while the initial route tree was still hydrating.
That mutation notified React subscribers before the expected mounted lifecycle.

### Fix

Locale initialization now completes before router creation and initial rendering. The
post-initialization microtask was removed. No unrelated React state or business flow was
rewritten.

### Remaining Console Errors

- Hydration errors: 0
- Hydration mismatch warnings: 0
- State-update-before-mount warnings: 0
- Uncaught exceptions: 0
- Application-generated warnings during tested routes: 0

### Browser Result

Repeated English and Arabic hard reloads and all five public-route checks completed without the
warning returning.

## FILES CHANGED

- `.env` - local acceptance runtime changed to the external project; contains no service-role
  key and must not be committed without repository environment-policy review.
- `package.json` - corrected production preview command.
- `scripts/preview.mjs` - added the production-style Nitro preview bridge.
- `src/components/country-city-select.tsx` - explicit query states and retry behavior.
- `src/hooks/use-master-data.tsx` - country-dependent city query.
- `src/integrations/supabase/auth-middleware.ts` - public key environment compatibility.
- `src/integrations/supabase/client.ts` - public key environment compatibility.
- `src/integrations/supabase/public-rest.ts` - public key environment compatibility.
- `src/lib/i18n.ts` - removed post-hydration locale mutation.
- `src/lib/locale.ts` - shared locale cookie parsing and persistence.
- `src/locales/ar/forms.json` - Arabic master-data state messages.
- `src/locales/en/forms.json` - English master-data state messages.
- `src/router.tsx` - isomorphic initial locale initialization.
- `src/routes/__root.tsx` - locale-derived document language and direction.
- `tests/locale-manager.test.ts` - shared cookie parser coverage.
- `GROUPTOSTAY_V2_CRITICAL_FIXES_REPORT.md` - this report.

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

Only read-only country and city requests were made. The RFQ browser test stopped at Step 2 and
did not submit a record.

## SECURITY IMPACT

- Positive: the verified frontend runtime no longer targets the old Lovable Cloud project.
- Positive: no service-role credential is used by or exposed to the frontend.
- Positive: the preview static-file handler rejects paths outside `.output/public`.
- Unchanged: authentication, authorization, RLS, storage, backend policies, and business data.
- Review note: `.env` was already tracked at the starting commit with public client
  configuration. It remains an uncommitted local change and should be handled deliberately before
  any future commit.

## PERFORMANCE IMPACT

- No dependency was added.
- City data no longer queries before country selection.
- Locale initialization adds no post-hydration rerender.
- No route, chunking, image, font, or design-system behavior was changed.

## LOCALIZATION IMPACT

- English and Arabic catalogs remain intact.
- Four localized master-data feedback messages were added per language.
- Locale ownership remains inside the existing application language system.
- Browser language remains irrelevant to application language.
- RTL and LTR are present on the initial SSR document rather than applied after hydration.

## QUALITY GATES

| Gate                             | Result | Evidence                                                    |
| -------------------------------- | ------ | ----------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Pass   | Lockfile unchanged; installation already current            |
| `pnpm format:check`              | Pass   | Prettier check completed                                    |
| `pnpm exec tsc --noEmit`         | Pass   | No TypeScript errors                                        |
| `pnpm exec eslint .`             | Pass   | No ESLint errors                                            |
| `pnpm test`                      | Pass   | 4 test files passed, 2 skipped; 36 tests passed, 18 skipped |
| `pnpm build`                     | Pass   | Nitro production output generated                           |
| `pnpm preview`                   | Pass   | Server, SSR routes, and static assets verified              |

The host currently uses Node 24 while the repository declares Node 22.23.1 through the Node 22
engine range. pnpm reports that mismatch as an environment warning. It did not fail any gate.
Existing third-party module-directive, chunk-size, and tooling warnings also remain non-fatal.

## BROWSER TESTING

| Route            | English | Arabic | Hydration | RFQ/Data                                  | Result |
| ---------------- | ------- | ------ | --------- | ----------------------------------------- | ------ |
| `/`              | Pass    | Pass   | 0 errors  | 76 countries; country-to-city flow passed | Pass   |
| `/auth`          | Pass    | Pass   | 0 errors  | Not applicable                            | Pass   |
| `/request-quote` | Pass    | Pass   | 0 errors  | Country, city, validation, Step 2 passed  | Pass   |
| `/how-it-works`  | Pass    | Pass   | 0 errors  | Not applicable                            | Pass   |
| `/pricing`       | Pass    | Pass   | 0 errors  | Not applicable                            | Pass   |

Responsive targeted checks passed at 1440 x 900 and 390 x 844. The check focused on the five
blockers and did not redesign or recertify unrelated V2 visual behavior.

## SUPABASE SAFETY

- External project queried: `atxecflhmphaqqkatjlm`
- Database writes: 0
- Existing business records modified: 0
- Migrations created or applied: 0
- Backend configuration modified: 0
- Service-role operations: 0

## GIT

- Branch: `feature/grouptostay-v2-design`
- Starting commit: `912a9f7ff37363fdcd578154cf02ffa879149600`
- Commit created: no
- Push performed: no
- Merge performed: no
- `main` modified: no
- Working tree: contains only the focused uncommitted files listed above.

## DEPLOYMENT

Production unchanged.

No preview or production deployment was created. Validation used the local production build
through `pnpm preview`.

## REMAINING ISSUES

1. The local verification host is Node 24, while the repository standard is Node 22.23.1. Future
   CI and release validation should continue using the pinned Node 22 environment.
2. The build retains pre-existing non-fatal third-party module-directive, chunk-size, and
   TanStack/Nitro tooling warnings. None is one of the five acceptance blockers.
3. Guest users can still start a Group Request before authentication. This behavior was
   explicitly preserved and remains a pending product decision.
4. `supabase/config.toml` still names the historical CLI project. It has no frontend runtime
   effect and should only be reconciled in a separately approved backend tooling task.

## REMAINING RISKS

The five targeted runtime blockers are closed. The primary release-process risk is running future
checks under Node 24 instead of the repository's pinned Node 22 version. The tracked `.env`
configuration also requires deliberate review before any future commit, even though it contains
only public client configuration and no service-role credential.

## READY FOR REVIEW

Yes. The focused fixes and evidence are ready for full Acceptance QA. No Git or deployment action
has been taken.

## FINAL STATUS

### ALL FIVE BLOCKERS RESOLVED — READY FOR FULL ACCEPTANCE QA
