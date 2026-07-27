-- GroupToStay V2.3: additive enterprise administration and approval layer.
-- Legacy app_role/user_roles records remain authoritative for marketplace roles.

CREATE TABLE IF NOT EXISTS public.enterprise_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9_]*$'),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  access_level integer NOT NULL DEFAULT 0 CHECK (access_level BETWEEN 0 AND 100),
  is_system boolean NOT NULL DEFAULT true,
  is_protected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.enterprise_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS public.user_enterprise_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.enterprise_roles(id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  granted boolean NOT NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_key)
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  previous_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment text,
  ip_address inet,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission
  ON public.role_permissions(permission_key);
CREATE INDEX IF NOT EXISTS idx_user_enterprise_roles_role
  ON public.user_enterprise_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_permission
  ON public.user_permission_overrides(permission_key);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity
  ON public.admin_audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor
  ON public.admin_audit_logs(actor_id, created_at DESC);

ALTER TABLE public.subscription_interest
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_notes text,
  ADD COLUMN IF NOT EXISTS approval_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_reviewed_at timestamptz;

ALTER TABLE public.subscription_interest
  DROP CONSTRAINT IF EXISTS subscription_interest_approval_status_check;
ALTER TABLE public.subscription_interest
  ADD CONSTRAINT subscription_interest_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'changes_requested'));

UPDATE public.subscription_interest
SET approval_status = 'approved'
WHERE status = 'notified'
  AND approval_status = 'pending';

INSERT INTO public.enterprise_roles (slug, name, description, access_level, is_system, is_protected)
VALUES
  ('super_admin', 'Super Admin', 'Full platform access and protected administration.', 100, true, true),
  ('admin', 'Admin', 'Platform operations with protected system boundaries.', 80, true, false),
  ('assistant_admin', 'Assistant Admin', 'Daily marketplace and approval operations.', 50, true, false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  access_level = EXCLUDED.access_level,
  is_system = EXCLUDED.is_system,
  is_protected = EXCLUDED.is_protected,
  updated_at = now();

INSERT INTO public.permissions (key, name, description, category)
VALUES
  ('manage_hotels', 'Manage Hotels', 'Review and manage hotel companies and listings.', 'marketplace'),
  ('manage_agencies', 'Manage Agencies', 'Review and manage agency accounts.', 'marketplace'),
  ('manage_rfqs', 'Manage RFQs', 'View and moderate group requests.', 'marketplace'),
  ('manage_quotations', 'Manage Quotations', 'View and moderate hotel quotations.', 'marketplace'),
  ('manage_bookings', 'Manage Bookings', 'View and manage booking records.', 'marketplace'),
  ('manage_messages', 'Manage Messages', 'Review and respond to marketplace conversations.', 'communications'),
  ('manage_notifications', 'Manage Notifications', 'Manage platform notification records.', 'communications'),
  ('manage_users', 'Manage Users', 'Manage account profile and account status.', 'users'),
  ('manage_roles', 'Manage Roles', 'Assign enterprise roles and permissions.', 'users'),
  ('manage_approvals', 'Manage Approvals', 'Review and decide approval requests.', 'approvals'),
  ('manage_subscriptions', 'Manage Subscriptions', 'Manage subscription requests and plans.', 'commerce'),
  ('manage_payments', 'Manage Payments', 'Manage supported payment operations.', 'commerce'),
  ('view_reports', 'View Reports', 'View operational reports.', 'insights'),
  ('view_analytics', 'View Analytics', 'View platform analytics and dashboards.', 'insights'),
  ('manage_settings', 'Manage Settings', 'Manage non-core platform settings.', 'system'),
  ('manage_system_configuration', 'Manage System Configuration', 'Manage protected core configuration.', 'system'),
  ('manage_audit_logs', 'Manage Audit Logs', 'View immutable administration history.', 'system')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT role.id, permission.key
FROM public.enterprise_roles role
CROSS JOIN public.permissions permission
WHERE role.slug = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT role.id, permission.key
FROM public.enterprise_roles role
JOIN public.permissions permission ON permission.key = ANY (ARRAY[
  'manage_hotels',
  'manage_agencies',
  'manage_rfqs',
  'manage_quotations',
  'manage_bookings',
  'manage_messages',
  'manage_notifications',
  'manage_users',
  'manage_roles',
  'manage_approvals',
  'manage_subscriptions',
  'manage_payments',
  'view_reports',
  'view_analytics',
  'manage_settings',
  'manage_audit_logs'
])
WHERE role.slug = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT role.id, permission.key
FROM public.enterprise_roles role
JOIN public.permissions permission ON permission.key = ANY (ARRAY[
  'manage_hotels',
  'manage_agencies',
  'manage_rfqs',
  'manage_bookings',
  'manage_messages',
  'manage_notifications',
  'manage_approvals',
  'view_analytics'
])
WHERE role.slug = 'assistant_admin'
ON CONFLICT DO NOTHING;

-- Preserve all existing admin access by assigning legacy admins to the protected role.
INSERT INTO public.user_enterprise_roles (user_id, role_id)
SELECT legacy.user_id, role.id
FROM public.user_roles legacy
JOIN public.enterprise_roles role ON role.slug = 'super_admin'
WHERE legacy.role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_enterprise_role(_user_id uuid, _role_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_enterprise_roles assignment
    JOIN public.enterprise_roles role ON role.id = assignment.role_id
    WHERE assignment.user_id = _user_id
      AND role.slug = _role_slug
  )
$$;

CREATE OR REPLACE FUNCTION public.is_enterprise_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
    AND (
      public.has_role(_user_id, 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.user_enterprise_roles assignment
        JOIN public.enterprise_roles role ON role.id = assignment.role_id
        WHERE assignment.user_id = _user_id
          AND role.slug IN ('super_admin', 'admin', 'assistant_admin')
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _override boolean;
  _has_assignment boolean;
BEGIN
  IF _user_id IS NULL OR _permission_key IS NULL THEN
    RETURN false;
  END IF;

  SELECT override.granted
  INTO _override
  FROM public.user_permission_overrides override
  WHERE override.user_id = _user_id
    AND override.permission_key = _permission_key;

  IF FOUND THEN
    RETURN _override;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_enterprise_roles assignment
    WHERE assignment.user_id = _user_id
  ) INTO _has_assignment;

  -- A legacy admin without an enterprise assignment retains the original full access.
  IF NOT _has_assignment AND public.has_role(_user_id, 'admin') THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_enterprise_roles assignment
    JOIN public.enterprise_roles role ON role.id = assignment.role_id
    LEFT JOIN public.role_permissions role_permission ON role_permission.role_id = role.id
    WHERE assignment.user_id = _user_id
      AND (
        role.slug = 'super_admin'
        OR role_permission.permission_key = _permission_key
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_admin_access()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH assigned AS (
    SELECT role.slug, role.name, role.access_level
    FROM public.user_enterprise_roles assignment
    JOIN public.enterprise_roles role ON role.id = assignment.role_id
    WHERE assignment.user_id = auth.uid()
  ),
  effective_permissions AS (
    SELECT permission.key
    FROM public.permissions permission
    WHERE public.has_permission(auth.uid(), permission.key)
    ORDER BY permission.key
  )
  SELECT jsonb_build_object(
    'is_admin', public.is_enterprise_admin(auth.uid()),
    'role', COALESCE(
      (SELECT slug FROM assigned),
      CASE WHEN public.has_role(auth.uid(), 'admin') THEN 'super_admin' ELSE NULL END
    ),
    'role_name', COALESCE(
      (SELECT name FROM assigned),
      CASE WHEN public.has_role(auth.uid(), 'admin') THEN 'Super Admin' ELSE NULL END
    ),
    'access_level', COALESCE(
      (SELECT access_level FROM assigned),
      CASE WHEN public.has_role(auth.uid(), 'admin') THEN 100 ELSE 0 END
    ),
    'permissions', COALESCE(
      (SELECT jsonb_agg(key) FROM effective_permissions),
      '[]'::jsonb
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.admin_get_user_auth_metadata()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'manage_users') THEN
    RAISE EXCEPTION 'Permission denied: manage_users is required';
  END IF;

  RETURN QUERY
  SELECT users.id, users.email::text, users.created_at, users.last_sign_in_at
  FROM auth.users users
  ORDER BY users.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_role_permissions(
  _role_slug text,
  _permission_keys text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_role public.enterprise_roles%ROWTYPE;
  _target_role public.enterprise_roles%ROWTYPE;
  _previous jsonb;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'manage_roles') THEN
    RAISE EXCEPTION 'Permission denied: manage_roles is required';
  END IF;

  SELECT role.* INTO _actor_role
  FROM public.user_enterprise_roles assignment
  JOIN public.enterprise_roles role ON role.id = assignment.role_id
  WHERE assignment.user_id = auth.uid();

  SELECT * INTO _target_role
  FROM public.enterprise_roles
  WHERE slug = _role_slug;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown enterprise role';
  END IF;
  IF _target_role.slug = 'super_admin' THEN
    RAISE EXCEPTION 'The Super Admin role is protected';
  END IF;
  IF _actor_role.slug IS DISTINCT FROM 'super_admin'
     AND _actor_role.access_level <= _target_role.access_level THEN
    RAISE EXCEPTION 'A role can only modify lower-access roles';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(_permission_keys, ARRAY[]::text[])) requested(key)
    LEFT JOIN public.permissions permission ON permission.key = requested.key
    WHERE permission.key IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more permissions are unknown';
  END IF;

  SELECT COALESCE(jsonb_agg(permission_key ORDER BY permission_key), '[]'::jsonb)
  INTO _previous
  FROM public.role_permissions
  WHERE role_id = _target_role.id;

  DELETE FROM public.role_permissions
  WHERE role_id = _target_role.id;

  INSERT INTO public.role_permissions (role_id, permission_key, created_by)
  SELECT _target_role.id, requested.key, auth.uid()
  FROM unnest(COALESCE(_permission_keys, ARRAY[]::text[])) requested(key)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.admin_audit_logs (
    actor_id, action, entity_type, entity_id, previous_state, new_state
  )
  VALUES (
    auth.uid(),
    'role_permissions_updated',
    'enterprise_role',
    _target_role.id::text,
    jsonb_build_object('permissions', _previous),
    jsonb_build_object(
      'permissions',
      to_jsonb(COALESCE(_permission_keys, ARRAY[]::text[]))
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  _target_user_id uuid,
  _role_slug text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_role public.enterprise_roles%ROWTYPE;
  _current_role public.enterprise_roles%ROWTYPE;
  _next_role public.enterprise_roles%ROWTYPE;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'manage_roles') THEN
    RAISE EXCEPTION 'Permission denied: manage_roles is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target_user_id) THEN
    RAISE EXCEPTION 'Target user does not exist';
  END IF;

  SELECT role.* INTO _actor_role
  FROM public.user_enterprise_roles assignment
  JOIN public.enterprise_roles role ON role.id = assignment.role_id
  WHERE assignment.user_id = auth.uid();

  SELECT role.* INTO _current_role
  FROM public.user_enterprise_roles assignment
  JOIN public.enterprise_roles role ON role.id = assignment.role_id
  WHERE assignment.user_id = _target_user_id;

  IF public.has_role(_target_user_id, 'admin')
     AND (
       _role_slug IS NULL
       OR btrim(_role_slug) = ''
       OR _role_slug IS DISTINCT FROM 'super_admin'
     ) THEN
    RAISE EXCEPTION 'Legacy Super Admin assignments cannot be downgraded';
  END IF;

  IF _current_role.slug = 'super_admin'
     AND _actor_role.slug IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only a Super Admin can modify another Super Admin';
  END IF;

  IF _role_slug IS NULL OR btrim(_role_slug) = '' THEN
    IF _current_role.slug = 'super_admin' THEN
      RAISE EXCEPTION 'A Super Admin assignment cannot be removed';
    END IF;
    DELETE FROM public.user_enterprise_roles
    WHERE user_id = _target_user_id;
  ELSE
    SELECT * INTO _next_role
    FROM public.enterprise_roles
    WHERE slug = _role_slug;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown enterprise role';
    END IF;
    IF _next_role.slug = 'super_admin'
       AND _actor_role.slug IS DISTINCT FROM 'super_admin' THEN
      RAISE EXCEPTION 'Only a Super Admin can assign the Super Admin role';
    END IF;
    IF _actor_role.slug IS DISTINCT FROM 'super_admin'
       AND _actor_role.access_level <= _next_role.access_level THEN
      RAISE EXCEPTION 'A role can only assign lower-access roles';
    END IF;

    INSERT INTO public.user_enterprise_roles (user_id, role_id, assigned_by, assigned_at)
    VALUES (_target_user_id, _next_role.id, auth.uid(), now())
    ON CONFLICT (user_id) DO UPDATE SET
      role_id = EXCLUDED.role_id,
      assigned_by = EXCLUDED.assigned_by,
      assigned_at = EXCLUDED.assigned_at;
  END IF;

  INSERT INTO public.admin_audit_logs (
    actor_id, action, entity_type, entity_id, previous_state, new_state
  )
  VALUES (
    auth.uid(),
    'user_role_changed',
    'user',
    _target_user_id::text,
    jsonb_build_object('role', _current_role.slug),
    jsonb_build_object('role', NULLIF(btrim(COALESCE(_role_slug, '')), ''))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_permissions(
  _target_user_id uuid,
  _permission_keys text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_role public.enterprise_roles%ROWTYPE;
  _target_role public.enterprise_roles%ROWTYPE;
  _previous jsonb;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'manage_roles') THEN
    RAISE EXCEPTION 'Permission denied: manage_roles is required';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(_permission_keys, ARRAY[]::text[])) requested(key)
    LEFT JOIN public.permissions permission ON permission.key = requested.key
    WHERE permission.key IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more permissions are unknown';
  END IF;

  SELECT role.* INTO _actor_role
  FROM public.user_enterprise_roles assignment
  JOIN public.enterprise_roles role ON role.id = assignment.role_id
  WHERE assignment.user_id = auth.uid();

  SELECT role.* INTO _target_role
  FROM public.user_enterprise_roles assignment
  JOIN public.enterprise_roles role ON role.id = assignment.role_id
  WHERE assignment.user_id = _target_user_id;

  IF _target_role.slug = 'super_admin' THEN
    RAISE EXCEPTION 'Super Admin permissions are protected';
  END IF;
  IF _actor_role.slug IS DISTINCT FROM 'super_admin'
     AND COALESCE(_target_role.access_level, 0) >= _actor_role.access_level THEN
    RAISE EXCEPTION 'A role can only modify lower-access users';
  END IF;

  SELECT COALESCE(jsonb_agg(permission.key ORDER BY permission.key), '[]'::jsonb)
  INTO _previous
  FROM public.permissions permission
  WHERE public.has_permission(_target_user_id, permission.key);

  DELETE FROM public.user_permission_overrides
  WHERE user_id = _target_user_id;

  INSERT INTO public.user_permission_overrides (
    user_id, permission_key, granted, assigned_by
  )
  SELECT
    _target_user_id,
    permission.key,
    permission.key = ANY(COALESCE(_permission_keys, ARRAY[]::text[])),
    auth.uid()
  FROM public.permissions permission
  WHERE (
    permission.key = ANY(COALESCE(_permission_keys, ARRAY[]::text[]))
  ) IS DISTINCT FROM EXISTS (
    SELECT 1
    FROM public.role_permissions role_permission
    WHERE role_permission.role_id = _target_role.id
      AND role_permission.permission_key = permission.key
  );

  INSERT INTO public.admin_audit_logs (
    actor_id, action, entity_type, entity_id, previous_state, new_state
  )
  VALUES (
    auth.uid(),
    'user_permissions_changed',
    'user',
    _target_user_id::text,
    jsonb_build_object('permissions', _previous),
    jsonb_build_object(
      'permissions',
      to_jsonb(COALESCE(_permission_keys, ARRAY[]::text[]))
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_decide_approval(
  _source_type text,
  _source_id uuid,
  _decision text,
  _comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _previous_status text;
  _new_status text;
  _audit_id uuid;
  _subject_user_id uuid;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'manage_approvals') THEN
    RAISE EXCEPTION 'Permission denied: manage_approvals is required';
  END IF;
  IF _decision NOT IN ('approve', 'reject', 'request_changes') THEN
    RAISE EXCEPTION 'Unsupported approval decision';
  END IF;
  IF _decision IN ('reject', 'request_changes')
     AND NULLIF(btrim(COALESCE(_comment, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A comment is required for this decision';
  END IF;

  CASE _source_type
    WHEN 'agency_verification' THEN
      SELECT agency_verification_status::text, id
      INTO _previous_status, _subject_user_id
      FROM public.profiles
      WHERE id = _source_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Agency verification not found'; END IF;

      _new_status := CASE _decision
        WHEN 'approve' THEN 'verified'
        WHEN 'reject' THEN 'rejected'
        ELSE 'pending_review'
      END;

      UPDATE public.profiles
      SET
        agency_verification_status = _new_status::public.agency_verification_status,
        verification_reviewed_at = now(),
        verification_reviewed_by = auth.uid(),
        verification_rejection_reason = CASE
          WHEN _decision = 'approve' THEN NULL
          ELSE btrim(_comment)
        END
      WHERE id = _source_id;

      INSERT INTO public.agency_verification_events (
        agency_id, event_type, notes, actor_id
      )
      VALUES (
        _source_id,
        CASE _decision
          WHEN 'approve' THEN 'approved'
          WHEN 'reject' THEN 'rejected'
          ELSE 'info_requested'
        END,
        NULLIF(btrim(COALESCE(_comment, '')), ''),
        auth.uid()
      );

    WHEN 'hotel_verification' THEN
      SELECT hotel_approval_status::text, id
      INTO _previous_status, _subject_user_id
      FROM public.profiles
      WHERE id = _source_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Hotel verification not found'; END IF;

      _new_status := CASE _decision
        WHEN 'approve' THEN 'approved'
        WHEN 'reject' THEN 'rejected'
        ELSE 'pending'
      END;

      UPDATE public.profiles
      SET
        hotel_approval_status = _new_status::public.hotel_approval_status,
        approval_notes = NULLIF(btrim(COALESCE(_comment, '')), ''),
        approved_at = CASE WHEN _decision = 'approve' THEN now() ELSE NULL END,
        approved_by = CASE WHEN _decision = 'approve' THEN auth.uid() ELSE NULL END
      WHERE id = _source_id;

    WHEN 'hotel_listing' THEN
      SELECT status::text, owner_id
      INTO _previous_status, _subject_user_id
      FROM public.hotels
      WHERE id = _source_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Hotel listing not found'; END IF;

      _new_status := CASE _decision
        WHEN 'approve' THEN 'approved'
        WHEN 'reject' THEN 'suspended'
        ELSE _previous_status
      END;

      IF _decision = 'approve' THEN
        UPDATE public.hotels SET status = 'approved' WHERE id = _source_id;
      ELSIF _decision = 'reject' THEN
        UPDATE public.hotels
        SET status = 'suspended', archived = true, owner_id = NULL
        WHERE id = _source_id;
      END IF;

    WHEN 'subscription_request' THEN
      SELECT approval_status, user_id
      INTO _previous_status, _subject_user_id
      FROM public.subscription_interest
      WHERE id = _source_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Subscription request not found'; END IF;

      _new_status := CASE _decision
        WHEN 'approve' THEN 'approved'
        WHEN 'reject' THEN 'rejected'
        ELSE 'changes_requested'
      END;

      UPDATE public.subscription_interest
      SET
        approval_status = _new_status,
        approval_notes = NULLIF(btrim(COALESCE(_comment, '')), ''),
        approval_reviewed_by = auth.uid(),
        approval_reviewed_at = now(),
        status = CASE WHEN _decision = 'approve' THEN 'notified' ELSE status END,
        notified_at = CASE WHEN _decision = 'approve' THEN now() ELSE notified_at END
      WHERE id = _source_id;

    ELSE
      RAISE EXCEPTION 'Unsupported approval source';
  END CASE;

  INSERT INTO public.admin_audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    previous_state,
    new_state,
    comment,
    metadata
  )
  VALUES (
    auth.uid(),
    'approval_' || _decision,
    _source_type,
    _source_id::text,
    jsonb_build_object('status', _previous_status),
    jsonb_build_object('status', _new_status),
    NULLIF(btrim(COALESCE(_comment, '')), ''),
    jsonb_build_object('subject_user_id', _subject_user_id)
  )
  RETURNING id INTO _audit_id;

  RETURN jsonb_build_object(
    'audit_id', _audit_id,
    'source_type', _source_type,
    'source_id', _source_id,
    'previous_status', _previous_status,
    'new_status', _new_status
  );
END;
$$;

REVOKE ALL ON public.enterprise_roles FROM anon;
REVOKE ALL ON public.permissions FROM anon;
REVOKE ALL ON public.role_permissions FROM anon;
REVOKE ALL ON public.user_enterprise_roles FROM anon;
REVOKE ALL ON public.user_permission_overrides FROM anon;
REVOKE ALL ON public.admin_audit_logs FROM anon;

GRANT SELECT ON public.enterprise_roles TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT SELECT ON public.user_enterprise_roles TO authenticated;
GRANT SELECT ON public.user_permission_overrides TO authenticated;
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.enterprise_roles, public.permissions, public.role_permissions,
  public.user_enterprise_roles, public.user_permission_overrides,
  public.admin_audit_logs TO service_role;

ALTER TABLE public.enterprise_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_enterprise_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enterprise admins view role catalog"
ON public.enterprise_roles FOR SELECT TO authenticated
USING (public.is_enterprise_admin(auth.uid()));

CREATE POLICY "Enterprise admins view permission catalog"
ON public.permissions FOR SELECT TO authenticated
USING (public.is_enterprise_admin(auth.uid()));

CREATE POLICY "Enterprise admins view role permissions"
ON public.role_permissions FOR SELECT TO authenticated
USING (public.is_enterprise_admin(auth.uid()));

CREATE POLICY "Users view own or managed enterprise role"
ON public.user_enterprise_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_permission(auth.uid(), 'manage_users')
  OR public.has_permission(auth.uid(), 'manage_roles')
);

CREATE POLICY "Users view own or managed permission overrides"
ON public.user_permission_overrides FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_permission(auth.uid(), 'manage_users')
  OR public.has_permission(auth.uid(), 'manage_roles')
);

CREATE POLICY "Authorized admins view audit logs"
ON public.admin_audit_logs FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), 'manage_audit_logs')
  OR public.has_permission(auth.uid(), 'manage_approvals')
);

-- Add permission-aware access without removing any legacy admin policy.
CREATE POLICY "Enterprise admins view profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), 'manage_users')
  OR public.has_permission(auth.uid(), 'manage_agencies')
  OR public.has_permission(auth.uid(), 'manage_hotels')
  OR public.has_permission(auth.uid(), 'manage_approvals')
  OR public.has_permission(auth.uid(), 'view_analytics')
);

CREATE POLICY "Enterprise user managers update profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'manage_users'))
WITH CHECK (public.has_permission(auth.uid(), 'manage_users'));

CREATE POLICY "Enterprise admins view legacy roles"
ON public.user_roles FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), 'manage_users')
  OR public.has_permission(auth.uid(), 'manage_roles')
  OR public.has_permission(auth.uid(), 'view_analytics')
);

CREATE POLICY "Enterprise hotel managers view hotels"
ON public.hotels FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), 'manage_hotels')
  OR public.has_permission(auth.uid(), 'manage_approvals')
);

CREATE POLICY "Enterprise hotel managers update hotels"
ON public.hotels FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'manage_hotels'))
WITH CHECK (public.has_permission(auth.uid(), 'manage_hotels'));

CREATE POLICY "Enterprise hotel managers manage rooms"
ON public.hotel_rooms FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'manage_hotels'))
WITH CHECK (public.has_permission(auth.uid(), 'manage_hotels'));

CREATE POLICY "Enterprise hotel managers manage amenities"
ON public.hotel_amenities FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'manage_hotels'))
WITH CHECK (public.has_permission(auth.uid(), 'manage_hotels'));

CREATE POLICY "Enterprise RFQ managers view RFQs"
ON public.rfqs FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'manage_rfqs'));

CREATE POLICY "Enterprise RFQ managers update RFQs"
ON public.rfqs FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'manage_rfqs'))
WITH CHECK (public.has_permission(auth.uid(), 'manage_rfqs'));

CREATE POLICY "Enterprise RFQ managers delete RFQs"
ON public.rfqs FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'manage_rfqs'));

CREATE POLICY "Enterprise RFQ managers view invitations"
ON public.rfq_invitations FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'manage_rfqs'));

CREATE POLICY "Enterprise RFQ managers update invitations"
ON public.rfq_invitations FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'manage_rfqs'))
WITH CHECK (public.has_permission(auth.uid(), 'manage_rfqs'));

CREATE POLICY "Enterprise RFQ managers view lifecycle events"
ON public.rfq_lifecycle_events FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'manage_rfqs'));

CREATE POLICY "Enterprise quote managers view quotes"
ON public.quotes FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), 'manage_quotations')
  OR public.has_permission(auth.uid(), 'manage_rfqs')
);

CREATE POLICY "Enterprise quote managers update quotes"
ON public.quotes FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'manage_quotations'))
WITH CHECK (public.has_permission(auth.uid(), 'manage_quotations'));

CREATE POLICY "Enterprise booking managers view bookings"
ON public.bookings FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'manage_bookings'));

CREATE POLICY "Enterprise booking managers update bookings"
ON public.bookings FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'manage_bookings'))
WITH CHECK (public.has_permission(auth.uid(), 'manage_bookings'));

CREATE POLICY "Enterprise message managers view conversations"
ON public.conversations FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'manage_messages'));

CREATE POLICY "Enterprise message managers view participants"
ON public.conversation_participants FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'manage_messages'));

CREATE POLICY "Enterprise message managers view chat messages"
ON public.chat_messages FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'manage_messages'));

CREATE POLICY "Enterprise message managers send chat messages"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.has_permission(auth.uid(), 'manage_messages')
);

CREATE POLICY "Enterprise message managers view legacy messages"
ON public.messages FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'manage_messages'));

CREATE POLICY "Enterprise message managers send legacy messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.has_permission(auth.uid(), 'manage_messages')
);

CREATE POLICY "Enterprise notification managers view notifications"
ON public.notifications FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'manage_notifications'));

CREATE POLICY "Enterprise notification managers update notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'manage_notifications'))
WITH CHECK (public.has_permission(auth.uid(), 'manage_notifications'));

CREATE POLICY "Enterprise approval reviewers view agency events"
ON public.agency_verification_events FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'manage_approvals'));

CREATE POLICY "Enterprise admins view subscription requests"
ON public.subscription_interest FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), 'manage_subscriptions')
  OR public.has_permission(auth.uid(), 'manage_approvals')
);

CREATE POLICY "Enterprise subscription managers update requests"
ON public.subscription_interest FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'manage_subscriptions'))
WITH CHECK (public.has_permission(auth.uid(), 'manage_subscriptions'));

CREATE POLICY "Enterprise settings managers view settings"
ON public.platform_settings FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), 'manage_settings')
  OR public.has_permission(auth.uid(), 'manage_system_configuration')
);

CREATE POLICY "Enterprise settings managers update settings"
ON public.platform_settings FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'manage_settings'))
WITH CHECK (public.has_permission(auth.uid(), 'manage_settings'));

CREATE POLICY "Enterprise approval reviewers read agency documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'agency-documents'
  AND public.has_permission(auth.uid(), 'manage_approvals')
);

CREATE POLICY "Enterprise hotel managers manage hotel photos"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'hotel-photos'
  AND public.has_permission(auth.uid(), 'manage_hotels')
)
WITH CHECK (
  bucket_id = 'hotel-photos'
  AND public.has_permission(auth.uid(), 'manage_hotels')
);

CREATE OR REPLACE FUNCTION public.prevent_profile_approval_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin')
     OR public.has_permission(auth.uid(), 'manage_approvals') THEN
    RETURN NEW;
  END IF;
  IF NEW.hotel_approval_status IS DISTINCT FROM OLD.hotel_approval_status
     OR NEW.agency_verification_status IS DISTINCT FROM OLD.agency_verification_status
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approval_notes IS DISTINCT FROM OLD.approval_notes
     OR NEW.verification_reviewed_at IS DISTINCT FROM OLD.verification_reviewed_at
     OR NEW.verification_reviewed_by IS DISTINCT FROM OLD.verification_reviewed_by
     OR NEW.verification_rejection_reason IS DISTINCT FROM OLD.verification_rejection_reason THEN
    RAISE EXCEPTION 'Approval fields can only be modified by authorized reviewers';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_non_admin_account_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.has_permission(auth.uid(), 'manage_users') THEN
    RAISE EXCEPTION 'Only authorized user managers can change account status';
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "agency_docs_owner_or_admin_only" ON storage.objects;
CREATE POLICY "agency_docs_owner_or_admin_only" ON storage.objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    bucket_id <> 'agency-documents' OR (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_permission(auth.uid(), 'manage_approvals')
    )
  )
  WITH CHECK (
    bucket_id <> 'agency-documents' OR (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_permission(auth.uid(), 'manage_approvals')
    )
  );

REVOKE EXECUTE ON FUNCTION public.has_enterprise_role(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_enterprise_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_admin_access() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_user_auth_metadata() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_role_permissions(text, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_permissions(uuid, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_decide_approval(text, uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_enterprise_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_enterprise_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_admin_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user_auth_metadata() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role_permissions(text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_permissions(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decide_approval(text, uuid, text, text) TO authenticated;
