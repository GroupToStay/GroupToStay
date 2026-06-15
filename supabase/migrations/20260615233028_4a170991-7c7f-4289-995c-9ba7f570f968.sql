
-- ============ CONVERSATIONS ============
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  organizer_id uuid NOT NULL,
  hotel_owner_id uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, hotel_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_conversations_org ON public.conversations(organizer_id, last_message_at DESC);
CREATE INDEX idx_conversations_hotel_owner ON public.conversations(hotel_owner_id, last_message_at DESC);
CREATE INDEX idx_conversations_rfq ON public.conversations(rfq_id);

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PARTICIPANTS ============
CREATE TABLE public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('organizer','hotel')),
  last_read_at timestamptz NOT NULL DEFAULT 'epoch',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_cp_user ON public.conversation_participants(user_id);
CREATE INDEX idx_cp_conv ON public.conversation_participants(conversation_id);

-- ============ CHAT MESSAGES ============
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_chat_messages_conv ON public.chat_messages(conversation_id, created_at);

-- ============ HELPER ============
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = _conv AND user_id = _user)
$$;

-- ============ POLICIES ============
CREATE POLICY "Participants can view their conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (auth.uid() = organizer_id OR auth.uid() = hotel_owner_id);

CREATE POLICY "Participants can update last_read indirectly" ON public.conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = organizer_id OR auth.uid() = hotel_owner_id);

CREATE POLICY "Participants can view their participation" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Participants can update their own last_read" ON public.conversation_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Participants can view chat messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Participants can send messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

-- ============ AUTO-CREATE CONVERSATION ON QUOTE ============
CREATE OR REPLACE FUNCTION public.create_conversation_for_quote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _organizer_id uuid;
  _hotel_owner uuid;
  _conv_id uuid;
BEGIN
  SELECT organizer_id INTO _organizer_id FROM public.rfqs WHERE id = NEW.rfq_id;
  SELECT owner_id INTO _hotel_owner FROM public.hotels WHERE id = NEW.hotel_id;

  IF _organizer_id IS NULL OR _hotel_owner IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.conversations (rfq_id, quote_id, hotel_id, organizer_id, hotel_owner_id, last_message_preview)
  VALUES (NEW.rfq_id, NEW.id, NEW.hotel_id, _organizer_id, _hotel_owner, 'Quote submitted')
  ON CONFLICT (rfq_id, hotel_id) DO UPDATE SET quote_id = EXCLUDED.quote_id, updated_at = now()
  RETURNING id INTO _conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id, role)
  VALUES (_conv_id, _organizer_id, 'organizer'), (_conv_id, _hotel_owner, 'hotel')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_quote_create_conversation
AFTER INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.create_conversation_for_quote();

-- ============ BUMP LAST MESSAGE ============
CREATE OR REPLACE FUNCTION public.bump_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = COALESCE(NULLIF(LEFT(NEW.body, 120), ''), '📎 Attachment')
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_chat_bump_conv
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message();

-- ============ BACKFILL FROM EXISTING QUOTES ============
INSERT INTO public.conversations (rfq_id, quote_id, hotel_id, organizer_id, hotel_owner_id, last_message_preview)
SELECT q.rfq_id, q.id, q.hotel_id, r.organizer_id, h.owner_id, 'Quote submitted'
FROM public.quotes q
JOIN public.rfqs r ON r.id = q.rfq_id
JOIN public.hotels h ON h.id = q.hotel_id
WHERE h.owner_id IS NOT NULL
ON CONFLICT (rfq_id, hotel_id) DO NOTHING;

INSERT INTO public.conversation_participants (conversation_id, user_id, role)
SELECT c.id, c.organizer_id, 'organizer' FROM public.conversations c
ON CONFLICT DO NOTHING;
INSERT INTO public.conversation_participants (conversation_id, user_id, role)
SELECT c.id, c.hotel_owner_id, 'hotel' FROM public.conversations c
ON CONFLICT DO NOTHING;

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
