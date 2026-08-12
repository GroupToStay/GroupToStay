-- GroupToStay V3 Sprint 1, Feature 1: additive organization and membership foundation.
-- Legacy marketplace ownership remains authoritative during the compatibility phase.

BEGIN;

DO $$
DECLARE
  _existing_tables integer;
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.user_roles') IS NULL
     OR to_regclass('public.hotels') IS NULL
     OR to_regclass('public.rfqs') IS NULL
     OR to_regclass('public.countries') IS NULL
     OR to_regclass('public.admin_audit_logs') IS NULL THEN
    RAISE EXCEPTION 'Organization foundation prerequisites are missing';
  END IF;

  SELECT count(*)
  INTO _existing_tables
  FROM pg_class relation
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname IN (
      'organizations',
      'organization_memberships',
      'organization_hotel_mappings'
    )
    AND relation.relkind IN ('r', 'p');

  IF _existing_tables NOT IN (0, 3) THEN
    RAISE EXCEPTION 'Partial organization foundation detected (% of 3 tables)', _existing_tables;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type type
    JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public' AND type.typname = 'organization_type'
  ) THEN
    CREATE TYPE public.organization_type AS ENUM ('agency', 'supplier', 'corporate_buyer');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type type
    JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public' AND type.typname = 'organization_status'
  ) THEN
    CREATE TYPE public.organization_status AS ENUM ('active', 'suspended', 'archived');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type type
    JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public' AND type.typname = 'organization_membership_role'
  ) THEN
    CREATE TYPE public.organization_membership_role AS ENUM (
      'owner', 'admin', 'agent', 'sales', 'reservations', 'viewer'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type type
    JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public' AND type.typname = 'organization_membership_status'
  ) THEN
    CREATE TYPE public.organization_membership_status AS ENUM (
      'invited', 'active', 'suspended', 'removed'
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
  WHERE namespace.nspname = 'public' AND type.typname = 'organization_type';
  IF _labels IS DISTINCT FROM ARRAY['agency', 'supplier', 'corporate_buyer']::text[] THEN
    RAISE EXCEPTION 'Unexpected organization_type definition: %', _labels;
  END IF;

  SELECT array_agg(enum.enumlabel ORDER BY enum.enumsortorder)
  INTO _labels
  FROM pg_enum enum
  JOIN pg_type type ON type.oid = enum.enumtypid
  JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
  WHERE namespace.nspname = 'public' AND type.typname = 'organization_status';
  IF _labels IS DISTINCT FROM ARRAY['active', 'suspended', 'archived']::text[] THEN
    RAISE EXCEPTION 'Unexpected organization_status definition: %', _labels;
  END IF;

  SELECT array_agg(enum.enumlabel ORDER BY enum.enumsortorder)
  INTO _labels
  FROM pg_enum enum
  JOIN pg_type type ON type.oid = enum.enumtypid
  JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
  WHERE namespace.nspname = 'public' AND type.typname = 'organization_membership_role';
  IF _labels IS DISTINCT FROM ARRAY['owner', 'admin', 'agent', 'sales', 'reservations', 'viewer']::text[] THEN
    RAISE EXCEPTION 'Unexpected organization_membership_role definition: %', _labels;
  END IF;

  SELECT array_agg(enum.enumlabel ORDER BY enum.enumsortorder)
  INTO _labels
  FROM pg_enum enum
  JOIN pg_type type ON type.oid = enum.enumtypid
  JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
  WHERE namespace.nspname = 'public' AND type.typname = 'organization_membership_status';
  IF _labels IS DISTINCT FROM ARRAY['invited', 'active', 'suspended', 'removed']::text[] THEN
    RAISE EXCEPTION 'Unexpected organization_membership_status definition: %', _labels;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY,
  organization_type public.organization_type NOT NULL,
  legal_name text,
  display_name text NOT NULL,
  status public.organization_status NOT NULL DEFAULT 'active',
  country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  legacy_owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT organizations_display_name_length_check
    CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 200),
  CONSTRAINT organizations_legal_name_length_check
    CHECK (legal_name IS NULL OR char_length(btrim(legal_name)) BETWEEN 1 AND 200),
  CONSTRAINT organizations_legacy_owner_type_key
    UNIQUE (organization_type, legacy_owner_user_id)
);

CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_role public.organization_membership_role NOT NULL,
  status public.organization_membership_status NOT NULL DEFAULT 'invited',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_memberships_organization_user_key
    UNIQUE (organization_id, user_id),
  CONSTRAINT organization_memberships_active_joined_check
    CHECK (status <> 'active' OR joined_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.organization_hotel_mappings (
  hotel_id uuid PRIMARY KEY REFERENCES public.hotels(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.organizations IS
  'V3 organization identities. Legacy profile and hotel ownership remains authoritative during migration.';
COMMENT ON TABLE public.organization_memberships IS
  'Organization-scoped authority, separate from platform roles and permissions.';
COMMENT ON TABLE public.organization_hotel_mappings IS
  'Compatibility mapping from current hotel listings to their supplier organization.';

CREATE INDEX IF NOT EXISTS idx_organizations_type_status
  ON public.organizations(organization_type, status);
CREATE INDEX IF NOT EXISTS idx_organizations_legacy_owner
  ON public.organizations(legacy_owner_user_id)
  WHERE legacy_owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_status
  ON public.organization_memberships(user_id, status, organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_organization_status
  ON public.organization_memberships(organization_id, status, membership_role);
CREATE INDEX IF NOT EXISTS idx_organization_hotel_mappings_organization
  ON public.organization_hotel_mappings(organization_id, hotel_id);

DROP TRIGGER IF EXISTS organizations_updated ON public.organizations;
CREATE TRIGGER organizations_updated
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS organization_memberships_updated ON public.organization_memberships;
CREATE TRIGGER organization_memberships_updated
BEFORE UPDATE ON public.organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.legacy_organization_id(
  _user_id uuid,
  _organization_type public.organization_type
)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT md5(
    'grouptostay:v3:organization:' || _organization_type::text || ':' || _user_id::text
  )::uuid
$$;

CREATE OR REPLACE FUNCTION public.legacy_organization_membership_id(
  _organization_id uuid,
  _user_id uuid
)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT md5(
    'grouptostay:v3:organization-membership:' || _organization_id::text || ':' || _user_id::text
  )::uuid
$$;

CREATE OR REPLACE FUNCTION public.audit_organization_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor uuid := COALESCE(auth.uid(), NEW.created_by, NEW.legacy_owner_user_id);
BEGIN
  IF _actor IS NOT NULL THEN
    INSERT INTO public.admin_audit_logs (
      actor_id, action, entity_type, entity_id, new_state, metadata
    ) VALUES (
      _actor,
      'organization.created',
      'organization',
      NEW.id::text,
      jsonb_build_object(
        'organization_type', NEW.organization_type,
        'status', NEW.status,
        'legacy_owner_user_id', NEW.legacy_owner_user_id
      ),
      jsonb_build_object(
        'source', 'organization_membership_foundation',
        'system_generated', auth.uid() IS NULL
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_organization_membership_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _organization_type public.organization_type;
BEGIN
  SELECT organization.organization_type
  INTO _organization_type
  FROM public.organizations organization
  WHERE organization.id = NEW.organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization does not exist';
  END IF;

  IF _organization_type IN ('agency', 'corporate_buyer')
     AND NEW.membership_role IN ('sales', 'reservations') THEN
    RAISE EXCEPTION 'Membership role % is not valid for % organizations',
      NEW.membership_role, _organization_type;
  END IF;

  IF _organization_type = 'supplier' AND NEW.membership_role = 'agent' THEN
    RAISE EXCEPTION 'Membership role agent is not valid for supplier organizations';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_organization_membership_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor uuid := COALESCE(auth.uid(), NEW.invited_by, NEW.user_id);
  _action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'organization_membership.created';
  ELSIF NEW.membership_role IS DISTINCT FROM OLD.membership_role THEN
    _action := 'organization_membership.role_changed';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    _action := CASE NEW.status
      WHEN 'suspended' THEN 'organization_membership.suspended'
      WHEN 'removed' THEN 'organization_membership.removed'
      WHEN 'active' THEN 'organization_membership.reactivated'
      ELSE 'organization_membership.status_changed'
    END;
  ELSE
    RETURN NEW;
  END IF;

  IF _actor IS NOT NULL THEN
    INSERT INTO public.admin_audit_logs (
      actor_id, action, entity_type, entity_id, previous_state, new_state, metadata
    ) VALUES (
      _actor,
      _action,
      'organization_membership',
      NEW.id::text,
      CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE jsonb_build_object(
        'membership_role', OLD.membership_role,
        'status', OLD.status
      ) END,
      jsonb_build_object(
        'organization_id', NEW.organization_id,
        'user_id', NEW.user_id,
        'membership_role', NEW.membership_role,
        'status', NEW.status
      ),
      jsonb_build_object(
        'source', 'organization_membership_foundation',
        'system_generated', auth.uid() IS NULL
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_organization_created ON public.organizations;
CREATE TRIGGER trg_audit_organization_created
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.audit_organization_created();

DROP TRIGGER IF EXISTS trg_validate_organization_membership_role ON public.organization_memberships;
CREATE TRIGGER trg_validate_organization_membership_role
BEFORE INSERT OR UPDATE OF organization_id, membership_role ON public.organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.validate_organization_membership_role();

DROP TRIGGER IF EXISTS trg_audit_organization_membership_change ON public.organization_memberships;
CREATE TRIGGER trg_audit_organization_membership_change
AFTER INSERT OR UPDATE OF membership_role, status ON public.organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.audit_organization_membership_change();

CREATE OR REPLACE FUNCTION public.provision_legacy_organization(
  _user_id uuid,
  _organization_type public.organization_type
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _organization_id uuid := public.legacy_organization_id(_user_id, _organization_type);
  _membership_id uuid := public.legacy_organization_membership_id(_organization_id, _user_id);
  _legal_name text;
  _display_name text;
  _country_id uuid;
  _account_active boolean;
BEGIN
  IF _user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Cannot provision organization for an unknown user';
  END IF;

  IF _organization_type = 'agency' THEN
    IF NOT (
      public.has_role(_user_id, 'organizer')
      OR EXISTS (SELECT 1 FROM public.rfqs WHERE organizer_id = _user_id)
    ) THEN
      RAISE EXCEPTION 'Agency organization requires organizer authority or RFQ ownership';
    END IF;
    IF public.has_role(_user_id, 'hotel')
       OR EXISTS (SELECT 1 FROM public.hotels WHERE owner_id = _user_id) THEN
      RAISE EXCEPTION 'Ambiguous legacy ownership for user %', _user_id;
    END IF;
  ELSIF _organization_type = 'supplier' THEN
    IF NOT (
      public.has_role(_user_id, 'hotel')
      OR EXISTS (SELECT 1 FROM public.hotels WHERE owner_id = _user_id)
    ) THEN
      RAISE EXCEPTION 'Supplier organization requires hotel authority or listing ownership';
    END IF;
    IF public.has_role(_user_id, 'organizer')
       OR EXISTS (SELECT 1 FROM public.rfqs WHERE organizer_id = _user_id) THEN
      RAISE EXCEPTION 'Ambiguous legacy ownership for user %', _user_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Legacy provisioning does not support organization type %', _organization_type;
  END IF;

  SELECT
    NULLIF(btrim(COALESCE(profile.legal_company_name, profile.company_name, profile.org_name, '')), ''),
    COALESCE(
      NULLIF(btrim(profile.trade_name), ''),
      NULLIF(btrim(profile.company_name), ''),
      NULLIF(btrim(profile.org_name), ''),
      NULLIF(btrim(profile.legal_company_name), ''),
      NULLIF(btrim(profile.full_name), ''),
      CASE _organization_type
        WHEN 'agency' THEN 'Agency account'
        ELSE NULLIF(btrim((
          SELECT hotel.name
          FROM public.hotels hotel
          WHERE hotel.owner_id = _user_id
          ORDER BY hotel.created_at, hotel.id
          LIMIT 1
        )), '')
      END,
      CASE _organization_type WHEN 'agency' THEN 'Agency account' ELSE 'Supplier account' END
    ),
    profile.country_id,
    profile.account_status = 'active'
  INTO _legal_name, _display_name, _country_id, _account_active
  FROM public.profiles profile
  WHERE profile.id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Legacy marketplace user % has no profile', _user_id;
  END IF;

  INSERT INTO public.organizations (
    id, organization_type, legal_name, display_name, status, country_id,
    created_by, legacy_owner_user_id
  ) VALUES (
    _organization_id,
    _organization_type,
    _legal_name,
    _display_name,
    CASE WHEN _account_active
      THEN 'active'::public.organization_status
      ELSE 'suspended'::public.organization_status
    END,
    _country_id,
    _user_id,
    _user_id
  )
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations organization
    WHERE organization.id = _organization_id
      AND organization.organization_type = _organization_type
      AND organization.legacy_owner_user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Deterministic organization identity collision for user %', _user_id;
  END IF;

  INSERT INTO public.organization_memberships (
    id, organization_id, user_id, membership_role, status, invited_by, joined_at
  ) VALUES (
    _membership_id,
    _organization_id,
    _user_id,
    'owner',
    CASE WHEN _account_active
      THEN 'active'::public.organization_membership_status
      ELSE 'suspended'::public.organization_membership_status
    END,
    _user_id,
    now()
  )
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_memberships membership
    WHERE membership.id = _membership_id
      AND membership.organization_id = _organization_id
      AND membership.user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Deterministic membership identity collision for user %', _user_id;
  END IF;

  IF _organization_type = 'supplier' THEN
    INSERT INTO public.organization_hotel_mappings (
      hotel_id, organization_id, created_by
    )
    SELECT hotel.id, _organization_id, _user_id
    FROM public.hotels hotel
    WHERE hotel.owner_id = _user_id
    ON CONFLICT (hotel_id) DO NOTHING;

    IF EXISTS (
      SELECT 1
      FROM public.hotels hotel
      LEFT JOIN public.organization_hotel_mappings mapping ON mapping.hotel_id = hotel.id
      WHERE hotel.owner_id = _user_id
        AND mapping.organization_id IS DISTINCT FROM _organization_id
    ) THEN
      RAISE EXCEPTION 'Hotel mapping conflict for legacy owner %', _user_id;
    END IF;
  END IF;

  RETURN _organization_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.provision_organization_from_legacy_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = NEW.user_id
      AND role.role IN ('admin', CASE WHEN NEW.role = 'organizer' THEN 'hotel'::public.app_role ELSE 'organizer'::public.app_role END)
      AND role.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'Platform and marketplace roles cannot be conflated into an organization membership';
  END IF;

  PERFORM public.provision_legacy_organization(
    NEW.user_id,
    CASE NEW.role
      WHEN 'organizer' THEN 'agency'::public.organization_type
      WHEN 'hotel' THEN 'supplier'::public.organization_type
    END
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_hotel_organization_mapping()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _organization_id uuid;
BEGIN
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  _organization_id := public.provision_legacy_organization(NEW.owner_id, 'supplier');

  INSERT INTO public.organization_hotel_mappings (
    hotel_id, organization_id, created_by
  ) VALUES (
    NEW.id, _organization_id, NEW.owner_id
  )
  ON CONFLICT (hotel_id) DO UPDATE
  SET organization_id = EXCLUDED.organization_id,
      created_by = EXCLUDED.created_by;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_legacy_account_organization_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.account_status IS NOT DISTINCT FROM OLD.account_status THEN
    RETURN NEW;
  END IF;

  UPDATE public.organizations organization
  SET status = CASE WHEN NEW.account_status = 'active'
    THEN 'active'::public.organization_status
    ELSE 'suspended'::public.organization_status
  END
  WHERE organization.legacy_owner_user_id = NEW.id
    AND organization.status <> 'archived';

  UPDATE public.organization_memberships membership
  SET status = CASE WHEN NEW.account_status = 'active'
        THEN 'active'::public.organization_membership_status
        ELSE 'suspended'::public.organization_membership_status
      END,
      joined_at = COALESCE(membership.joined_at, now())
  FROM public.organizations organization
  WHERE organization.id = membership.organization_id
    AND organization.legacy_owner_user_id = NEW.id
    AND membership.user_id = NEW.id
    AND membership.status <> 'removed';

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_active_organization_member(_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_account_active(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.organization_memberships membership
      JOIN public.organizations organization ON organization.id = membership.organization_id
      WHERE membership.organization_id = _organization_id
        AND membership.user_id = auth.uid()
        AND membership.status = 'active'
        AND organization.status = 'active'
        AND organization.archived_at IS NULL
    )
$$;

CREATE OR REPLACE FUNCTION public.user_organization_role(_organization_id uuid)
RETURNS public.organization_membership_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT membership.membership_role
  FROM public.organization_memberships membership
  JOIN public.organizations organization ON organization.id = membership.organization_id
  WHERE membership.organization_id = _organization_id
    AND membership.user_id = auth.uid()
    AND membership.status = 'active'
    AND organization.status = 'active'
    AND organization.archived_at IS NULL
    AND public.is_account_active(auth.uid())
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_manage_organization(_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM public.organization_memberships membership
      JOIN public.organizations organization ON organization.id = membership.organization_id
      WHERE membership.organization_id = _organization_id
        AND membership.user_id = auth.uid()
        AND membership.status = 'active'
        AND membership.membership_role IN ('owner', 'admin')
        AND organization.status = 'active'
        AND organization.archived_at IS NULL
        AND public.is_account_active(auth.uid())
    )
    OR public.has_permission(auth.uid(), 'manage_users')
    OR EXISTS (
      SELECT 1
      FROM public.organizations organization
      WHERE organization.id = _organization_id
        AND (
          (organization.organization_type = 'agency' AND public.has_permission(auth.uid(), 'manage_agencies'))
          OR (organization.organization_type = 'supplier' AND public.has_permission(auth.uid(), 'manage_hotels'))
        )
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.organization_represents_legacy_owner(
  _organization_id uuid,
  _legacy_owner_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations organization
    WHERE organization.id = _organization_id
      AND organization.legacy_owner_user_id = _legacy_owner_user_id
  )
$$;

DO $$
DECLARE
  _ambiguous_user uuid;
  _missing_profile_user uuid;
BEGIN
  WITH signals AS (
    SELECT
      user_account.id AS user_id,
      EXISTS (SELECT 1 FROM public.user_roles role WHERE role.user_id = user_account.id AND role.role = 'organizer')
        OR EXISTS (SELECT 1 FROM public.rfqs rfq WHERE rfq.organizer_id = user_account.id) AS agency_signal,
      EXISTS (SELECT 1 FROM public.user_roles role WHERE role.user_id = user_account.id AND role.role = 'hotel')
        OR EXISTS (SELECT 1 FROM public.hotels hotel WHERE hotel.owner_id = user_account.id) AS supplier_signal
    FROM auth.users user_account
  )
  SELECT signal.user_id
  INTO _ambiguous_user
  FROM signals signal
  WHERE signal.agency_signal AND signal.supplier_signal
  LIMIT 1;

  IF _ambiguous_user IS NOT NULL THEN
    RAISE EXCEPTION 'Ambiguous legacy marketplace ownership for user %', _ambiguous_user;
  END IF;

  WITH marketplace_users AS (
    SELECT DISTINCT role.user_id
    FROM public.user_roles role
    WHERE role.role IN ('organizer', 'hotel')
    UNION
    SELECT DISTINCT rfq.organizer_id FROM public.rfqs rfq
    UNION
    SELECT DISTINCT hotel.owner_id FROM public.hotels hotel WHERE hotel.owner_id IS NOT NULL
  )
  SELECT marketplace.user_id
  INTO _missing_profile_user
  FROM marketplace_users marketplace
  LEFT JOIN public.profiles profile ON profile.id = marketplace.user_id
  WHERE profile.id IS NULL
  LIMIT 1;

  IF _missing_profile_user IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy marketplace owner % has no profile', _missing_profile_user;
  END IF;
END;
$$;

WITH signals AS (
  SELECT
    user_account.id AS user_id,
    EXISTS (SELECT 1 FROM public.user_roles role WHERE role.user_id = user_account.id AND role.role = 'organizer')
      OR EXISTS (SELECT 1 FROM public.rfqs rfq WHERE rfq.organizer_id = user_account.id) AS agency_signal,
    EXISTS (SELECT 1 FROM public.user_roles role WHERE role.user_id = user_account.id AND role.role = 'hotel')
      OR EXISTS (SELECT 1 FROM public.hotels hotel WHERE hotel.owner_id = user_account.id) AS supplier_signal,
    EXISTS (SELECT 1 FROM public.user_roles role WHERE role.user_id = user_account.id AND role.role = 'admin') AS admin_signal,
    EXISTS (SELECT 1 FROM public.rfqs rfq WHERE rfq.organizer_id = user_account.id)
      OR EXISTS (SELECT 1 FROM public.hotels hotel WHERE hotel.owner_id = user_account.id) AS owns_marketplace_resource
  FROM auth.users user_account
)
SELECT public.provision_legacy_organization(
  signal.user_id,
  CASE WHEN signal.agency_signal THEN 'agency'::public.organization_type ELSE 'supplier'::public.organization_type END
)
FROM signals signal
WHERE (signal.agency_signal OR signal.supplier_signal)
  AND NOT (signal.admin_signal AND NOT signal.owns_marketplace_resource);

DROP TRIGGER IF EXISTS trg_provision_organization_from_legacy_role ON public.user_roles;
CREATE TRIGGER trg_provision_organization_from_legacy_role
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.provision_organization_from_legacy_role();

DROP TRIGGER IF EXISTS trg_sync_hotel_organization_mapping ON public.hotels;
CREATE TRIGGER trg_sync_hotel_organization_mapping
AFTER INSERT OR UPDATE OF owner_id ON public.hotels
FOR EACH ROW EXECUTE FUNCTION public.sync_hotel_organization_mapping();

DROP TRIGGER IF EXISTS trg_sync_legacy_account_organization_status ON public.profiles;
CREATE TRIGGER trg_sync_legacy_account_organization_status
AFTER UPDATE OF account_status ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_account_organization_status();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_hotel_mappings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.organizations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.organization_memberships FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.organization_hotel_mappings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT ON public.organization_memberships TO authenticated;
GRANT SELECT ON public.organization_hotel_mappings TO authenticated;
GRANT ALL ON public.organizations, public.organization_memberships,
  public.organization_hotel_mappings TO service_role;

DROP POLICY IF EXISTS "Members and platform admins view organizations" ON public.organizations;
CREATE POLICY "Members and platform admins view organizations"
ON public.organizations FOR SELECT TO authenticated
USING (
  public.is_active_organization_member(id)
  OR public.is_enterprise_admin(auth.uid())
);

DROP POLICY IF EXISTS "Members and platform admins view memberships" ON public.organization_memberships;
CREATE POLICY "Members and platform admins view memberships"
ON public.organization_memberships FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.can_manage_organization(organization_id)
);

DROP POLICY IF EXISTS "Members and platform admins view hotel mappings" ON public.organization_hotel_mappings;
CREATE POLICY "Members and platform admins view hotel mappings"
ON public.organization_hotel_mappings FOR SELECT TO authenticated
USING (
  public.is_active_organization_member(organization_id)
  OR public.is_enterprise_admin(auth.uid())
);

REVOKE ALL ON FUNCTION public.legacy_organization_id(uuid, public.organization_type)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_organization_membership_id(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_organization_created()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_organization_membership_role()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_organization_membership_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.provision_legacy_organization(uuid, public.organization_type)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.provision_organization_from_legacy_role()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_hotel_organization_mapping()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_legacy_account_organization_status()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.legacy_organization_id(uuid, public.organization_type)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.legacy_organization_membership_id(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.provision_legacy_organization(uuid, public.organization_type)
  TO service_role;

REVOKE ALL ON FUNCTION public.is_active_organization_member(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_organization_role(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_organization(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.organization_represents_legacy_owner(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_organization_member(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_organization_role(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_organization(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.organization_represents_legacy_owner(uuid, uuid)
  TO service_role;

DO $$
DECLARE
  _eligible_count bigint;
  _mapped_count bigint;
BEGIN
  WITH signals AS (
    SELECT
      user_account.id AS user_id,
      EXISTS (SELECT 1 FROM public.user_roles role WHERE role.user_id = user_account.id AND role.role = 'organizer')
        OR EXISTS (SELECT 1 FROM public.rfqs rfq WHERE rfq.organizer_id = user_account.id) AS agency_signal,
      EXISTS (SELECT 1 FROM public.user_roles role WHERE role.user_id = user_account.id AND role.role = 'hotel')
        OR EXISTS (SELECT 1 FROM public.hotels hotel WHERE hotel.owner_id = user_account.id) AS supplier_signal,
      EXISTS (SELECT 1 FROM public.user_roles role WHERE role.user_id = user_account.id AND role.role = 'admin') AS admin_signal,
      EXISTS (SELECT 1 FROM public.rfqs rfq WHERE rfq.organizer_id = user_account.id)
        OR EXISTS (SELECT 1 FROM public.hotels hotel WHERE hotel.owner_id = user_account.id) AS owns_marketplace_resource
    FROM auth.users user_account
  )
  SELECT count(*)
  INTO _eligible_count
  FROM signals signal
  WHERE (signal.agency_signal OR signal.supplier_signal)
    AND NOT (signal.admin_signal AND NOT signal.owns_marketplace_resource);

  SELECT count(*)
  INTO _mapped_count
  FROM public.organizations organization
  JOIN public.organization_memberships membership
    ON membership.organization_id = organization.id
   AND membership.user_id = organization.legacy_owner_user_id
  WHERE organization.legacy_owner_user_id IS NOT NULL;

  IF _eligible_count <> _mapped_count THEN
    RAISE EXCEPTION 'Organization backfill mismatch: eligible %, mapped %', _eligible_count, _mapped_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.hotels hotel
    LEFT JOIN public.organization_hotel_mappings mapping ON mapping.hotel_id = hotel.id
    LEFT JOIN public.organizations organization ON organization.id = mapping.organization_id
    WHERE hotel.owner_id IS NOT NULL
      AND (
        mapping.hotel_id IS NULL
        OR organization.organization_type <> 'supplier'
        OR organization.legacy_owner_user_id <> hotel.owner_id
      )
  ) THEN
    RAISE EXCEPTION 'One or more owned hotel listings lack a canonical supplier mapping';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_memberships membership
    LEFT JOIN public.organizations organization ON organization.id = membership.organization_id
    LEFT JOIN auth.users user_account ON user_account.id = membership.user_id
    WHERE organization.id IS NULL OR user_account.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Orphan organization membership detected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organizations organization
    WHERE organization.legacy_owner_user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_memberships membership
        WHERE membership.organization_id = organization.id
          AND membership.user_id = organization.legacy_owner_user_id
          AND membership.membership_role = 'owner'
      )
  ) THEN
    RAISE EXCEPTION 'Legacy organization owner membership is missing';
  END IF;
END;
$$;

COMMIT;
