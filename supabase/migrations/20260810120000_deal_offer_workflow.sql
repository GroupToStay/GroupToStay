-- GroupToStay V3 Deal and Offer workflow.
-- State changes are command-only, organization-authorized, audited, and transactional.

BEGIN;

DO $$
DECLARE
  _deal_labels text[];
  _offer_labels text[];
BEGIN
  IF to_regclass('public.deals') IS NULL
     OR to_regclass('public.offers') IS NULL
     OR to_regclass('public.organization_memberships') IS NULL
     OR to_regclass('public.admin_audit_logs') IS NULL THEN
    RAISE EXCEPTION 'Deal and Offer workflow prerequisites are missing';
  END IF;

  SELECT array_agg(enum.enumlabel ORDER BY enum.enumsortorder)
  INTO _deal_labels
  FROM pg_enum enum
  JOIN pg_type type ON type.oid = enum.enumtypid
  JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
  WHERE namespace.nspname = 'public' AND type.typname = 'deal_status';

  SELECT array_agg(enum.enumlabel ORDER BY enum.enumsortorder)
  INTO _offer_labels
  FROM pg_enum enum
  JOIN pg_type type ON type.oid = enum.enumtypid
  JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
  WHERE namespace.nspname = 'public' AND type.typname = 'offer_status';

  IF _deal_labels IS DISTINCT FROM ARRAY['active', 'agreed', 'closed', 'cancelled']::text[]
     OR _offer_labels IS DISTINCT FROM ARRAY[
       'submitted', 'accepted', 'rejected', 'withdrawn', 'expired'
     ]::text[] THEN
    RAISE EXCEPTION 'Unexpected Deal or Offer state catalog';
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_one_accepted_per_deal
  ON public.offers(deal_id)
  WHERE status = 'accepted';

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
DECLARE
  _actor_id uuid := auth.uid();
BEGIN
  IF _actor_id IS NULL OR _entity_type NOT IN ('deal', 'offer') THEN
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
    _entity_type || '.status_changed',
    _entity_type,
    _entity_id::text,
    jsonb_build_object('status', _from_status),
    jsonb_build_object('status', _to_status),
    jsonb_build_object('source', 'deal_offer_workflow') || COALESCE(_metadata, '{}'::jsonb)
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
  _deal public.deals%ROWTYPE;
  _offer public.offers%ROWTYPE;
  _competing_offer record;
  _rejected_count integer := 0;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT offer.deal_id INTO _deal_id
  FROM public.offers offer
  WHERE offer.id = _offer_id;

  IF _deal_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT deal.* INTO _deal
  FROM public.deals deal
  WHERE deal.id = _deal_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT public.is_active_organization_member(_deal.buyer_organization_id)
     OR public.user_organization_role(_deal.buyer_organization_id)
       NOT IN ('owner', 'admin', 'agent') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT offer.* INTO _offer
  FROM public.offers offer
  WHERE offer.id = _offer_id AND offer.deal_id = _deal.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  IF _offer.status = 'accepted' AND _deal.status = 'agreed' THEN
    RETURN jsonb_build_object(
      'deal_id', _deal.id,
      'offer_id', _offer.id,
      'deal_status', _deal.status,
      'offer_status', _offer.status,
      'competing_offers_rejected', 0,
      'idempotent', true
    );
  END IF;

  IF _deal.status <> 'active' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Deal is not active';
  END IF;
  IF _offer.status <> 'submitted' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Offer is not submitted';
  END IF;
  IF _offer.valid_until IS NOT NULL AND _offer.valid_until <= clock_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Offer has expired';
  END IF;

  UPDATE public.offers
  SET status = 'accepted'
  WHERE id = _offer.id AND status = 'submitted';

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Offer state changed concurrently';
  END IF;

  PERFORM public.record_deal_offer_transition(
    'offer',
    _offer.id,
    'submitted',
    'accepted',
    jsonb_build_object('deal_id', _deal.id, 'selected', true)
  );

  FOR _competing_offer IN
    UPDATE public.offers
    SET status = 'rejected'
    WHERE deal_id = _deal.id
      AND id <> _offer.id
      AND status = 'submitted'
    RETURNING id
  LOOP
    _rejected_count := _rejected_count + 1;
    PERFORM public.record_deal_offer_transition(
      'offer',
      _competing_offer.id,
      'submitted',
      'rejected',
      jsonb_build_object(
        'deal_id', _deal.id,
        'reason', 'competing_offer_accepted',
        'accepted_offer_id', _offer.id
      )
    );
  END LOOP;

  UPDATE public.deals
  SET status = 'agreed'
  WHERE id = _deal.id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Deal state changed concurrently';
  END IF;

  PERFORM public.record_deal_offer_transition(
    'deal',
    _deal.id,
    'active',
    'agreed',
    jsonb_build_object('accepted_offer_id', _offer.id)
  );

  RETURN jsonb_build_object(
    'deal_id', _deal.id,
    'offer_id', _offer.id,
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
  _deal public.deals%ROWTYPE;
  _offer public.offers%ROWTYPE;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT offer.deal_id INTO _deal_id FROM public.offers offer WHERE offer.id = _offer_id;
  IF _deal_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT deal.* INTO _deal FROM public.deals deal WHERE deal.id = _deal_id FOR UPDATE;
  IF NOT FOUND
     OR NOT public.is_active_organization_member(_deal.buyer_organization_id)
     OR public.user_organization_role(_deal.buyer_organization_id)
       NOT IN ('owner', 'admin', 'agent') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT offer.* INTO _offer
  FROM public.offers offer
  WHERE offer.id = _offer_id AND offer.deal_id = _deal.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  IF _deal.status <> 'active' OR _offer.status <> 'submitted' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Offer cannot be rejected from its current state';
  END IF;

  UPDATE public.offers SET status = 'rejected' WHERE id = _offer.id AND status = 'submitted';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Offer state changed concurrently';
  END IF;

  PERFORM public.record_deal_offer_transition(
    'offer', _offer.id, 'submitted', 'rejected', jsonb_build_object('deal_id', _deal.id)
  );

  RETURN jsonb_build_object('deal_id', _deal.id, 'offer_id', _offer.id, 'status', 'rejected');
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
  _deal public.deals%ROWTYPE;
  _offer public.offers%ROWTYPE;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT offer.deal_id INTO _deal_id FROM public.offers offer WHERE offer.id = _offer_id;
  IF _deal_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT deal.* INTO _deal FROM public.deals deal WHERE deal.id = _deal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT offer.* INTO _offer
  FROM public.offers offer
  WHERE offer.id = _offer_id AND offer.deal_id = _deal.id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT public.is_active_organization_member(_offer.supplier_organization_id)
     OR public.user_organization_role(_offer.supplier_organization_id)
       NOT IN ('owner', 'admin', 'sales', 'reservations') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  IF _deal.status <> 'active' OR _offer.status <> 'submitted' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Offer cannot be withdrawn from its current state';
  END IF;

  UPDATE public.offers SET status = 'withdrawn' WHERE id = _offer.id AND status = 'submitted';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Offer state changed concurrently';
  END IF;

  PERFORM public.record_deal_offer_transition(
    'offer', _offer.id, 'submitted', 'withdrawn', jsonb_build_object('deal_id', _deal.id)
  );

  RETURN jsonb_build_object('deal_id', _deal.id, 'offer_id', _offer.id, 'status', 'withdrawn');
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
  _deal public.deals%ROWTYPE;
  _offer public.offers%ROWTYPE;
  _is_buyer_actor boolean;
  _is_supplier_actor boolean;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT offer.deal_id INTO _deal_id FROM public.offers offer WHERE offer.id = _offer_id;
  IF _deal_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT deal.* INTO _deal FROM public.deals deal WHERE deal.id = _deal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  _is_buyer_actor := public.is_active_organization_member(_deal.buyer_organization_id)
    AND public.user_organization_role(_deal.buyer_organization_id) IN ('owner', 'admin', 'agent');
  _is_supplier_actor := public.is_active_organization_member(_deal.supplier_organization_id)
    AND public.user_organization_role(_deal.supplier_organization_id)
      IN ('owner', 'admin', 'sales', 'reservations');

  IF NOT (_is_buyer_actor OR _is_supplier_actor) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT offer.* INTO _offer
  FROM public.offers offer
  WHERE offer.id = _offer_id AND offer.deal_id = _deal.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  IF _deal.status <> 'active'
     OR _offer.status <> 'submitted'
     OR _offer.valid_until IS NULL
     OR _offer.valid_until > clock_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Offer cannot be expired from its current state';
  END IF;

  UPDATE public.offers SET status = 'expired' WHERE id = _offer.id AND status = 'submitted';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Offer state changed concurrently';
  END IF;

  PERFORM public.record_deal_offer_transition(
    'offer', _offer.id, 'submitted', 'expired', jsonb_build_object('deal_id', _deal.id)
  );

  RETURN jsonb_build_object('deal_id', _deal.id, 'offer_id', _offer.id, 'status', 'expired');
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_deal(_deal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _deal public.deals%ROWTYPE;
  _rejected_offer record;
  _rejected_count integer := 0;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT deal.* INTO _deal FROM public.deals deal WHERE deal.id = _deal_id FOR UPDATE;
  IF NOT FOUND
     OR NOT public.is_active_organization_member(_deal.buyer_organization_id)
     OR public.user_organization_role(_deal.buyer_organization_id)
       NOT IN ('owner', 'admin', 'agent') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  IF _deal.status <> 'active' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Deal cannot be cancelled from its current state';
  END IF;

  FOR _rejected_offer IN
    UPDATE public.offers
    SET status = 'rejected'
    WHERE deal_id = _deal.id AND status = 'submitted'
    RETURNING id
  LOOP
    _rejected_count := _rejected_count + 1;
    PERFORM public.record_deal_offer_transition(
      'offer',
      _rejected_offer.id,
      'submitted',
      'rejected',
      jsonb_build_object('deal_id', _deal.id, 'reason', 'deal_cancelled')
    );
  END LOOP;

  UPDATE public.deals SET status = 'cancelled' WHERE id = _deal.id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Deal state changed concurrently';
  END IF;

  PERFORM public.record_deal_offer_transition(
    'deal', _deal.id, 'active', 'cancelled', jsonb_build_object('offers_rejected', _rejected_count)
  );

  RETURN jsonb_build_object(
    'deal_id', _deal.id,
    'status', 'cancelled',
    'offers_rejected', _rejected_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.close_deal(_deal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _deal public.deals%ROWTYPE;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  SELECT deal.* INTO _deal FROM public.deals deal WHERE deal.id = _deal_id FOR UPDATE;
  IF NOT FOUND
     OR NOT public.is_active_organization_member(_deal.buyer_organization_id)
     OR public.user_organization_role(_deal.buyer_organization_id)
       NOT IN ('owner', 'admin', 'agent') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal workflow action is not available';
  END IF;

  IF _deal.status <> 'agreed' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Deal cannot be closed from its current state';
  END IF;

  UPDATE public.deals SET status = 'closed' WHERE id = _deal.id AND status = 'agreed';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Deal state changed concurrently';
  END IF;

  PERFORM public.record_deal_offer_transition('deal', _deal.id, 'agreed', 'closed');

  RETURN jsonb_build_object('deal_id', _deal.id, 'status', 'closed');
END;
$$;

REVOKE ALL ON FUNCTION public.record_deal_offer_transition(text, uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.accept_deal_offer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_deal_offer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_deal_offer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expire_deal_offer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_deal(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_deal(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.accept_deal_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_deal_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_deal_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_deal_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_deal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_deal(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'offers'
      AND indexname = 'idx_offers_one_accepted_per_deal'
      AND indexdef LIKE '%WHERE (status = %accepted%'
  ) THEN
    RAISE EXCEPTION 'Accepted Offer uniqueness postcondition failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants grant_row
    WHERE grant_row.table_schema = 'public'
      AND grant_row.table_name IN ('deals', 'offers')
      AND grant_row.grantee = 'authenticated'
      AND grant_row.privilege_type IN ('UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'Deal or Offer direct mutation grant detected';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname IN (
        'accept_deal_offer',
        'reject_deal_offer',
        'withdraw_deal_offer',
        'expire_deal_offer',
        'cancel_deal',
        'close_deal'
      )
  ) <> 6 THEN
    RAISE EXCEPTION 'Deal and Offer workflow command postcondition failed';
  END IF;
END;
$$;

COMMIT;
