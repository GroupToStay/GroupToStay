# Project Roadmap

## Completed

### Phase 1.4B - Enterprise Internationalization

- [x] Full English and Arabic catalog parity
- [x] Zero audited hardcoded user-visible strings
- [x] Public, authenticated, admin, hotel, agency, RFQ, messaging, profile, notification, and legal coverage
- [x] Locale-aware LTR and RTL rendering
- [x] Automated translation coverage and integrity reporting
- [x] TypeScript, ESLint, formatting, tests, and production build gates
- [x] GitHub, Lovable synchronization, publication, and live verification

## Next

Future phases must preserve the Phase 1.4B gate by adding paired English and Arabic keys with every UI change. The 85 statically unused compatibility and dynamic keys remain documented in `docs/i18n/UnusedKeys.md` and should be reassessed only when their related workflows are retired.
