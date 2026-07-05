# Classification Summary

Generated: 2026-07-05T17:46:41.344Z

## Classification Rules

| Category          | Definition                                                        | Translation action                |
| ----------------- | ----------------------------------------------------------------- | --------------------------------- |
| USER_VISIBLE      | Rendered copy, labels, placeholders, accessibility text, messages | Translate in Phase 1.4B           |
| TECHNICAL         | Formats, selectors, attributes, import paths, translation keys    | Do not translate                  |
| INTERNAL_CONSTANT | Roles, statuses, enum values, machine tokens                      | Do not translate the stored value |
| ROUTES            | Internal routes, URLs, link targets                               | Do not translate                  |
| QUERY_KEYS        | Query cache keys, table/column/API identifiers                    | Do not translate                  |
| DEVELOPER_ONLY    | Comments, diagnostics, stack and internal errors                  | Do not translate                  |
| THIRD_PARTY       | External package module identifiers                               | Do not modify                     |

## Results

| Category          | Occurrences | Share |
| ----------------- | ----------- | ----- |
| USER_VISIBLE      | 0           | 0.0%  |
| TECHNICAL         | 5863        | 62.5% |
| INTERNAL_CONSTANT | 745         | 7.9%  |
| ROUTES            | 318         | 3.4%  |
| QUERY_KEYS        | 738         | 7.9%  |
| DEVELOPER_ONLY    | 1318        | 14.0% |
| THIRD_PARTY       | 404         | 4.3%  |

## Confidence

| Confidence | Occurrences |
| ---------- | ----------- |
| HIGH       | 8315        |
| MEDIUM     | 454         |
| LOW        | 617         |

## Scope Notes

- Empty and whitespace-only literals are ignored.
- Generated route source is retained in the inventory and classified as DEVELOPER_ONLY.
- Locale JSON values are audited as catalogs, not reclassified as hardcoded source strings.
- Every source finding is available with a stable run-local ID in [AuditReport.json](./AuditReport.json).
- 2 flat legacy locale file(s) are present outside the active namespace directories: `src/locales/ar.json`, `src/locales/en.json`.
