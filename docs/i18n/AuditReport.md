# Enterprise i18n Audit Report

Generated: 2026-07-26T10:46:30.794Z

## Executive Summary

This report classifies every non-empty string literal and source comment detected in the application source. It is an audit baseline only: no translation or application behavior changes are performed by the audit command.

| Metric                               | Result |
| ------------------------------------ | ------ |
| Source files scanned                 | 169    |
| Strings detected and classified      | 9939   |
| Hardcoded USER_VISIBLE occurrences   | 1      |
| Unique hardcoded USER_VISIBLE values | 1      |
| Translation references               | 1649   |
| Catalog keys (union)                 | 1532   |
| English keys                         | 1532   |
| Arabic keys                          | 1532   |
| Catalog parity                       | 100.0% |
| Estimated effective UI coverage      | 99.9%  |
| Risk assessment                      | LOW    |

## Classification Totals

| Category          | Occurrences |
| ----------------- | ----------- |
| USER_VISIBLE      | 1           |
| TECHNICAL         | 6403        |
| INTERNAL_CONSTANT | 739         |
| ROUTES            | 351         |
| QUERY_KEYS        | 607         |
| DEVELOPER_ONLY    | 1391        |
| THIRD_PARTY       | 447         |

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
| Unused keys                           | 103      |

## Risk Assessment

**LOW**. No material catalog or hardcoded-copy risk was detected.

## Phase 1.4B Recommendation

Process USER_VISIBLE findings feature by feature, starting with high-volume pages. Resolve broken references and interpolation issues before translating additional copy. Keep TECHNICAL, INTERNAL_CONSTANT, ROUTES, QUERY_KEYS, DEVELOPER_ONLY, and THIRD_PARTY findings out of translation catalogs unless their runtime use is proven user-visible.

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
