# Changelog

## Unreleased

### Changed

- Completed English and Arabic localization across public, authentication, RFQ, agency, hotel, dashboard, admin, notification, profile, and legal surfaces.
- Replaced user-visible literals with structured i18next keys and centralized locale-aware dates, numbers, sorting, metadata, accessibility labels, and runtime notifications.
- Added professional Arabic catalogs with complete namespace parity and RTL-aware presentation details.
- Added the reusable `pnpm i18n:audit` quality gate and generated Markdown/JSON coverage reports.

### Fixed

- Resolved missing English and Arabic keys, broken references, namespace collisions, duplicate definitions, interpolation mismatches, malformed encodings, and locale-file BOMs.
- Prevented English-only relative dates, status labels, form feedback, empty states, and admin management copy from leaking into Arabic mode.

### Verification

- Translation keys: 1,472 English and 1,472 Arabic.
- Catalog parity and effective UI coverage: 100%.
- Hardcoded `USER_VISIBLE` findings, missing keys, broken references, duplicate definitions, namespace collisions, and interpolation issues: zero.
