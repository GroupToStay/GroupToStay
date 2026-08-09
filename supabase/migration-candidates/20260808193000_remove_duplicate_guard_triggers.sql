-- Candidate only. This file is intentionally outside supabase/migrations/ and is not executable
-- until a separate owner-approved Production reconciliation step promotes it to an additive migration.
BEGIN;

DO $$
DECLARE
  expected_count integer;
BEGIN
  SELECT count(*) INTO expected_count
  FROM pg_trigger trigger
  WHERE trigger.tgrelid = 'public.bookings'::regclass
    AND NOT trigger.tgisinternal
    AND trigger.tgname IN ('restrict_organizer_booking_updates_trg', 'trg_restrict_organizer_booking_updates')
    AND trigger.tgfoid = 'public.restrict_organizer_booking_updates()'::regprocedure;
  IF expected_count <> 2 THEN RAISE EXCEPTION 'booking duplicate trigger precondition failed'; END IF;
  DROP TRIGGER IF EXISTS restrict_organizer_booking_updates_trg ON public.bookings;
  IF (SELECT count(*) FROM pg_trigger trigger WHERE trigger.tgrelid = 'public.bookings'::regclass AND NOT trigger.tgisinternal AND trigger.tgname = 'trg_restrict_organizer_booking_updates' AND trigger.tgfoid = 'public.restrict_organizer_booking_updates()'::regprocedure) <> 1 THEN RAISE EXCEPTION 'booking survivor trigger postcondition failed'; END IF;

  SELECT count(*) INTO expected_count
  FROM pg_trigger trigger
  WHERE trigger.tgrelid = 'public.conversations'::regclass
    AND NOT trigger.tgisinternal
    AND trigger.tgname IN ('trg_require_verified_agency_conversation', 'trg_require_verified_agency_for_conversation')
    AND trigger.tgfoid = 'public.require_verified_agency_for_conversation()'::regprocedure;
  IF expected_count <> 2 THEN RAISE EXCEPTION 'conversation duplicate trigger precondition failed'; END IF;
  DROP TRIGGER IF EXISTS trg_require_verified_agency_for_conversation ON public.conversations;
  IF (SELECT count(*) FROM pg_trigger trigger WHERE trigger.tgrelid = 'public.conversations'::regclass AND NOT trigger.tgisinternal AND trigger.tgname = 'trg_require_verified_agency_conversation' AND trigger.tgfoid = 'public.require_verified_agency_for_conversation()'::regprocedure) <> 1 THEN RAISE EXCEPTION 'conversation survivor trigger postcondition failed'; END IF;

  SELECT count(*) INTO expected_count
  FROM pg_trigger trigger
  WHERE trigger.tgrelid = 'public.rfqs'::regclass
    AND NOT trigger.tgisinternal
    AND trigger.tgname IN ('trg_require_verified_agency_for_rfq', 'trg_require_verified_agency_rfq')
    AND trigger.tgfoid = 'public.require_verified_agency_for_rfq()'::regprocedure;
  IF expected_count <> 2 THEN RAISE EXCEPTION 'RFQ verification duplicate trigger precondition failed'; END IF;
  DROP TRIGGER IF EXISTS trg_require_verified_agency_for_rfq ON public.rfqs;
  IF (SELECT count(*) FROM pg_trigger trigger WHERE trigger.tgrelid = 'public.rfqs'::regclass AND NOT trigger.tgisinternal AND trigger.tgname = 'trg_require_verified_agency_rfq' AND trigger.tgfoid = 'public.require_verified_agency_for_rfq()'::regprocedure) <> 1 THEN RAISE EXCEPTION 'RFQ verification survivor trigger postcondition failed'; END IF;

  SELECT count(*) INTO expected_count
  FROM pg_trigger trigger
  WHERE trigger.tgrelid = 'public.rfqs'::regclass
    AND NOT trigger.tgisinternal
    AND trigger.tgname IN ('trg_validate_rfq_row', 'validate_rfq_row_trg')
    AND trigger.tgfoid = 'public.validate_rfq_row()'::regprocedure;
  IF expected_count <> 2 THEN RAISE EXCEPTION 'RFQ validation duplicate trigger precondition failed'; END IF;
  DROP TRIGGER IF EXISTS validate_rfq_row_trg ON public.rfqs;
  IF (SELECT count(*) FROM pg_trigger trigger WHERE trigger.tgrelid = 'public.rfqs'::regclass AND NOT trigger.tgisinternal AND trigger.tgname = 'trg_validate_rfq_row' AND trigger.tgfoid = 'public.validate_rfq_row()'::regprocedure) <> 1 THEN RAISE EXCEPTION 'RFQ validation survivor trigger postcondition failed'; END IF;
END;
$$;

COMMIT;
