-- GroupToStay V3 Offer Revision and Counteroffer Engine.
-- Existing public.offers rows remain immutable commercial snapshots and become version 1.

BEGIN;

DO $$
DECLARE
  _offer_labels text[];
BEGIN
  IF to_regclass('public.deals') IS NULL
     OR to_regclass('public.offers') IS NULL
     OR to_regclass('public.organizations') IS NULL
     OR to_regclass('public.organization_memberships') IS NULL
     OR to_regclass('public.admin_audit_logs') IS NULL THEN
    RAISE EXCEPTION 'Offer revision prerequisites are missing';
  END IF;

  IF to_regclass('public.offer_threads') IS NOT NULL THEN
    RAISE EXCEPTION 'Offer revision foundation already exists unexpectedly';
  END IF;

  SELECT array_agg(enum.enumlabel ORDER BY enum.enumsortorder)
  INTO _offer_labels
  FROM pg_enum enum
  JOIN pg_type type ON type.oid = enum.enumtypid
  JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
  WHERE namespace.nspname = 'public' AND type.typname = 'offer_status';

  IF _offer_labels IS DISTINCT FROM ARRAY[
    'submitted', 'accepted', 'rejected', 'withdrawn', 'expired'
  ]::text[] THEN
    RAISE EXCEPTION 'Unexpected Offer status catalog: %', _offer_labels;
  END IF;

  IF EXISTS (
    SELECT offer.deal_id
    FROM public.offers offer
    WHERE offer.status = 'accepted'
    GROUP BY offer.deal_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'A Deal already has more than one accepted Offer';
  END IF;
END;
$$;

ALTER TYPE public.offer_status ADD VALUE IF NOT EXISTS 'superseded';

CREATE TABLE public.offer_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id uuid,
  latest_version_number bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offer_threads_id_deal_key UNIQUE (id, deal_id),
  CONSTRAINT offer_threads_latest_version_check CHECK (latest_version_number >= 0),
  CONSTRAINT offer_threads_request_actor_check CHECK (request_id IS NULL OR created_by IS NOT NULL)
);

COMMENT ON TABLE public.offer_threads IS
  'Commercial alternatives inside a Deal. Each thread contains immutable public.offers versions.';

CREATE INDEX idx_offer_threads_deal_created
  ON public.offer_threads(deal_id, created_at DESC);
CREATE UNIQUE INDEX idx_offer_threads_actor_request
  ON public.offer_threads(created_by, request_id)
  WHERE request_id IS NOT NULL;

ALTER TABLE public.offers
  ADD COLUMN offer_thread_id uuid,
  ADD COLUMN version_number bigint,
  ADD COLUMN submitted_by_organization_id uuid,
  ADD COLUMN parent_offer_id uuid;

INSERT INTO public.offer_threads (
  id,
  deal_id,
  created_by,
  latest_version_number,
  created_at,
  updated_at
)
SELECT
  offer.id,
  offer.deal_id,
  offer.created_by,
  1,
  offer.created_at,
  offer.updated_at
FROM public.offers offer;

UPDATE public.offers
SET offer_thread_id = id,
    version_number = 1,
    submitted_by_organization_id = supplier_organization_id,
    parent_offer_id = NULL;

ALTER TABLE public.offers
  ALTER COLUMN offer_thread_id SET NOT NULL,
  ALTER COLUMN version_number SET NOT NULL,
  ALTER COLUMN submitted_by_organization_id SET NOT NULL,
  ADD CONSTRAINT offers_thread_deal_fkey
    FOREIGN KEY (offer_thread_id, deal_id)
    REFERENCES public.offer_threads(id, deal_id) ON DELETE RESTRICT,
  ADD CONSTRAINT offers_submitted_by_organization_fkey
    FOREIGN KEY (submitted_by_organization_id)
    REFERENCES public.organizations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT offers_parent_offer_fkey
    FOREIGN KEY (parent_offer_id)
    REFERENCES public.offers(id) ON DELETE RESTRICT,
  ADD CONSTRAINT offers_thread_version_key UNIQUE (offer_thread_id, version_number),
  ADD CONSTRAINT offers_version_positive_check CHECK (version_number > 0),
  ADD CONSTRAINT offers_parent_not_self_check CHECK (parent_offer_id IS NULL OR parent_offer_id <> id),
  ADD CONSTRAINT offers_version_parent_shape_check CHECK (
    (version_number = 1 AND parent_offer_id IS NULL)
    OR (version_number > 1 AND parent_offer_id IS NOT NULL)
  );

CREATE UNIQUE INDEX idx_offers_one_response_per_parent
  ON public.offers(parent_offer_id)
  WHERE parent_offer_id IS NOT NULL;
CREATE INDEX idx_offers_thread_version
  ON public.offers(offer_thread_id, version_number DESC);
CREATE INDEX idx_offers_deal_actionable
  ON public.offers(deal_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_deal_offer_event(
  _action text,
  _entity_type text,
  _entity_id uuid,
  _previous_state jsonb DEFAULT '{}'::jsonb,
  _new_state jsonb DEFAULT '{}'::jsonb,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
BEGIN
  IF _actor_id IS NULL
     OR _entity_type NOT IN ('deal', 'offer', 'offer_thread')
     OR _action NOT IN (
       'deal.status_changed',
       'offer.status_changed',
       'offer.version_submitted',
       'offer_thread.created',
       'offer_thread.version_advanced'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Deal workflow audit action is not available';
  END IF;

  INSERT INTO public.admin_audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    previous_state,
    new_state,
    metadata
  ) VALUES (
    _actor_id,
    _action,
    _entity_type,
    _entity_id::text,
    COALESCE(_previous_state, '{}'::jsonb),
    COALESCE(_new_state, '{}'::jsonb),
    jsonb_build_object('source', 'offer_revision_engine')
      || COALESCE(_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_deal_offer_transition(
  _entity_type text,
  _entity_id uuid,
  _from_status text,
  _to_status text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF _entity_type NOT IN ('deal', 'offer') THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Deal workflow audit action is not available';
  END IF;

  PERFORM public.record_deal_offer_event(
    _entity_type || '.status_changed',
    _entity_type,
    _entity_id,
    jsonb_build_object('status', _from_status),
    jsonb_build_object('status', _to_status),
    _metadata
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_offer_foundation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _deal public.deals%ROWTYPE;
  _thread public.offer_threads%ROWTYPE;
  _parent public.offers%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
    OR NEW.supplier_organization_id IS DISTINCT FROM OLD.supplier_organization_id
    OR NEW.offer_thread_id IS DISTINCT FROM OLD.offer_thread_id
    OR NEW.version_number IS DISTINCT FROM OLD.version_number
    OR NEW.submitted_by_organization_id IS DISTINCT FROM OLD.submitted_by_organization_id
    OR NEW.parent_offer_id IS DISTINCT FROM OLD.parent_offer_id
    OR NEW.amount IS DISTINCT FROM OLD.amount
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
    OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Submitted Offer Version commercial terms and lineage are immutable';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  NEW.created_at := now();
  NEW.updated_at := NEW.created_at;

  SELECT deal.* INTO _deal
  FROM public.deals deal
  WHERE deal.id = NEW.deal_id
    AND deal.supplier_organization_id = NEW.supplier_organization_id;

  IF NOT FOUND OR _deal.status <> 'active' THEN
    RAISE EXCEPTION 'Offer Versions may only be submitted to an active Deal';
  END IF;
  IF NEW.status <> 'submitted' THEN
    RAISE EXCEPTION 'New Offer Versions must begin in submitted status';
  END IF;
  IF NEW.valid_until IS NOT NULL AND NEW.valid_until <= now() THEN
    RAISE EXCEPTION 'Offer validity must be in the future';
  END IF;

  -- The Feature 2 Supplier INSERT path remains a v1 compatibility boundary.
  IF NEW.offer_thread_id IS NULL THEN
    IF NEW.parent_offer_id IS NOT NULL OR NEW.version_number IS NOT NULL THEN
      RAISE EXCEPTION 'Legacy initial Offer lineage is invalid';
    END IF;
    NEW.offer_thread_id := NEW.id;
    NEW.version_number := 1;
    NEW.submitted_by_organization_id := NEW.supplier_organization_id;
    INSERT INTO public.offer_threads (
      id, deal_id, created_by, latest_version_number, created_at, updated_at
    ) VALUES (
      NEW.offer_thread_id, NEW.deal_id, NEW.created_by, 1, NEW.created_at, NEW.updated_at
    );
    RETURN NEW;
  END IF;

  SELECT thread.* INTO _thread
  FROM public.offer_threads thread
  WHERE thread.id = NEW.offer_thread_id
    AND thread.deal_id = NEW.deal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer Thread does not belong to the Deal';
  END IF;
  IF NEW.submitted_by_organization_id NOT IN (
    _deal.buyer_organization_id,
    _deal.supplier_organization_id
  ) THEN
    RAISE EXCEPTION 'Offer submitter is not a Deal participant';
  END IF;
  IF NEW.version_number <> _thread.latest_version_number + 1 THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Offer version sequence changed concurrently';
  END IF;

  IF NEW.version_number = 1 THEN
    IF NEW.parent_offer_id IS NOT NULL
       OR NEW.submitted_by_organization_id <> _deal.supplier_organization_id THEN
      RAISE EXCEPTION 'Initial Offer must be submitted by the Supplier';
    END IF;
  ELSE
    SELECT parent.* INTO _parent
    FROM public.offers parent
    WHERE parent.id = NEW.parent_offer_id
      AND parent.offer_thread_id = NEW.offer_thread_id
      AND parent.version_number = NEW.version_number - 1;

    IF NOT FOUND
       OR _parent.submitted_by_organization_id = NEW.submitted_by_organization_id THEN
      RAISE EXCEPTION 'Counteroffer lineage or turn is invalid';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_offer_version_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.version_number = 1 THEN
    PERFORM public.record_deal_offer_event(
      'offer_thread.created',
      'offer_thread',
      NEW.offer_thread_id,
      '{}'::jsonb,
      jsonb_build_object('latest_version_number', 1),
      jsonb_build_object(
        'deal_id', NEW.deal_id,
        'submitted_by_organization_id', NEW.submitted_by_organization_id
      )
    );
  END IF;

  PERFORM public.record_deal_offer_event(
    'offer.version_submitted',
    'offer',
    NEW.id,
    '{}'::jsonb,
    jsonb_build_object('status', NEW.status, 'version_number', NEW.version_number),
    jsonb_build_object(
      'deal_id', NEW.deal_id,
      'offer_thread_id', NEW.offer_thread_id,
      'parent_offer_id', NEW.parent_offer_id,
      'submitted_by_organization_id', NEW.submitted_by_organization_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS offers_audit_version_submission ON public.offers;
CREATE TRIGGER offers_audit_version_submission
AFTER INSERT ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.audit_offer_version_submission();

DROP TRIGGER IF EXISTS offer_threads_updated ON public.offer_threads;
CREATE TRIGGER offer_threads_updated
BEFORE UPDATE ON public.offer_threads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.submit_initial_deal_offer(
  _deal_id uuid,
  _amount numeric,
  _currency text,
  _valid_until timestamptz,
  _notes text,
  _request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _deal public.deals%ROWTYPE;
  _thread public.offer_threads%ROWTYPE;
  _offer public.offers%ROWTYPE;
  _existing_offer public.offers%ROWTYPE;
  _normalized_currency text := upper(trim(_currency));
BEGIN
  IF _actor_id IS NULL OR _request_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT thread.* INTO _thread
  FROM public.offer_threads thread
  WHERE thread.created_by = _actor_id AND thread.request_id = _request_id;

  IF FOUND THEN
    SELECT offer.* INTO _existing_offer
    FROM public.offers offer
    WHERE offer.offer_thread_id = _thread.id AND offer.version_number = 1;
    IF _thread.deal_id = _deal_id
       AND _existing_offer.amount = _amount
       AND _existing_offer.currency = _normalized_currency
       AND _existing_offer.valid_until IS NOT DISTINCT FROM _valid_until
       AND _existing_offer.notes IS NOT DISTINCT FROM nullif(trim(_notes), '') THEN
      RETURN jsonb_build_object(
        'deal_id', _deal_id,
        'offer_thread_id', _thread.id,
        'offer_id', _existing_offer.id,
        'version_number', 1,
        'status', _existing_offer.status,
        'idempotent', true
      );
    END IF;
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Initial Offer request was already used';
  END IF;

  SELECT deal.* INTO _deal
  FROM public.deals deal
  WHERE deal.id = _deal_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT public.is_active_organization_member(_deal.supplier_organization_id)
     OR public.user_organization_role(_deal.supplier_organization_id)
       NOT IN ('owner', 'admin', 'sales', 'reservations')
     OR public.is_active_organization_member(_deal.buyer_organization_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;
  IF _deal.status <> 'active' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Deal is not active';
  END IF;

  INSERT INTO public.offer_threads (deal_id, created_by, request_id)
  VALUES (_deal.id, _actor_id, _request_id)
  RETURNING * INTO _thread;

  INSERT INTO public.offers (
    deal_id,
    supplier_organization_id,
    offer_thread_id,
    version_number,
    submitted_by_organization_id,
    parent_offer_id,
    amount,
    currency,
    valid_until,
    notes,
    status,
    created_by
  ) VALUES (
    _deal.id,
    _deal.supplier_organization_id,
    _thread.id,
    1,
    _deal.supplier_organization_id,
    NULL,
    _amount,
    _normalized_currency,
    _valid_until,
    nullif(trim(_notes), ''),
    'submitted',
    _actor_id
  )
  RETURNING * INTO _offer;

  UPDATE public.offer_threads
  SET latest_version_number = 1
  WHERE id = _thread.id AND latest_version_number = 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Offer Thread changed concurrently';
  END IF;

  RETURN jsonb_build_object(
    'deal_id', _deal.id,
    'offer_thread_id', _thread.id,
    'offer_id', _offer.id,
    'version_number', 1,
    'status', _offer.status,
    'idempotent', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.counter_deal_offer(
  _parent_offer_id uuid,
  _amount numeric,
  _currency text,
  _valid_until timestamptz,
  _notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _deal_id uuid;
  _thread_id uuid;
  _deal public.deals%ROWTYPE;
  _thread public.offer_threads%ROWTYPE;
  _parent public.offers%ROWTYPE;
  _child public.offers%ROWTYPE;
  _actor_organization_id uuid;
  _buyer_actor boolean;
  _supplier_actor boolean;
  _next_version bigint;
  _normalized_currency text := upper(trim(_currency));
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT offer.deal_id, offer.offer_thread_id
  INTO _deal_id, _thread_id
  FROM public.offers offer
  WHERE offer.id = _parent_offer_id;

  IF _deal_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT deal.* INTO _deal
  FROM public.deals deal
  WHERE deal.id = _deal_id
  FOR UPDATE;

  SELECT thread.* INTO _thread
  FROM public.offer_threads thread
  WHERE thread.id = _thread_id AND thread.deal_id = _deal.id
  FOR UPDATE;

  SELECT offer.* INTO _parent
  FROM public.offers offer
  WHERE offer.id = _parent_offer_id
    AND offer.deal_id = _deal.id
    AND offer.offer_thread_id = _thread.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  _buyer_actor := public.is_active_organization_member(_deal.buyer_organization_id)
    AND public.user_organization_role(_deal.buyer_organization_id) IN ('owner', 'admin', 'agent');
  _supplier_actor := public.is_active_organization_member(_deal.supplier_organization_id)
    AND public.user_organization_role(_deal.supplier_organization_id)
      IN ('owner', 'admin', 'sales', 'reservations');

  IF _buyer_actor = _supplier_actor THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;
  _actor_organization_id := CASE
    WHEN _buyer_actor THEN _deal.buyer_organization_id
    ELSE _deal.supplier_organization_id
  END;

  SELECT offer.* INTO _child
  FROM public.offers offer
  WHERE offer.parent_offer_id = _parent.id;

  IF FOUND THEN
    IF _child.created_by = _actor_id
       AND _child.submitted_by_organization_id = _actor_organization_id
       AND _child.amount = _amount
       AND _child.currency = _normalized_currency
       AND _child.valid_until IS NOT DISTINCT FROM _valid_until
       AND _child.notes IS NOT DISTINCT FROM nullif(trim(_notes), '') THEN
      RETURN jsonb_build_object(
        'deal_id', _deal.id,
        'offer_thread_id', _thread.id,
        'offer_id', _child.id,
        'version_number', _child.version_number,
        'status', _child.status,
        'idempotent', true
      );
    END IF;
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Offer Version changed concurrently';
  END IF;

  IF _deal.status <> 'active'
     OR _parent.status <> 'submitted'
     OR _parent.version_number <> _thread.latest_version_number THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Offer Version is no longer actionable';
  END IF;
  IF _parent.valid_until IS NOT NULL AND _parent.valid_until <= clock_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Offer Version has expired';
  END IF;
  IF _parent.submitted_by_organization_id = _actor_organization_id THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A party cannot counter its own Offer Version';
  END IF;

  _next_version := _thread.latest_version_number + 1;

  UPDATE public.offers
  SET status = 'superseded'
  WHERE id = _parent.id AND status = 'submitted';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Offer Version changed concurrently';
  END IF;

  PERFORM public.record_deal_offer_transition(
    'offer',
    _parent.id,
    'submitted',
    'superseded',
    jsonb_build_object(
      'deal_id', _deal.id,
      'offer_thread_id', _thread.id,
      'reason', 'counteroffer_submitted'
    )
  );

  INSERT INTO public.offers (
    deal_id,
    supplier_organization_id,
    offer_thread_id,
    version_number,
    submitted_by_organization_id,
    parent_offer_id,
    amount,
    currency,
    valid_until,
    notes,
    status,
    created_by
  ) VALUES (
    _deal.id,
    _deal.supplier_organization_id,
    _thread.id,
    _next_version,
    _actor_organization_id,
    _parent.id,
    _amount,
    _normalized_currency,
    _valid_until,
    nullif(trim(_notes), ''),
    'submitted',
    _actor_id
  )
  RETURNING * INTO _child;

  UPDATE public.offer_threads
  SET latest_version_number = _next_version
  WHERE id = _thread.id AND latest_version_number = _parent.version_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Offer Thread changed concurrently';
  END IF;

  PERFORM public.record_deal_offer_event(
    'offer_thread.version_advanced',
    'offer_thread',
    _thread.id,
    jsonb_build_object('latest_version_number', _parent.version_number),
    jsonb_build_object('latest_version_number', _next_version),
    jsonb_build_object(
      'deal_id', _deal.id,
      'previous_offer_id', _parent.id,
      'new_offer_id', _child.id,
      'submitted_by_organization_id', _actor_organization_id
    )
  );

  RETURN jsonb_build_object(
    'deal_id', _deal.id,
    'offer_thread_id', _thread.id,
    'offer_id', _child.id,
    'version_number', _next_version,
    'status', _child.status,
    'idempotent', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_deal_offer(_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _deal_id uuid;
  _thread_id uuid;
  _deal public.deals%ROWTYPE;
  _thread public.offer_threads%ROWTYPE;
  _offer public.offers%ROWTYPE;
  _competing_offer record;
  _rejected_count integer := 0;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT offer.deal_id, offer.offer_thread_id INTO _deal_id, _thread_id
  FROM public.offers offer WHERE offer.id = _offer_id;
  IF _deal_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT deal.* INTO _deal FROM public.deals deal WHERE deal.id = _deal_id FOR UPDATE;
  IF NOT FOUND
     OR NOT public.is_active_organization_member(_deal.buyer_organization_id)
     OR public.user_organization_role(_deal.buyer_organization_id)
       NOT IN ('owner', 'admin', 'agent')
     OR public.is_active_organization_member(_deal.supplier_organization_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT thread.* INTO _thread
  FROM public.offer_threads thread
  WHERE thread.id = _thread_id AND thread.deal_id = _deal.id
  FOR UPDATE;

  SELECT offer.* INTO _offer
  FROM public.offers offer
  WHERE offer.id = _offer_id
    AND offer.deal_id = _deal.id
    AND offer.offer_thread_id = _thread.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;
  IF _offer.status = 'accepted' AND _deal.status = 'agreed' THEN
    RETURN jsonb_build_object(
      'deal_id', _deal.id,
      'offer_thread_id', _thread.id,
      'offer_id', _offer.id,
      'version_number', _offer.version_number,
      'deal_status', _deal.status,
      'offer_status', _offer.status,
      'competing_offers_rejected', 0,
      'idempotent', true
    );
  END IF;

  IF _deal.status <> 'active'
     OR _offer.status <> 'submitted'
     OR _offer.version_number <> _thread.latest_version_number
     OR _offer.submitted_by_organization_id <> _deal.supplier_organization_id THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Offer Version cannot be accepted';
  END IF;
  IF _offer.valid_until IS NOT NULL AND _offer.valid_until <= clock_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Offer Version has expired';
  END IF;

  UPDATE public.offers SET status = 'accepted'
  WHERE id = _offer.id AND status = 'submitted';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Offer Version changed concurrently';
  END IF;

  PERFORM public.record_deal_offer_transition(
    'offer',
    _offer.id,
    'submitted',
    'accepted',
    jsonb_build_object(
      'deal_id', _deal.id,
      'offer_thread_id', _thread.id,
      'version_number', _offer.version_number,
      'selected', true
    )
  );

  FOR _competing_offer IN
    UPDATE public.offers
    SET status = 'rejected'
    WHERE deal_id = _deal.id
      AND id <> _offer.id
      AND status = 'submitted'
    RETURNING id, offer_thread_id, version_number
  LOOP
    _rejected_count := _rejected_count + 1;
    PERFORM public.record_deal_offer_transition(
      'offer',
      _competing_offer.id,
      'submitted',
      'rejected',
      jsonb_build_object(
        'deal_id', _deal.id,
        'offer_thread_id', _competing_offer.offer_thread_id,
        'version_number', _competing_offer.version_number,
        'reason', 'competing_offer_accepted',
        'accepted_offer_id', _offer.id
      )
    );
  END LOOP;

  UPDATE public.deals SET status = 'agreed'
  WHERE id = _deal.id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Deal state changed concurrently';
  END IF;

  PERFORM public.record_deal_offer_transition(
    'deal',
    _deal.id,
    'active',
    'agreed',
    jsonb_build_object(
      'accepted_offer_id', _offer.id,
      'offer_thread_id', _thread.id,
      'version_number', _offer.version_number
    )
  );

  RETURN jsonb_build_object(
    'deal_id', _deal.id,
    'offer_thread_id', _thread.id,
    'offer_id', _offer.id,
    'version_number', _offer.version_number,
    'deal_status', 'agreed',
    'offer_status', 'accepted',
    'competing_offers_rejected', _rejected_count,
    'idempotent', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_deal_offer(_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _deal_id uuid;
  _thread_id uuid;
  _deal public.deals%ROWTYPE;
  _thread public.offer_threads%ROWTYPE;
  _offer public.offers%ROWTYPE;
  _actor_organization_id uuid;
  _buyer_actor boolean;
  _supplier_actor boolean;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT offer.deal_id, offer.offer_thread_id INTO _deal_id, _thread_id
  FROM public.offers offer WHERE offer.id = _offer_id;
  IF _deal_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT deal.* INTO _deal FROM public.deals deal WHERE deal.id = _deal_id FOR UPDATE;
  SELECT thread.* INTO _thread
  FROM public.offer_threads thread
  WHERE thread.id = _thread_id AND thread.deal_id = _deal.id
  FOR UPDATE;
  SELECT offer.* INTO _offer
  FROM public.offers offer
  WHERE offer.id = _offer_id AND offer.offer_thread_id = _thread.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  _buyer_actor := public.is_active_organization_member(_deal.buyer_organization_id)
    AND public.user_organization_role(_deal.buyer_organization_id) IN ('owner', 'admin', 'agent');
  _supplier_actor := public.is_active_organization_member(_deal.supplier_organization_id)
    AND public.user_organization_role(_deal.supplier_organization_id)
      IN ('owner', 'admin', 'sales', 'reservations');
  IF _buyer_actor = _supplier_actor THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;
  _actor_organization_id := CASE
    WHEN _buyer_actor THEN _deal.buyer_organization_id
    ELSE _deal.supplier_organization_id
  END;

  IF _deal.status <> 'active'
     OR _offer.status <> 'submitted'
     OR _offer.version_number <> _thread.latest_version_number
     OR _offer.submitted_by_organization_id = _actor_organization_id THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Offer Version cannot be rejected';
  END IF;

  UPDATE public.offers SET status = 'rejected'
  WHERE id = _offer.id AND status = 'submitted';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Offer Version changed concurrently';
  END IF;

  PERFORM public.record_deal_offer_transition(
    'offer',
    _offer.id,
    'submitted',
    'rejected',
    jsonb_build_object(
      'deal_id', _deal.id,
      'offer_thread_id', _thread.id,
      'version_number', _offer.version_number,
      'deciding_organization_id', _actor_organization_id
    )
  );

  RETURN jsonb_build_object(
    'deal_id', _deal.id,
    'offer_thread_id', _thread.id,
    'offer_id', _offer.id,
    'version_number', _offer.version_number,
    'status', 'rejected'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_deal_offer(_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _deal_id uuid;
  _thread_id uuid;
  _deal public.deals%ROWTYPE;
  _thread public.offer_threads%ROWTYPE;
  _offer public.offers%ROWTYPE;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;
  SELECT offer.deal_id, offer.offer_thread_id INTO _deal_id, _thread_id
  FROM public.offers offer WHERE offer.id = _offer_id;
  IF _deal_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT deal.* INTO _deal FROM public.deals deal WHERE deal.id = _deal_id FOR UPDATE;
  SELECT thread.* INTO _thread
  FROM public.offer_threads thread
  WHERE thread.id = _thread_id AND thread.deal_id = _deal.id
  FOR UPDATE;
  SELECT offer.* INTO _offer
  FROM public.offers offer
  WHERE offer.id = _offer_id AND offer.offer_thread_id = _thread.id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT public.is_active_organization_member(_deal.supplier_organization_id)
     OR public.user_organization_role(_deal.supplier_organization_id)
       NOT IN ('owner', 'admin', 'sales', 'reservations')
     OR public.is_active_organization_member(_deal.buyer_organization_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;
  IF _deal.status <> 'active'
     OR _offer.status <> 'submitted'
     OR _offer.version_number <> _thread.latest_version_number
     OR _offer.submitted_by_organization_id <> _deal.supplier_organization_id THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Offer Version cannot be withdrawn';
  END IF;

  UPDATE public.offers SET status = 'withdrawn'
  WHERE id = _offer.id AND status = 'submitted';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Offer Version changed concurrently';
  END IF;

  PERFORM public.record_deal_offer_transition(
    'offer',
    _offer.id,
    'submitted',
    'withdrawn',
    jsonb_build_object(
      'deal_id', _deal.id,
      'offer_thread_id', _thread.id,
      'version_number', _offer.version_number
    )
  );

  RETURN jsonb_build_object(
    'deal_id', _deal.id,
    'offer_thread_id', _thread.id,
    'offer_id', _offer.id,
    'version_number', _offer.version_number,
    'status', 'withdrawn'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_deal_offer(_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _deal_id uuid;
  _thread_id uuid;
  _deal public.deals%ROWTYPE;
  _thread public.offer_threads%ROWTYPE;
  _offer public.offers%ROWTYPE;
  _buyer_actor boolean;
  _supplier_actor boolean;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;
  SELECT offer.deal_id, offer.offer_thread_id INTO _deal_id, _thread_id
  FROM public.offers offer WHERE offer.id = _offer_id;
  IF _deal_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT deal.* INTO _deal FROM public.deals deal WHERE deal.id = _deal_id FOR UPDATE;
  SELECT thread.* INTO _thread
  FROM public.offer_threads thread
  WHERE thread.id = _thread_id AND thread.deal_id = _deal.id
  FOR UPDATE;
  SELECT offer.* INTO _offer
  FROM public.offers offer
  WHERE offer.id = _offer_id AND offer.offer_thread_id = _thread.id
  FOR UPDATE;

  _buyer_actor := public.is_active_organization_member(_deal.buyer_organization_id)
    AND public.user_organization_role(_deal.buyer_organization_id) IN ('owner', 'admin', 'agent');
  _supplier_actor := public.is_active_organization_member(_deal.supplier_organization_id)
    AND public.user_organization_role(_deal.supplier_organization_id)
      IN ('owner', 'admin', 'sales', 'reservations');

  IF NOT FOUND OR _buyer_actor = _supplier_actor THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;
  IF _deal.status <> 'active'
     OR _offer.status <> 'submitted'
     OR _offer.version_number <> _thread.latest_version_number
     OR _offer.valid_until IS NULL
     OR _offer.valid_until > clock_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Offer Version cannot be expired';
  END IF;

  UPDATE public.offers SET status = 'expired'
  WHERE id = _offer.id AND status = 'submitted';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Offer Version changed concurrently';
  END IF;

  PERFORM public.record_deal_offer_transition(
    'offer',
    _offer.id,
    'submitted',
    'expired',
    jsonb_build_object(
      'deal_id', _deal.id,
      'offer_thread_id', _thread.id,
      'version_number', _offer.version_number
    )
  );

  RETURN jsonb_build_object(
    'deal_id', _deal.id,
    'offer_thread_id', _thread.id,
    'offer_id', _offer.id,
    'version_number', _offer.version_number,
    'status', 'expired'
  );
END;
$$;

-- Keep the Feature 2 direct INSERT path for initial Supplier Offers only.
-- RLS WITH CHECK sees the row after the BEFORE trigger has assigned v1 lineage.
DROP POLICY IF EXISTS "Supplier members submit Offers" ON public.offers;
CREATE POLICY "Supplier members submit Offers"
ON public.offers FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND status = 'submitted'
  AND offer_thread_id = id
  AND version_number = 1
  AND parent_offer_id IS NULL
  AND submitted_by_organization_id = supplier_organization_id
  AND public.is_active_organization_member(supplier_organization_id)
  AND public.user_organization_role(supplier_organization_id)
    IN ('owner', 'admin', 'sales', 'reservations')
  AND EXISTS (
    SELECT 1
    FROM public.deals deal
    WHERE deal.id = offers.deal_id
      AND deal.supplier_organization_id = offers.supplier_organization_id
      AND deal.status = 'active'
      AND NOT public.is_active_organization_member(deal.buyer_organization_id)
  )
);

ALTER TABLE public.offer_threads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.offer_threads FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.offer_threads TO authenticated;
GRANT ALL ON public.offer_threads TO service_role;

CREATE POLICY "Deal participants and platform admins view Offer Threads"
ON public.offer_threads FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.deals deal
    WHERE deal.id = offer_threads.deal_id
      AND (
        public.is_active_organization_member(deal.buyer_organization_id)
        OR public.is_active_organization_member(deal.supplier_organization_id)
        OR public.is_enterprise_admin(auth.uid())
      )
  )
);

REVOKE ALL ON FUNCTION public.record_deal_offer_event(text, text, uuid, jsonb, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_offer_version_submission()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_initial_deal_offer(uuid, numeric, text, timestamptz, text, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.counter_deal_offer(uuid, numeric, text, timestamptz, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.submit_initial_deal_offer(
  uuid, numeric, text, timestamptz, text, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.counter_deal_offer(
  uuid, numeric, text, timestamptz, text
) TO authenticated;

DO $$
DECLARE
  _offer_labels text[];
BEGIN
  SELECT array_agg(enum.enumlabel ORDER BY enum.enumsortorder)
  INTO _offer_labels
  FROM pg_enum enum
  JOIN pg_type type ON type.oid = enum.enumtypid
  JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
  WHERE namespace.nspname = 'public' AND type.typname = 'offer_status';

  IF _offer_labels IS DISTINCT FROM ARRAY[
    'submitted', 'accepted', 'rejected', 'withdrawn', 'expired', 'superseded'
  ]::text[] THEN
    RAISE EXCEPTION 'Offer status postcondition failed: %', _offer_labels;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'offer_threads'
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Offer Thread RLS postcondition failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants grant_row
    WHERE grant_row.table_schema = 'public'
      AND grant_row.table_name IN ('offer_threads', 'offers')
      AND grant_row.grantee = 'authenticated'
      AND grant_row.privilege_type IN ('UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'Direct commercial-history mutation grant detected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.offers offer
    LEFT JOIN public.offer_threads thread
      ON thread.id = offer.offer_thread_id AND thread.deal_id = offer.deal_id
    WHERE thread.id IS NULL
       OR offer.version_number < 1
       OR offer.submitted_by_organization_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Offer Version backfill postcondition failed';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname IN ('submit_initial_deal_offer', 'counter_deal_offer')
  ) <> 2 THEN
    RAISE EXCEPTION 'Offer revision command postcondition failed';
  END IF;
END;
$$;

COMMIT;
