# Enterprise i18n Audit Report

Generated: 2026-07-05T17:46:41.344Z

## Executive Summary

This report classifies every non-empty string literal and source comment detected in the application source. It is an audit baseline only: no translation or application behavior changes are performed by the audit command.

| Metric                               | Result |
| ------------------------------------ | ------ |
| Source files scanned                 | 153    |
| Strings detected and classified      | 9386   |
| Hardcoded USER_VISIBLE occurrences   | 0      |
| Unique hardcoded USER_VISIBLE values | 0      |
| Translation references               | 1541   |
| Catalog keys (union)                 | 1472   |
| English keys                         | 1472   |
| Arabic keys                          | 1472   |
| Catalog parity                       | 100.0% |
| Estimated effective UI coverage      | 100.0% |
| Risk assessment                      | LOW    |

## Classification Totals

| Category          | Occurrences |
| ----------------- | ----------- |
| USER_VISIBLE      | 0           |
| TECHNICAL         | 5863        |
| INTERNAL_CONSTANT | 745         |
| ROUTES            | 318         |
| QUERY_KEYS        | 738         |
| DEVELOPER_ONLY    | 1318        |
| THIRD_PARTY       | 404         |

## Catalog Integrity

| Check                                 | Findings |
| ------------------------------------- | -------- |
| Missing English keys                  | 0        |
| Missing Arabic keys                   | 0        |
| Duplicate JSON key definitions        | 0        |
| Cross-namespace path collisions       | 0        |
| Invalid nesting                       | 0        |
| UTF-8 BOM locale files                | 0        |
| Broken static references              | 0        |
| Ambiguous merged-namespace references | 0        |
| Namespace usage issues                | 0        |
| Interpolation mismatches              | 0        |
| Pluralization issues                  | 0        |
| Suspicious encoding values            | 0        |
| Unused keys                           | 85       |

## Risk Assessment

**LOW**. No material catalog or hardcoded-copy risk was detected.

## Phase 1.4B Recommendation

Phase 1.4B localization coverage is complete. Keep `pnpm i18n:audit` in the quality gate and require every new user-visible string to ship with paired English and Arabic keys.

## Translation Key Quality

_None._

Preferred naming uses semantic hierarchy such as `buttons.save`, `admin.users.title`, `dashboard.requests.pending`, `validation.email.required`, and `errors.permissionDenied`.

## Namespace And Runtime Validation

| Check                        | Findings |
| ---------------------------- | -------- |
| Configured namespaces        | 19       |
| Missing namespace files      | 0        |
| Unconfigured namespace files | 0        |
| Invalid nesting              | 0        |
| JSON parse errors            | 0        |
| UTF-8 BOM locale files       | 0        |
| Interpolation mismatches     | 0        |
| Pluralization issues         | 0        |
| Broken references            | 0        |
| Namespace usage issues       | 0        |

## Fallback Behavior

| Check                       | Result |
| --------------------------- | ------ |
| English fallback configured | PASS   |
| Empty strings rejected      | PASS   |
| Null values rejected        | PASS   |

## Machine-Readable Inventory

Every finding, classification reason, confidence level, catalog issue, and resolved translation reference is stored in [AuditReport.json](./AuditReport.json).
