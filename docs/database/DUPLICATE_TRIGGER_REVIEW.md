# Duplicate Trigger Review

- Audit date: 2026-08-08
- Production project: `atxecflhmphaqqkatjlm`
- Production writes/removals: none

All eight triggers are enabled (`tgenabled = O`). [PostgreSQL fires triggers for the same event on
the same relation in alphabetical trigger-name order](https://www.postgresql.org/docs/current/trigger-definition.html).
Each pair below calls the same function twice. All four functions are guard/validation functions
that return `NEW` unchanged and perform no audit, notification, or other data write; a rejected row
stops at the first raising trigger, while an accepted row executes the same checks twice.

| Table                  | Trigger A                                  | Trigger B                                      | Timing/events                  | Function                                   | Order     | Side effect                                                             | Duplicate event possibility | Audit/notification impact   | Safe removal candidate                                                                          | Confidence |
| ---------------------- | ------------------------------------------ | ---------------------------------------------- | ------------------------------ | ------------------------------------------ | --------- | ----------------------------------------------------------------------- | --------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- | ---------- |
| `public.bookings`      | `restrict_organizer_booking_updates_trg`   | `trg_restrict_organizer_booking_updates`       | `BEFORE UPDATE`, row           | `restrict_organizer_booking_updates`       | A, then B | Reads role/hotel ownership; may raise; returns unchanged `NEW`          | Every booking update        | None; no writes in function | Trigger A, after regression tests. Trigger B was added by the later hardening migration.        | Medium     |
| `public.conversations` | `trg_require_verified_agency_conversation` | `trg_require_verified_agency_for_conversation` | `BEFORE INSERT`, row           | `require_verified_agency_for_conversation` | A, then B | Reads organizer role/profile status; may raise; returns unchanged `NEW` | Every conversation insert   | None; no writes in function | Trigger B, after regression tests. Trigger A belongs to the later consolidated guard migration. | Medium     |
| `public.rfqs`          | `trg_require_verified_agency_for_rfq`      | `trg_require_verified_agency_rfq`              | `BEFORE INSERT`, row           | `require_verified_agency_for_rfq`          | A, then B | Reads role/eligibility; may raise; returns unchanged `NEW`              | Every RFQ insert            | None; no writes in function | Trigger A, after regression tests. Trigger B belongs to the later consolidated guard migration. | Medium     |
| `public.rfqs`          | `trg_validate_rfq_row`                     | `validate_rfq_row_trg`                         | `BEFORE INSERT OR UPDATE`, row | `validate_rfq_row`                         | A, then B | Validates fields/date/count ranges; may raise; returns unchanged `NEW`  | Every RFQ insert/update     | None; no writes in function | Trigger B, after regression tests. Trigger A belongs to the later consolidated guard migration. | Medium     |

The suggested candidates are provenance-based, not authorized removals. Before any additive cleanup migration, an isolated database must prove equivalent success/error behavior and verify that no later migration explicitly refers to the candidate name. Current live row counts are three bookings, three conversations, and four RFQs; existing rows do not require duplicate execution to remain valid.
