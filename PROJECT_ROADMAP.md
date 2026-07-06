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

### Phase 1.4C - Localization Certification

- [x] Public English and Arabic page certification
- [x] RTL/LTR, shared-control, calendar, and responsive certification
- [x] Required 320-1920 pixel viewport matrix
- [x] Localization audit and catalog integrity gate
- [x] Form-label and accessible-name hardening
- [ ] Live Agency, Hotel, and Admin role certification with test accounts
- [ ] Edge, Firefox, Safari, and Mobile Safari evidence
- [ ] Final GitHub/Lovable publication and production bundle verification

Future phases must preserve the localization gate by adding paired English and Arabic keys with every UI change. The 84 statically unused compatibility and dynamic keys remain documented in `docs/i18n/UnusedKeys.md` and should be reassessed only when their related workflows are retired.
