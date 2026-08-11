BEGIN;

DO $$
BEGIN
  IF to_regclass('public.deals') IS NULL
     OR to_regclass('public.rfq_invitations') IS NULL
     OR to_regclass('public.rfqs') IS NULL
     OR to_regclass('public.hotels') IS NULL
     OR to_regclass('public.organizations') IS NULL
     OR to_regclass('public.organization_memberships') IS NULL
     OR to_regclass('public.organization_hotel_mappings') IS NULL
     OR to_regclass('public.admin_audit_logs') IS NULL THEN
    RAISE EXCEPTION 'V2 to V3 Deal activation prerequisites are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'deals'
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Deal RLS must remain enabled before activation';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sourced_deal_id(_invitation_id uuid)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  WITH digest AS (
    SELECT md5('grouptostay:v3:deal:invitation:' || _invitation_id::text) AS value
  )
  SELECT (
    substr(value, 1, 8) || '-' ||
    substr(value, 9, 4) || '-5' ||
    substr(value, 14, 3) || '-8' ||
    substr(value, 18, 3) || '-' ||
    substr(value, 21, 12)
  )::uuid
  FROM digest
$$;

COMMENT ON FUNCTION public.sourced_deal_id(uuid) IS
  'Stable identity for a Deal provisioned from one legacy RFQ invitation.';

CREATE OR REPLACE FUNCTION public.ensure_deal_for_invitation(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _invitation public.rfq_invitations%ROWTYPE;
  _rfq public.rfqs%ROWTYPE;
  _hotel public.hotels%ROWTYPE;
  _buyer_organization_id uuid;
  _supplier_organization_id uuid;
  _deal public.deals%ROWTYPE;
  _buyer_actor boolean := false;
  _supplier_actor boolean := false;
  _created boolean := false;
BEGIN
  IF _actor_id IS NULL OR _invitation_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Negotiation is not available';
  END IF;

  SELECT invitation.*
  INTO _invitation
  FROM public.rfq_invitations invitation
  WHERE invitation.id = _invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Negotiation is not available';
  END IF;

  SELECT rfq.*
  INTO _rfq
  FROM public.rfqs rfq
  WHERE rfq.id = _invitation.rfq_id;

  SELECT hotel.*
  INTO _hotel
  FROM public.hotels hotel
  WHERE hotel.id = _invitation.hotel_id;

  SELECT organization.id
  INTO _buyer_organization_id
  FROM public.organizations organization
  WHERE organization.organization_type = 'agency'
    AND organization.legacy_owner_user_id = _rfq.organizer_id
    AND organization.status = 'active'
    AND organization.archived_at IS NULL;

  SELECT mapping.organization_id
  INTO _supplier_organization_id
  FROM public.organization_hotel_mappings mapping
  JOIN public.organizations organization ON organization.id = mapping.organization_id
  WHERE mapping.hotel_id = _invitation.hotel_id
    AND organization.organization_type = 'supplier'
    AND organization.status = 'active'
    AND organization.archived_at IS NULL;

  IF _rfq.id IS NULL
     OR _hotel.id IS NULL
     OR _buyer_organization_id IS NULL
     OR _supplier_organization_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Negotiation cannot be activated from this invitation';
  END IF;

  _buyer_actor :=
    public.is_active_organization_member(_buyer_organization_id)
    AND public.user_organization_role(_buyer_organization_id) IN ('owner', 'admin', 'agent');
  _supplier_actor :=
    public.is_active_organization_member(_supplier_organization_id)
    AND public.user_organization_role(_supplier_organization_id)
      IN ('owner', 'admin', 'sales', 'reservations');

  IF _buyer_actor = _supplier_actor THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Negotiation is not available';
  END IF;

  SELECT deal.*
  INTO _deal
  FROM public.deals deal
  WHERE deal.source_invitation_id = _invitation.id;

  IF FOUND THEN
    IF _deal.source_rfq_id IS DISTINCT FROM _rfq.id
       OR _deal.source_hotel_id IS DISTINCT FROM _hotel.id
       OR _deal.buyer_organization_id IS DISTINCT FROM _buyer_organization_id
       OR _deal.supplier_organization_id IS DISTINCT FROM _supplier_organization_id THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'Negotiation source mapping is inconsistent';
    END IF;

    RETURN jsonb_build_object(
      'deal_id', _deal.id,
      'status', _deal.status,
      'created', false,
      'idempotent', true
    );
  END IF;

  IF _rfq.status::text NOT IN ('open', 'quoting', 'under_review')
     OR _invitation.status::text = 'declined'
     OR _hotel.status::text <> 'approved'
     OR NOT public.is_account_active(_rfq.organizer_id) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Negotiation cannot be activated from this invitation';
  END IF;

  INSERT INTO public.deals (
    id,
    buyer_organization_id,
    supplier_organization_id,
    source_rfq_id,
    source_invitation_id,
    source_hotel_id,
    status,
    created_by
  ) VALUES (
    public.sourced_deal_id(_invitation.id),
    _buyer_organization_id,
    _supplier_organization_id,
    _rfq.id,
    _invitation.id,
    _hotel.id,
    'active',
    _actor_id
  )
  ON CONFLICT (source_invitation_id) DO NOTHING
  RETURNING * INTO _deal;

  IF FOUND THEN
    _created := true;
    INSERT INTO public.admin_audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      new_state,
      metadata
    ) VALUES (
      _actor_id,
      'deal.activated_from_invitation',
      'deal',
      _deal.id::text,
      jsonb_build_object('status', _deal.status),
      jsonb_build_object(
        'source', 'v2_v3_deal_activation',
        'source_type', 'rfq_invitation'
      )
    );
  ELSE
    SELECT deal.*
    INTO _deal
    FROM public.deals deal
    WHERE deal.source_invitation_id = _invitation.id;
  END IF;

  IF _deal.id IS NULL
     OR _deal.source_rfq_id IS DISTINCT FROM _rfq.id
     OR _deal.source_hotel_id IS DISTINCT FROM _hotel.id
     OR _deal.buyer_organization_id IS DISTINCT FROM _buyer_organization_id
     OR _deal.supplier_organization_id IS DISTINCT FROM _supplier_organization_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Negotiation source mapping is inconsistent';
  END IF;

  RETURN jsonb_build_object(
    'deal_id', _deal.id,
    'status', _deal.status,
    'created', _created,
    'idempotent', NOT _created
  );
END;
$$;

COMMENT ON FUNCTION public.ensure_deal_for_invitation(uuid) IS
  'Idempotently activates one organization-owned Deal from an eligible legacy RFQ invitation.';

REVOKE ALL ON FUNCTION public.sourced_deal_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_deal_for_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_deal_for_invitation(uuid) TO authenticated;

DO $$
DECLARE
  _function_is_definer boolean;
  _function_config text[];
BEGIN
  SELECT procedure.prosecdef, procedure.proconfig
  INTO _function_is_definer, _function_config
  FROM pg_proc procedure
  JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'ensure_deal_for_invitation'
    AND pg_get_function_identity_arguments(procedure.oid) = '_invitation_id uuid';

  IF NOT COALESCE(_function_is_definer, false)
     OR NOT (
       COALESCE(_function_config, ARRAY[]::text[]) @> ARRAY['search_path=']::text[]
       OR COALESCE(_function_config, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]
     ) THEN
    RAISE EXCEPTION 'Deal activation command security postcondition failed';
  END IF;

  IF has_function_privilege('anon', 'public.ensure_deal_for_invitation(uuid)', 'EXECUTE')
     OR NOT has_function_privilege(
       'authenticated',
       'public.ensure_deal_for_invitation(uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Deal activation command grant postcondition failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.deals deal
    WHERE deal.source_invitation_id IS NOT NULL
    GROUP BY deal.source_invitation_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate sourced Deals detected after activation migration';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'deals'
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Deal RLS was disabled during activation migration';
  END IF;
END;
$$;

COMMIT;
