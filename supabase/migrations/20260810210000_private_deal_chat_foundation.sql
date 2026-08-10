-- GroupToStay V3 private Deal Chat foundation.
-- Existing V2 RFQ conversations remain unchanged and continue to use user participants.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.conversations') IS NULL
     OR to_regclass('public.conversation_participants') IS NULL
     OR to_regclass('public.chat_messages') IS NULL
     OR to_regclass('public.deals') IS NULL
     OR to_regclass('public.organizations') IS NULL
     OR to_regclass('public.organization_memberships') IS NULL
     OR to_regclass('public.admin_audit_logs') IS NULL THEN
    RAISE EXCEPTION 'Private Deal Chat prerequisites are missing';
  END IF;

  IF EXISTS (SELECT 1 FROM public.conversations WHERE rfq_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.conversations WHERE hotel_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.conversations WHERE organizer_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.conversations WHERE hotel_owner_id IS NULL) THEN
    RAISE EXCEPTION 'Unexpected nullable legacy conversation context detected';
  END IF;
END;
$$;

ALTER TABLE public.conversations
  ADD COLUMN deal_id uuid;

ALTER TABLE public.chat_messages
  ADD COLUMN sender_organization_id uuid;

ALTER TABLE public.conversations
  ALTER COLUMN rfq_id DROP NOT NULL,
  ALTER COLUMN hotel_id DROP NOT NULL,
  ALTER COLUMN organizer_id DROP NOT NULL,
  ALTER COLUMN hotel_owner_id DROP NOT NULL;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE RESTRICT,
  ADD CONSTRAINT conversations_deal_id_key UNIQUE (deal_id),
  ADD CONSTRAINT conversations_context_check CHECK (
    (
      deal_id IS NULL
      AND rfq_id IS NOT NULL
      AND hotel_id IS NOT NULL
      AND organizer_id IS NOT NULL
      AND hotel_owner_id IS NOT NULL
    )
    OR (
      deal_id IS NOT NULL
      AND rfq_id IS NULL
      AND quote_id IS NULL
      AND hotel_id IS NULL
      AND organizer_id IS NULL
      AND hotel_owner_id IS NULL
    )
  );

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_sender_organization_id_fkey
    FOREIGN KEY (sender_organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT chat_messages_deal_body_check CHECK (
    sender_organization_id IS NULL
    OR (
      char_length(btrim(body)) BETWEEN 1 AND 4000
      AND attachments = '[]'::jsonb
    )
  );

CREATE INDEX idx_chat_messages_conversation_order
  ON public.chat_messages(conversation_id, created_at, id);

COMMENT ON COLUMN public.conversations.deal_id IS
  'V3 Deal context. NULL identifies an unchanged V2 RFQ conversation.';
COMMENT ON COLUMN public.chat_messages.sender_organization_id IS
  'V3 organization sender authority. NULL identifies an unchanged V2 message.';

CREATE OR REPLACE FUNCTION public.is_deal_conversation_participant(_conv uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT _user IS NOT NULL
    AND _user = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversations conversation
      JOIN public.deals deal ON deal.id = conversation.deal_id
      JOIN public.organization_memberships membership
        ON membership.organization_id IN (
          deal.buyer_organization_id,
          deal.supplier_organization_id
        )
       AND membership.user_id = _user
       AND membership.status = 'active'
      JOIN public.organizations organization
        ON organization.id = membership.organization_id
       AND organization.status = 'active'
       AND organization.archived_at IS NULL
      WHERE conversation.id = _conv
        AND conversation.deal_id IS NOT NULL
    )
$$;

CREATE OR REPLACE FUNCTION public.restrict_conversation_participant_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.rfq_id IS DISTINCT FROM OLD.rfq_id
     OR NEW.quote_id IS DISTINCT FROM OLD.quote_id
     OR NEW.hotel_id IS DISTINCT FROM OLD.hotel_id
     OR NEW.organizer_id IS DISTINCT FROM OLD.organizer_id
     OR NEW.hotel_owner_id IS DISTINCT FROM OLD.hotel_owner_id
     OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Participants may only update read-tracking fields on conversations';
  END IF;

  IF pg_trigger_depth() <= 1
     AND (
       NEW.last_message_at IS DISTINCT FROM OLD.last_message_at
       OR NEW.last_message_preview IS DISTINCT FROM OLD.last_message_preview
     ) THEN
    RAISE EXCEPTION 'last_message fields are managed by the system';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_deal_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _conversation public.conversations%ROWTYPE;
  _deal public.deals%ROWTYPE;
  _membership_role public.organization_membership_role;
  _old_deal_id uuid;
BEGIN
  SELECT conversation.*
  INTO _conversation
  FROM public.conversations conversation
  WHERE conversation.id = NEW.conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Conversation is unavailable';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT conversation.deal_id
    INTO _old_deal_id
    FROM public.conversations conversation
    WHERE conversation.id = OLD.conversation_id;

    IF _old_deal_id IS NOT NULL OR _conversation.deal_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Deal messages are immutable';
    END IF;
  END IF;

  IF _conversation.deal_id IS NULL THEN
    IF NEW.sender_organization_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Legacy messages cannot use Deal authority';
    END IF;
    RETURN NEW;
  END IF;

  SELECT deal.*
  INTO _deal
  FROM public.deals deal
  WHERE deal.id = _conversation.deal_id;

  IF NEW.sender_organization_id IS NULL
     OR NEW.sender_organization_id NOT IN (
       _deal.buyer_organization_id,
       _deal.supplier_organization_id
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal Chat action is not available';
  END IF;

  SELECT membership.membership_role
  INTO _membership_role
  FROM public.organization_memberships membership
  JOIN public.organizations organization
    ON organization.id = membership.organization_id
   AND organization.status = 'active'
   AND organization.archived_at IS NULL
  WHERE membership.organization_id = NEW.sender_organization_id
    AND membership.user_id = NEW.sender_id
    AND membership.status = 'active';

  IF _membership_role IS NULL
     OR (
       NEW.sender_organization_id = _deal.buyer_organization_id
       AND _membership_role NOT IN ('owner', 'admin', 'agent')
     )
     OR (
       NEW.sender_organization_id = _deal.supplier_organization_id
       AND _membership_role NOT IN ('owner', 'admin', 'sales', 'reservations')
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal Chat action is not available';
  END IF;

  IF _deal.status NOT IN ('active', 'agreed') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Deal Chat is read-only';
  END IF;

  NEW.body := btrim(NEW.body);
  NEW.attachments := '[]'::jsonb;

  IF char_length(NEW.body) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Message must contain 1 to 4000 characters';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_deal_chat_message ON public.chat_messages;
CREATE TRIGGER trg_validate_deal_chat_message
BEFORE INSERT OR UPDATE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.validate_deal_chat_message();

DROP POLICY IF EXISTS "Participants can send messages" ON public.chat_messages;
CREATE POLICY "Participants can send messages"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND sender_organization_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.conversations conversation
    WHERE conversation.id = chat_messages.conversation_id
      AND conversation.deal_id IS NULL
  )
  AND public.is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Deal participants and platform admins view Deal conversations"
ON public.conversations FOR SELECT TO authenticated
USING (
  deal_id IS NOT NULL
  AND (
    public.is_deal_conversation_participant(id, auth.uid())
    OR public.is_enterprise_admin(auth.uid())
  )
);

CREATE POLICY "Deal participants and platform admins view Deal chat messages"
ON public.chat_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversations conversation
    WHERE conversation.id = chat_messages.conversation_id
      AND conversation.deal_id IS NOT NULL
      AND (
        public.is_deal_conversation_participant(conversation.id, auth.uid())
        OR public.is_enterprise_admin(auth.uid())
      )
  )
);

CREATE OR REPLACE FUNCTION public.ensure_deal_conversation(_deal_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _deal public.deals%ROWTYPE;
  _conversation_id uuid;
  _active_sides integer;
  _created boolean := false;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal Chat is not available';
  END IF;

  SELECT deal.*
  INTO _deal
  FROM public.deals deal
  WHERE deal.id = _deal_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal Chat is not available';
  END IF;

  SELECT count(*)
  INTO _active_sides
  FROM public.organization_memberships membership
  JOIN public.organizations organization
    ON organization.id = membership.organization_id
   AND organization.status = 'active'
   AND organization.archived_at IS NULL
  WHERE membership.user_id = _actor_id
    AND membership.status = 'active'
    AND membership.organization_id IN (
      _deal.buyer_organization_id,
      _deal.supplier_organization_id
    );

  IF _active_sides <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal Chat is not available';
  END IF;

  SELECT conversation.id
  INTO _conversation_id
  FROM public.conversations conversation
  WHERE conversation.deal_id = _deal.id;

  IF _conversation_id IS NOT NULL THEN
    RETURN _conversation_id;
  END IF;

  IF _deal.status NOT IN ('active', 'agreed') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Deal Chat is read-only';
  END IF;

  INSERT INTO public.conversations (deal_id, last_message_preview)
  VALUES (_deal.id, NULL)
  ON CONFLICT (deal_id) DO NOTHING
  RETURNING id INTO _conversation_id;

  IF _conversation_id IS NOT NULL THEN
    _created := true;
  ELSE
    SELECT conversation.id
    INTO _conversation_id
    FROM public.conversations conversation
    WHERE conversation.deal_id = _deal.id;
  END IF;

  IF _conversation_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Deal Chat changed concurrently';
  END IF;

  IF _created THEN
    INSERT INTO public.admin_audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      new_state,
      metadata
    ) VALUES (
      _actor_id,
      'deal_chat.conversation_created',
      'conversation',
      _conversation_id::text,
      jsonb_build_object('status', 'open'),
      jsonb_build_object('source', 'private_deal_chat', 'deal_id', _deal.id)
    );
  END IF;

  RETURN _conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_deal_message(
  _conversation_id uuid,
  _sender_organization_id uuid,
  _body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _conversation public.conversations%ROWTYPE;
  _deal public.deals%ROWTYPE;
  _membership_role public.organization_membership_role;
  _active_sides integer;
  _body_normalized text := btrim(COALESCE(_body, ''));
  _message public.chat_messages%ROWTYPE;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal Chat action is not available';
  END IF;

  SELECT conversation.*
  INTO _conversation
  FROM public.conversations conversation
  WHERE conversation.id = _conversation_id
    AND conversation.deal_id IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal Chat action is not available';
  END IF;

  SELECT deal.*
  INTO _deal
  FROM public.deals deal
  WHERE deal.id = _conversation.deal_id
  FOR SHARE;

  SELECT count(*)
  INTO _active_sides
  FROM public.organization_memberships membership
  JOIN public.organizations organization
    ON organization.id = membership.organization_id
   AND organization.status = 'active'
   AND organization.archived_at IS NULL
  WHERE membership.user_id = _actor_id
    AND membership.status = 'active'
    AND membership.organization_id IN (
      _deal.buyer_organization_id,
      _deal.supplier_organization_id
    );

  SELECT membership.membership_role
  INTO _membership_role
  FROM public.organization_memberships membership
  WHERE membership.user_id = _actor_id
    AND membership.organization_id = _sender_organization_id
    AND membership.status = 'active';

  IF _active_sides <> 1
     OR _sender_organization_id NOT IN (
       _deal.buyer_organization_id,
       _deal.supplier_organization_id
     )
     OR _membership_role IS NULL
     OR (
       _sender_organization_id = _deal.buyer_organization_id
       AND _membership_role NOT IN ('owner', 'admin', 'agent')
     )
     OR (
       _sender_organization_id = _deal.supplier_organization_id
       AND _membership_role NOT IN ('owner', 'admin', 'sales', 'reservations')
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Deal Chat action is not available';
  END IF;

  IF _deal.status NOT IN ('active', 'agreed') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Deal Chat is read-only';
  END IF;

  IF char_length(_body_normalized) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Message must contain 1 to 4000 characters';
  END IF;

  INSERT INTO public.chat_messages (
    conversation_id,
    sender_id,
    sender_organization_id,
    body,
    attachments
  ) VALUES (
    _conversation.id,
    _actor_id,
    _sender_organization_id,
    _body_normalized,
    '[]'::jsonb
  )
  RETURNING * INTO _message;

  RETURN jsonb_build_object(
    'id', _message.id,
    'conversation_id', _message.conversation_id,
    'created_at', _message.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_deal_chat_message()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_deal_chat_message()
  TO service_role;

REVOKE ALL ON FUNCTION public.is_deal_conversation_participant(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_deal_conversation_participant(uuid, uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.ensure_deal_conversation(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_deal_message(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_deal_conversation(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_deal_message(uuid, uuid, text)
  TO authenticated;

DO $$
DECLARE
  _rls_enabled boolean;
BEGIN
  SELECT relation.relrowsecurity
  INTO _rls_enabled
  FROM pg_class relation
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public' AND relation.relname = 'conversations';
  IF _rls_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Conversation RLS is not enabled';
  END IF;

  SELECT relation.relrowsecurity
  INTO _rls_enabled
  FROM pg_class relation
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public' AND relation.relname = 'chat_messages';
  IF _rls_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Chat message RLS is not enabled';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.conversations conversation
    WHERE conversation.deal_id IS NULL
      AND (
        conversation.rfq_id IS NULL
        OR conversation.hotel_id IS NULL
        OR conversation.organizer_id IS NULL
        OR conversation.hotel_owner_id IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'Legacy conversation context changed during Deal Chat migration';
  END IF;
END;
$$;

COMMIT;
