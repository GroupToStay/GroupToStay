-- GroupToStay V3 Deal-scoped identity and contact reveal policy.
-- Contact values remain in canonical business profiles; this migration stores reveal evidence only.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.deals') IS NULL
     OR to_regclass('public.offers') IS NULL
     OR to_regclass('public.organizations') IS NULL
     OR to_regclass('public.organization_memberships') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.admin_audit_logs') IS NULL THEN
    RAISE EXCEPTION 'Deal contact reveal prerequisites are missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.deals WHERE status IN ('agreed', 'closed')
  ) OR EXISTS (
    SELECT 1 FROM public.offers WHERE status = 'accepted'
  ) THEN
    RAISE EXCEPTION
      'Existing agreed Deal data requires a separate owner-reviewed reveal authorization plan';
  END IF;
END;
$$;

CREATE TABLE public.deal_contact_reveals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL UNIQUE REFERENCES public.deals(id) ON DELETE RESTRICT,
  accepted_offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE RESTRICT,
  reveal_trigger text NOT NULL DEFAULT 'offer_accepted',
  policy_version text NOT NULL DEFAULT 'deal-contact-v1',
  revealed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_contact_reveals_trigger_check
    CHECK (reveal_trigger = 'offer_accepted'),
  CONSTRAINT deal_contact_reveals_policy_version_check
    CHECK (policy_version = 'deal-contact-v1')
);

COMMENT ON TABLE public.deal_contact_reveals IS
  'Immutable Deal-scoped evidence that the accepted Offer authorized counterpart business contact access.';
COMMENT ON COLUMN public.deal_contact_reveals.accepted_offer_id IS
  'The accepted immutable Offer Version that atomically triggered contact reveal.';

CREATE INDEX idx_deal_contact_reveals_offer
  ON public.deal_contact_reveals(accepted_offer_id);

CREATE OR REPLACE FUNCTION public.validate_deal_contact_reveal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _deal public.deals%ROWTYPE;
  _offer public.offers%ROWTYPE;
  _timestamp timestamptz := clock_timestamp();
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Deal contact reveal evidence is immutable';
  END IF;

  SELECT deal.* INTO _deal
  FROM public.deals deal
  WHERE deal.id = NEW.deal_id;

  SELECT offer.* INTO _offer
  FROM public.offers offer
  WHERE offer.id = NEW.accepted_offer_id
    AND offer.deal_id = NEW.deal_id;

  IF _deal.id IS NULL
     OR _deal.status <> 'agreed'
     OR _offer.id IS NULL
     OR _offer.status <> 'accepted'
     OR _offer.submitted_by_organization_id <> _deal.supplier_organization_id
     OR NEW.reveal_trigger <> 'offer_accepted'
     OR NEW.policy_version <> 'deal-contact-v1' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Deal contact reveal evidence is invalid';
  END IF;

  NEW.revealed_at := _timestamp;
  NEW.created_at := _timestamp;
  RETURN NEW;
END;
$$;

CREATE TRIGGER deal_contact_reveals_validate
BEFORE INSERT OR UPDATE OR DELETE ON public.deal_contact_reveals
FOR EACH ROW EXECUTE FUNCTION public.validate_deal_contact_reveal();

CREATE OR REPLACE FUNCTION public.audit_deal_contact_reveal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Deal contact reveal audit actor is unavailable';
  END IF;

  INSERT INTO public.admin_audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    new_state,
    metadata
  ) VALUES (
    _actor_id,
    'deal.contact_revealed',
    'deal_contact_reveal',
    NEW.id::text,
    jsonb_build_object(
      'deal_id', NEW.deal_id,
      'accepted_offer_id', NEW.accepted_offer_id,
      'reveal_trigger', NEW.reveal_trigger,
      'policy_version', NEW.policy_version,
      'revealed_at', NEW.revealed_at
    ),
    jsonb_build_object('source', 'identity_contact_reveal_policy')
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER deal_contact_reveals_audit
AFTER INSERT ON public.deal_contact_reveals
FOR EACH ROW EXECUTE FUNCTION public.audit_deal_contact_reveal();

CREATE OR REPLACE FUNCTION public.require_agreed_deal_contact_reveal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IN ('agreed', 'closed')
     AND NOT EXISTS (
       SELECT 1
       FROM public.deal_contact_reveals reveal
       JOIN public.offers offer
         ON offer.id = reveal.accepted_offer_id
        AND offer.deal_id = NEW.id
        AND offer.status = 'accepted'
       WHERE reveal.deal_id = NEW.id
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Agreed Deal requires contact reveal evidence';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER deals_require_contact_reveal
AFTER INSERT OR UPDATE OF status ON public.deals
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.require_agreed_deal_contact_reveal();

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
  _reveal public.deal_contact_reveals%ROWTYPE;
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
    INSERT INTO public.deal_contact_reveals (deal_id, accepted_offer_id)
    VALUES (_deal.id, _offer.id)
    ON CONFLICT (deal_id) DO NOTHING;

    SELECT reveal.* INTO _reveal
    FROM public.deal_contact_reveals reveal
    WHERE reveal.deal_id = _deal.id;

    IF _reveal.accepted_offer_id IS DISTINCT FROM _offer.id THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Deal contact reveal state is invalid';
    END IF;

    RETURN jsonb_build_object(
      'deal_id', _deal.id,
      'offer_thread_id', _thread.id,
      'offer_id', _offer.id,
      'version_number', _offer.version_number,
      'deal_status', _deal.status,
      'offer_status', _offer.status,
      'competing_offers_rejected', 0,
      'contact_revealed', true,
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

  INSERT INTO public.deal_contact_reveals (deal_id, accepted_offer_id)
  VALUES (_deal.id, _offer.id)
  ON CONFLICT (deal_id) DO NOTHING;

  SELECT reveal.* INTO _reveal
  FROM public.deal_contact_reveals reveal
  WHERE reveal.deal_id = _deal.id;

  IF _reveal.accepted_offer_id IS DISTINCT FROM _offer.id THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Deal contact reveal state is invalid';
  END IF;

  RETURN jsonb_build_object(
    'deal_id', _deal.id,
    'offer_thread_id', _thread.id,
    'offer_id', _offer.id,
    'version_number', _offer.version_number,
    'deal_status', 'agreed',
    'offer_status', 'accepted',
    'competing_offers_rejected', _rejected_count,
    'contact_revealed', true,
    'idempotent', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_deal_counterparty_contact(_deal_id uuid)
RETURNS TABLE (
  business_name text,
  contact_name text,
  email text,
  phone text,
  whatsapp text,
  address text,
  organization_type text,
  revealed_at timestamptz,
  policy_version text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _deal public.deals%ROWTYPE;
  _reveal public.deal_contact_reveals%ROWTYPE;
  _actor_organizations uuid[];
  _actor_organization_id uuid;
  _counterparty public.organizations%ROWTYPE;
  _profile public.profiles%ROWTYPE;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal contact is not available';
  END IF;

  SELECT deal.* INTO _deal
  FROM public.deals deal
  WHERE deal.id = _deal_id
    AND deal.status IN ('agreed', 'closed');

  SELECT reveal.* INTO _reveal
  FROM public.deal_contact_reveals reveal
  WHERE reveal.deal_id = _deal_id;

  IF _deal.id IS NULL OR _reveal.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal contact is not available';
  END IF;

  SELECT array_agg(membership.organization_id ORDER BY membership.organization_id)
  INTO _actor_organizations
  FROM public.organization_memberships membership
  JOIN public.organizations organization
    ON organization.id = membership.organization_id
   AND organization.status = 'active'
   AND organization.archived_at IS NULL
  WHERE membership.user_id = _actor_id
    AND membership.status = 'active'
    AND (
      (
        membership.organization_id = _deal.buyer_organization_id
        AND membership.membership_role IN ('owner', 'admin', 'agent')
      )
      OR (
        membership.organization_id = _deal.supplier_organization_id
        AND membership.membership_role IN ('owner', 'admin', 'sales', 'reservations')
      )
    );

  IF COALESCE(cardinality(_actor_organizations), 0) <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal contact is not available';
  END IF;

  _actor_organization_id := _actor_organizations[1];

  SELECT organization.* INTO _counterparty
  FROM public.organizations organization
  WHERE organization.id = CASE
      WHEN _actor_organization_id = _deal.buyer_organization_id
        THEN _deal.supplier_organization_id
      ELSE _deal.buyer_organization_id
    END
    AND organization.status = 'active'
    AND organization.archived_at IS NULL;

  SELECT profile.* INTO _profile
  FROM public.profiles profile
  WHERE profile.id = _counterparty.legacy_owner_user_id;

  IF _counterparty.id IS NULL OR _profile.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Deal contact is unavailable';
  END IF;

  RETURN QUERY
  SELECT
    NULLIF(btrim(_counterparty.display_name), ''),
    CASE WHEN _counterparty.organization_type = 'agency'
      THEN NULLIF(btrim(_profile.contact_person_name), '')
      ELSE NULL
    END,
    CASE WHEN _counterparty.organization_type = 'agency'
      THEN NULLIF(btrim(_profile.contact_person_email), '')
      ELSE NULLIF(btrim(_profile.contact_email), '')
    END,
    CASE WHEN _counterparty.organization_type = 'agency'
      THEN NULLIF(btrim(_profile.contact_person_phone), '')
      ELSE NULLIF(btrim(COALESCE(_profile.phone_number, _profile.phone)), '')
    END,
    CASE WHEN _counterparty.organization_type = 'agency'
      THEN NULLIF(btrim(_profile.contact_person_whatsapp), '')
      ELSE NULL
    END,
    CASE WHEN _counterparty.organization_type = 'agency'
      THEN NULLIF(btrim(COALESCE(_profile.full_address, _profile.business_address)), '')
      ELSE NULLIF(btrim(_profile.business_address), '')
    END,
    _counterparty.organization_type::text,
    _reveal.revealed_at,
    _reveal.policy_version;
END;
$$;

ALTER TABLE public.deal_contact_reveals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.deal_contact_reveals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.deal_contact_reveals TO authenticated;
GRANT ALL ON public.deal_contact_reveals TO service_role;

CREATE POLICY "Platform admins inspect Deal contact reveal evidence"
ON public.deal_contact_reveals FOR SELECT TO authenticated
USING (public.is_enterprise_admin(auth.uid()));

REVOKE ALL ON FUNCTION public.validate_deal_contact_reveal()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_deal_contact_reveal()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_agreed_deal_contact_reveal()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_deal_counterparty_contact(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_deal_counterparty_contact(uuid)
  TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'deal_contact_reveals'
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Deal contact reveal RLS postcondition failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants grant_row
    WHERE grant_row.table_schema = 'public'
      AND grant_row.table_name = 'deal_contact_reveals'
      AND grant_row.grantee IN ('anon', 'authenticated')
      AND grant_row.privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'Direct Deal contact reveal mutation grant detected';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger trigger_row
    JOIN pg_class relation ON relation.oid = trigger_row.tgrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'deals'
      AND trigger_row.tgname = 'deals_require_contact_reveal'
      AND NOT trigger_row.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Agreed Deal reveal invariant postcondition failed';
  END IF;
END;
$$;

COMMIT;
