-- GroupToStay V2.1 RC1 quote lifecycle stabilization.
-- Additive only: no existing business rows are updated or deleted.

-- Keep hotel and organizer quote updates inside the documented lifecycle.
-- This replaces the existing trigger function without changing its trigger.
CREATE OR REPLACE FUNCTION public.restrict_organizer_quote_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rfq_status text;
  _organizer_id uuid;
  _is_admin boolean;
  _is_hotel_owner boolean;
  _is_organizer boolean;
  _commercial_fields_changed boolean;
BEGIN
  SELECT r.status::text, r.organizer_id
    INTO _rfq_status, _organizer_id
  FROM public.rfqs r
  WHERE r.id = OLD.rfq_id;

  IF _rfq_status IS NULL THEN
    RAISE EXCEPTION 'Referenced request not found';
  END IF;

  _is_admin := public.has_role(auth.uid(), 'admin');
  _is_hotel_owner := EXISTS (
    SELECT 1
    FROM public.hotels h
    WHERE h.id = OLD.hotel_id
      AND h.owner_id = auth.uid()
  );
  _is_organizer := _organizer_id = auth.uid();

  IF _is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.rfq_id IS DISTINCT FROM OLD.rfq_id
     OR NEW.hotel_id IS DISTINCT FROM OLD.hotel_id
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Quote request, hotel, currency, and creation time are immutable';
  END IF;

  _commercial_fields_changed :=
    NEW.total_price IS DISTINCT FROM OLD.total_price
    OR NEW.price_per_room_night IS DISTINCT FROM OLD.price_per_room_night
    OR NEW.board_included IS DISTINCT FROM OLD.board_included
    OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.inclusions IS DISTINCT FROM OLD.inclusions
    OR NEW.included_services IS DISTINCT FROM OLD.included_services
    OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
    OR NEW.room_type IS DISTINCT FROM OLD.room_type;

  IF _is_hotel_owner THEN
    IF _rfq_status NOT IN ('open', 'quoting', 'under_review') THEN
      RAISE EXCEPTION 'Quotes cannot be changed after the request is closed, awarded, or cancelled';
    END IF;
    IF OLD.status::text NOT IN ('submitted', 'viewed', 'shortlisted') THEN
      RAISE EXCEPTION 'Accepted, rejected, or withdrawn quotes cannot be changed';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text <> 'withdrawn' THEN
      RAISE EXCEPTION 'Hotels may only withdraw an active quote';
    END IF;
    IF NEW.status::text = 'withdrawn' AND _commercial_fields_changed THEN
      RAISE EXCEPTION 'A quote cannot be edited and withdrawn in the same operation';
    END IF;
    RETURN NEW;
  END IF;

  IF _is_organizer THEN
    IF _commercial_fields_changed THEN
      RAISE EXCEPTION 'Organizers may only update quote status';
    END IF;
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
      RETURN NEW;
    END IF;
    IF NEW.status::text = 'accepted' THEN
      IF COALESCE(current_setting('gts.atomic_award', true), '') <> 'on' THEN
        RAISE EXCEPTION 'Quotes must be accepted through the atomic award operation';
      END IF;
      IF OLD.status::text NOT IN ('submitted', 'viewed', 'shortlisted') THEN
        RAISE EXCEPTION 'Only an active quote can be accepted';
      END IF;
      RETURN NEW;
    END IF;
    IF NOT (
      (OLD.status::text = 'submitted' AND NEW.status::text IN ('viewed', 'shortlisted', 'rejected'))
      OR (OLD.status::text = 'viewed' AND NEW.status::text IN ('shortlisted', 'rejected'))
      OR (OLD.status::text = 'shortlisted' AND NEW.status::text = 'rejected')
    ) THEN
      RAISE EXCEPTION 'Invalid quote status transition: % -> %', OLD.status, NEW.status;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only the hotel owner, request organizer, or an admin may update this quote';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restrict_organizer_quote_updates()
  FROM PUBLIC, anon, authenticated;

-- Validate quote creation against the invitation and RFQ lifecycle. This closes
-- the direct-API path that previously allowed quoting after an invitation decline.
CREATE OR REPLACE FUNCTION public.enforce_quote_submission_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rfq_status text;
  _invitation_status text;
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.hotels h
    WHERE h.id = NEW.hotel_id
      AND h.owner_id = auth.uid()
      AND h.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Only the approved hotel owner may submit this quote';
  END IF;

  SELECT r.status::text
    INTO _rfq_status
  FROM public.rfqs r
  WHERE r.id = NEW.rfq_id
  FOR SHARE;

  IF _rfq_status NOT IN ('open', 'quoting') THEN
    RAISE EXCEPTION 'This request is not accepting quotations';
  END IF;

  SELECT i.status::text
    INTO _invitation_status
  FROM public.rfq_invitations i
  WHERE i.rfq_id = NEW.rfq_id
    AND i.hotel_id = NEW.hotel_id;

  IF _invitation_status IS NULL THEN
    RAISE EXCEPTION 'A valid invitation is required to submit a quote';
  END IF;
  IF _invitation_status = 'declined' THEN
    RAISE EXCEPTION 'A declined invitation cannot submit a quote';
  END IF;
  IF _invitation_status = 'quoted' THEN
    RAISE EXCEPTION 'A quote has already been submitted for this invitation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_quote_submission_eligibility()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_quote_submission_eligibility ON public.quotes;
CREATE TRIGGER trg_enforce_quote_submission_eligibility
BEFORE INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.enforce_quote_submission_eligibility();

-- Keep invitation analytics/history synchronized with successful submissions.
CREATE OR REPLACE FUNCTION public.mark_invitation_quoted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rfq_invitations
     SET status = 'quoted'
   WHERE rfq_id = NEW.rfq_id
     AND hotel_id = NEW.hotel_id
     AND status IN ('pending', 'viewed');
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_invitation_quoted()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mark_invitation_quoted ON public.quotes;
CREATE TRIGGER trg_mark_invitation_quoted
AFTER INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.mark_invitation_quoted();

-- Declines remain historical and cannot be reversed by direct client updates.
CREATE OR REPLACE FUNCTION public.enforce_invitation_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_hotel_owner boolean;
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  _is_hotel_owner := EXISTS (
    SELECT 1
    FROM public.hotels h
    WHERE h.id = OLD.hotel_id
      AND h.owner_id = auth.uid()
  );

  -- System trigger update after quote insertion.
  IF pg_trigger_depth() > 1 AND NEW.status::text = 'quoted' THEN
    RETURN NEW;
  END IF;

  IF NOT _is_hotel_owner THEN
    RAISE EXCEPTION 'Only the invited hotel may update this invitation';
  END IF;
  IF NEW.rfq_id IS DISTINCT FROM OLD.rfq_id
     OR NEW.hotel_id IS DISTINCT FROM OLD.hotel_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Invitation request, hotel, and creation time are immutable';
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status::text NOT IN ('pending', 'viewed')
     OR NEW.status::text NOT IN ('viewed', 'declined') THEN
    RAISE EXCEPTION 'Invalid invitation status transition: % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.status::text = 'declined' AND EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.rfq_id = OLD.rfq_id
      AND q.hotel_id = OLD.hotel_id
  ) THEN
    RAISE EXCEPTION 'An invitation cannot be declined after a quote is submitted';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_invitation_lifecycle()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_invitation_lifecycle ON public.rfq_invitations;
CREATE TRIGGER trg_enforce_invitation_lifecycle
BEFORE UPDATE ON public.rfq_invitations
FOR EACH ROW EXECUTE FUNCTION public.enforce_invitation_lifecycle();

-- Notify the organizer when a hotel withdraws a quotation. The existing
-- quote_received notification category is reused for organizer quote activity.
CREATE OR REPLACE FUNCTION public.notify_organizer_on_quote_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _organizer_id uuid;
  _hotel_name text;
BEGIN
  IF NEW.status::text = 'withdrawn'
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT r.organizer_id
      INTO _organizer_id
    FROM public.rfqs r
    WHERE r.id = NEW.rfq_id;

    SELECT h.name
      INTO _hotel_name
    FROM public.hotels h
    WHERE h.id = NEW.hotel_id;

    IF _organizer_id IS NOT NULL THEN
      PERFORM public.create_notification(
        _organizer_id,
        'quote_received',
        'Quotation withdrawn',
        COALESCE(_hotel_name, 'A hotel') || ' withdrew its quotation',
        '/dashboard/rfqs/' || NEW.rfq_id::text,
        jsonb_build_object(
          'rfq_id', NEW.rfq_id,
          'quote_id', NEW.id,
          'hotel_id', NEW.hotel_id,
          'action', 'withdrawn'
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_organizer_on_quote_withdrawal()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_organizer_on_quote_withdrawal ON public.quotes;
CREATE TRIGGER trg_notify_organizer_on_quote_withdrawal
AFTER UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.notify_organizer_on_quote_withdrawal();

-- Atomic award operation. PostgreSQL functions execute in the caller's
-- transaction; any exception rolls back every update, insert, notification,
-- conversation side effect, and lifecycle event.
CREATE OR REPLACE FUNCTION public.award_quote(
  _rfq_id uuid,
  _quote_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _rfq public.rfqs%ROWTYPE;
  _quote public.quotes%ROWTYPE;
  _booking_id uuid;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
    INTO _rfq
  FROM public.rfqs
  WHERE id = _rfq_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF _rfq.organizer_id <> _caller THEN
    RAISE EXCEPTION 'Only the request organizer may award a quote';
  END IF;
  IF _rfq.status::text NOT IN ('open', 'quoting', 'under_review') THEN
    RAISE EXCEPTION 'This request can no longer be awarded';
  END IF;

  SELECT *
    INTO _quote
  FROM public.quotes
  WHERE id = _quote_id
    AND rfq_id = _rfq_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found for this request';
  END IF;
  IF _quote.status::text NOT IN ('submitted', 'viewed', 'shortlisted') THEN
    RAISE EXCEPTION 'Only an active quote can be awarded';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.rfq_id = _rfq_id
  ) THEN
    RAISE EXCEPTION 'A booking already exists for this request';
  END IF;

  PERFORM set_config('gts.atomic_award', 'on', true);

  UPDATE public.quotes
     SET status = 'rejected'
   WHERE rfq_id = _rfq_id
     AND id <> _quote_id
     AND status IN ('submitted', 'viewed', 'shortlisted');

  UPDATE public.quotes
     SET status = 'accepted'
   WHERE id = _quote_id;

  INSERT INTO public.bookings (
    rfq_id,
    quote_id,
    organizer_id,
    hotel_id,
    total_amount,
    commission_amount
  ) VALUES (
    _rfq_id,
    _quote_id,
    _caller,
    _quote.hotel_id,
    _quote.total_price,
    round(_quote.total_price * 0.10, 2)
  )
  RETURNING id INTO _booking_id;

  UPDATE public.rfqs
     SET status = 'awarded'
   WHERE id = _rfq_id;

  RETURN _booking_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_quote(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_quote(uuid, uuid)
  TO authenticated;
