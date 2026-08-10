-- GroupToStay V3 Deal and Offer foundation.
-- Additive only: V2 RFQ, quote, booking, and ownership contracts remain unchanged.

BEGIN;

DO $$
DECLARE
  _existing_tables integer;
BEGIN
  IF to_regclass('public.organizations') IS NULL
     OR to_regclass('public.organization_memberships') IS NULL
     OR to_regclass('public.organization_hotel_mappings') IS NULL
     OR to_regclass('public.rfqs') IS NULL
     OR to_regclass('public.rfq_invitations') IS NULL
     OR to_regclass('public.hotels') IS NULL THEN
    RAISE EXCEPTION 'Deal and Offer foundation prerequisites are missing';
  END IF;

  SELECT count(*)
  INTO _existing_tables
  FROM pg_class relation
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname IN ('deals', 'offers')
    AND relation.relkind IN ('r', 'p');

  IF _existing_tables NOT IN (0, 2) THEN
    RAISE EXCEPTION 'Partial Deal and Offer foundation detected (% of 2 tables)', _existing_tables;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type type
    JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public' AND type.typname = 'deal_status'
  ) THEN
    CREATE TYPE public.deal_status AS ENUM ('active', 'agreed', 'closed', 'cancelled');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type type
    JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public' AND type.typname = 'offer_status'
  ) THEN
    CREATE TYPE public.offer_status AS ENUM (
      'submitted', 'accepted', 'rejected', 'withdrawn', 'expired'
    );
  END IF;
END;
$$;

DO $$
DECLARE
  _labels text[];
BEGIN
  SELECT array_agg(enum.enumlabel ORDER BY enum.enumsortorder)
  INTO _labels
  FROM pg_enum enum
  JOIN pg_type type ON type.oid = enum.enumtypid
  JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
  WHERE namespace.nspname = 'public' AND type.typname = 'deal_status';
  IF _labels IS DISTINCT FROM ARRAY['active', 'agreed', 'closed', 'cancelled']::text[] THEN
    RAISE EXCEPTION 'Unexpected deal_status definition: %', _labels;
  END IF;

  SELECT array_agg(enum.enumlabel ORDER BY enum.enumsortorder)
  INTO _labels
  FROM pg_enum enum
  JOIN pg_type type ON type.oid = enum.enumtypid
  JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
  WHERE namespace.nspname = 'public' AND type.typname = 'offer_status';
  IF _labels IS DISTINCT FROM ARRAY[
    'submitted', 'accepted', 'rejected', 'withdrawn', 'expired'
  ]::text[] THEN
    RAISE EXCEPTION 'Unexpected offer_status definition: %', _labels;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE RESTRICT,
  supplier_organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE RESTRICT,
  source_rfq_id uuid REFERENCES public.rfqs(id) ON DELETE RESTRICT,
  source_invitation_id uuid UNIQUE
    REFERENCES public.rfq_invitations(id) ON DELETE RESTRICT,
  source_hotel_id uuid REFERENCES public.hotels(id) ON DELETE RESTRICT,
  status public.deal_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deals_distinct_organizations_check
    CHECK (buyer_organization_id <> supplier_organization_id),
  CONSTRAINT deals_source_context_check CHECK (
    (
      source_rfq_id IS NULL
      AND source_invitation_id IS NULL
      AND source_hotel_id IS NULL
    )
    OR (
      source_rfq_id IS NOT NULL
      AND source_invitation_id IS NOT NULL
      AND source_hotel_id IS NOT NULL
    )
  ),
  CONSTRAINT deals_id_supplier_key UNIQUE (id, supplier_organization_id)
);

CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  supplier_organization_id uuid NOT NULL,
  amount numeric(18, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  valid_until timestamptz,
  notes text,
  status public.offer_status NOT NULL DEFAULT 'submitted',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_deal_supplier_fkey
    FOREIGN KEY (deal_id, supplier_organization_id)
    REFERENCES public.deals(id, supplier_organization_id) ON DELETE RESTRICT,
  CONSTRAINT offers_amount_positive_check CHECK (amount > 0),
  CONSTRAINT offers_currency_iso_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT offers_notes_length_check
    CHECK (notes IS NULL OR char_length(notes) <= 5000)
);

COMMENT ON TABLE public.deals IS
  'V3 organization-owned commercial relationship. V2 source references are compatibility-only.';
COMMENT ON TABLE public.offers IS
  'V3 supplier commercial submissions. Submitted commercial fields are immutable.';

CREATE INDEX IF NOT EXISTS idx_deals_buyer_status_updated
  ON public.deals(buyer_organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_supplier_status_updated
  ON public.deals(supplier_organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_source_rfq
  ON public.deals(source_rfq_id)
  WHERE source_rfq_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_source_hotel
  ON public.deals(source_hotel_id)
  WHERE source_hotel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_deal_created
  ON public.offers(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_supplier_status
  ON public.offers(supplier_organization_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_create_sourced_deal(
  _buyer_organization_id uuid,
  _supplier_organization_id uuid,
  _source_rfq_id uuid,
  _source_invitation_id uuid,
  _source_hotel_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_active_organization_member(_buyer_organization_id)
    AND public.user_organization_role(_buyer_organization_id) IN ('owner', 'admin', 'agent')
    AND EXISTS (
      SELECT 1
      FROM public.organizations buyer
      JOIN public.organization_memberships rfq_owner_membership
        ON rfq_owner_membership.organization_id = buyer.id
       AND rfq_owner_membership.status = 'active'
      JOIN public.rfqs rfq
        ON rfq.id = _source_rfq_id
       AND rfq.organizer_id = rfq_owner_membership.user_id
      JOIN public.rfq_invitations invitation
        ON invitation.id = _source_invitation_id
       AND invitation.rfq_id = rfq.id
       AND invitation.hotel_id = _source_hotel_id
      JOIN public.organization_hotel_mappings hotel_mapping
        ON hotel_mapping.hotel_id = invitation.hotel_id
       AND hotel_mapping.organization_id = _supplier_organization_id
      JOIN public.hotels hotel ON hotel.id = invitation.hotel_id
      JOIN public.organizations supplier
        ON supplier.id = hotel_mapping.organization_id
      WHERE buyer.id = _buyer_organization_id
        AND buyer.organization_type = 'agency'
        AND buyer.status = 'active'
        AND buyer.archived_at IS NULL
        AND supplier.organization_type = 'supplier'
        AND supplier.status = 'active'
        AND supplier.archived_at IS NULL
        AND public.is_account_active(rfq.organizer_id)
        AND rfq.status::text IN ('open', 'quoting', 'under_review')
        AND invitation.status::text <> 'declined'
        AND hotel.status::text = 'approved'
    )
$$;

CREATE OR REPLACE FUNCTION public.validate_deal_foundation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _buyer_type public.organization_type;
  _buyer_status public.organization_status;
  _buyer_archived_at timestamptz;
  _supplier_type public.organization_type;
  _supplier_status public.organization_status;
  _supplier_archived_at timestamptz;
  _source_valid boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.buyer_organization_id IS DISTINCT FROM OLD.buyer_organization_id
    OR NEW.supplier_organization_id IS DISTINCT FROM OLD.supplier_organization_id
    OR NEW.source_rfq_id IS DISTINCT FROM OLD.source_rfq_id
    OR NEW.source_invitation_id IS DISTINCT FROM OLD.source_invitation_id
    OR NEW.source_hotel_id IS DISTINCT FROM OLD.source_hotel_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Deal participants, source context, creator, and creation time are immutable';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  NEW.created_at := now();
  NEW.updated_at := NEW.created_at;

  SELECT organization.organization_type, organization.status, organization.archived_at
  INTO _buyer_type, _buyer_status, _buyer_archived_at
  FROM public.organizations organization
  WHERE organization.id = NEW.buyer_organization_id;

  SELECT organization.organization_type, organization.status, organization.archived_at
  INTO _supplier_type, _supplier_status, _supplier_archived_at
  FROM public.organizations organization
  WHERE organization.id = NEW.supplier_organization_id;

  IF _buyer_type IS DISTINCT FROM 'agency'::public.organization_type THEN
    RAISE EXCEPTION 'Deal buyer must be an Agency organization';
  END IF;
  IF _supplier_type IS DISTINCT FROM 'supplier'::public.organization_type THEN
    RAISE EXCEPTION 'Deal supplier must be a Supplier organization';
  END IF;
  IF _buyer_status IS DISTINCT FROM 'active'::public.organization_status
     OR _buyer_archived_at IS NOT NULL
     OR _supplier_status IS DISTINCT FROM 'active'::public.organization_status
     OR _supplier_archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Deal participants must be active organizations';
  END IF;

  IF NEW.source_rfq_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.organization_memberships rfq_owner_membership
      JOIN public.rfqs rfq
        ON rfq.id = NEW.source_rfq_id
       AND rfq.organizer_id = rfq_owner_membership.user_id
      JOIN public.rfq_invitations invitation
        ON invitation.id = NEW.source_invitation_id
       AND invitation.rfq_id = rfq.id
       AND invitation.hotel_id = NEW.source_hotel_id
      JOIN public.organization_hotel_mappings hotel_mapping
        ON hotel_mapping.hotel_id = invitation.hotel_id
       AND hotel_mapping.organization_id = NEW.supplier_organization_id
      WHERE rfq_owner_membership.organization_id = NEW.buyer_organization_id
        AND rfq_owner_membership.status = 'active'
    ) INTO _source_valid;

    IF NOT COALESCE(_source_valid, false) THEN
      RAISE EXCEPTION 'Deal source context does not match its organizations';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_offer_foundation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _deal_status public.deal_status;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
    OR NEW.supplier_organization_id IS DISTINCT FROM OLD.supplier_organization_id
    OR NEW.amount IS DISTINCT FROM OLD.amount
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
    OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Submitted Offer commercial terms, ownership, creator, and creation time are immutable';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  NEW.created_at := now();
  NEW.updated_at := NEW.created_at;

  SELECT deal.status
  INTO _deal_status
  FROM public.deals deal
  WHERE deal.id = NEW.deal_id
    AND deal.supplier_organization_id = NEW.supplier_organization_id;

  IF _deal_status IS DISTINCT FROM 'active'::public.deal_status THEN
    RAISE EXCEPTION 'Offers may only be submitted to an active Deal';
  END IF;
  IF NEW.status IS DISTINCT FROM 'submitted'::public.offer_status THEN
    RAISE EXCEPTION 'New Offers must begin in submitted status';
  END IF;
  IF NEW.valid_until IS NOT NULL AND NEW.valid_until <= now() THEN
    RAISE EXCEPTION 'Offer validity must be in the future';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_validate_foundation ON public.deals;
CREATE TRIGGER deals_validate_foundation
BEFORE INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.validate_deal_foundation();

DROP TRIGGER IF EXISTS deals_updated ON public.deals;
CREATE TRIGGER deals_updated
BEFORE UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS offers_validate_foundation ON public.offers;
CREATE TRIGGER offers_validate_foundation
BEFORE INSERT OR UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.validate_offer_foundation();

DROP TRIGGER IF EXISTS offers_updated ON public.offers;
CREATE TRIGGER offers_updated
BEFORE UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.deals FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.offers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.deals TO authenticated;
GRANT SELECT, INSERT ON public.offers TO authenticated;
GRANT ALL ON public.deals, public.offers TO service_role;

CREATE POLICY "Deal participants and platform admins view Deals"
ON public.deals FOR SELECT TO authenticated
USING (
  public.is_active_organization_member(buyer_organization_id)
  OR public.is_active_organization_member(supplier_organization_id)
  OR public.is_enterprise_admin(auth.uid())
);

CREATE POLICY "Agency members create sourced Deals"
ON public.deals FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND status = 'active'
  AND source_rfq_id IS NOT NULL
  AND source_invitation_id IS NOT NULL
  AND source_hotel_id IS NOT NULL
  AND public.can_create_sourced_deal(
    buyer_organization_id,
    supplier_organization_id,
    source_rfq_id,
    source_invitation_id,
    source_hotel_id
  )
);

CREATE POLICY "Deal participants and platform admins view Offers"
ON public.offers FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.deals deal
    WHERE deal.id = offers.deal_id
      AND (
        public.is_active_organization_member(deal.buyer_organization_id)
        OR public.is_active_organization_member(deal.supplier_organization_id)
        OR public.is_enterprise_admin(auth.uid())
      )
  )
);

CREATE POLICY "Supplier members submit Offers"
ON public.offers FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND status = 'submitted'
  AND public.is_active_organization_member(supplier_organization_id)
  AND public.user_organization_role(supplier_organization_id)
    IN ('owner', 'admin', 'sales', 'reservations')
  AND EXISTS (
    SELECT 1
    FROM public.deals deal
    WHERE deal.id = offers.deal_id
      AND deal.supplier_organization_id = offers.supplier_organization_id
      AND deal.status = 'active'
  )
);

REVOKE ALL ON FUNCTION public.can_create_sourced_deal(uuid, uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_sourced_deal(uuid, uuid, uuid, uuid, uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.validate_deal_foundation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_offer_foundation()
  FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'deals'
      AND relation.relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'offers'
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Deal and Offer RLS postcondition failed';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_policies policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename IN ('deals', 'offers')
  ) <> 4 THEN
    RAISE EXCEPTION 'Unexpected Deal and Offer policy count';
  END IF;
END;
$$;

COMMIT;
