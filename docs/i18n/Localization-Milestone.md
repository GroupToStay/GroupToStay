# Localization Milestone

## Phase 1.4B

GroupToStay now has paired English and Modern Standard Arabic catalogs across 19 namespaces. Application language remains owned by `ApplicationLocaleProvider`; browser locale and browser translation do not select application language.

The release gate requires:

- `pnpm format:check`
- `pnpm exec tsc --noEmit`
- `pnpm exec eslint .`
- `pnpm test`
- `pnpm build`
- `pnpm i18n:audit`

Phase 1.4B is complete only after the GitHub main branch, connected Lovable project, published application, and live verification all point to the same release commit.
