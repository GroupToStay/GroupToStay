
CREATE TYPE public.notification_type AS ENUM (
  'rfq_new','rfq_invitation','quote_received','quote_accepted','quote_rejected',
  'message_new','hotel_approved','hotel_rejected','company_approved','company_rejected',
  'subscription_activated','subscription_expiring','rfq_awarded','rfq_closed'
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx ON public.notifications(user_id, read_at, created_at DESC);
CREATE INDEX notifications_user_created_idx ON public.notifications(user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Helper to enqueue a notification (callable from triggers, runs as definer)
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid,
  _type public.notification_type,
  _title text,
  _body text DEFAULT NULL,
  _link text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
  VALUES (_user_id, _type, _title, _body, _link, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Trigger: notify hotel owner when an RFQ invitation is created
CREATE OR REPLACE FUNCTION public.notify_hotel_on_invitation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _owner uuid;
  _title text;
  _rfq_title text;
BEGIN
  SELECT owner_id INTO _owner FROM public.hotels WHERE id = NEW.hotel_id;
  SELECT title INTO _rfq_title FROM public.rfqs WHERE id = NEW.rfq_id;
  IF _owner IS NOT NULL THEN
    PERFORM public.create_notification(
      _owner, 'rfq_invitation', 'New group request available',
      COALESCE(_rfq_title, 'A new group request matches your hotel'),
      '/dashboard/invitations',
      jsonb_build_object('rfq_id', NEW.rfq_id, 'hotel_id', NEW.hotel_id)
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_hotel_on_invitation
AFTER INSERT ON public.rfq_invitations
FOR EACH ROW EXECUTE FUNCTION public.notify_hotel_on_invitation();

-- Trigger: notify organizer when a quote is received
CREATE OR REPLACE FUNCTION public.notify_organizer_on_quote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _org uuid;
  _hotel_name text;
BEGIN
  SELECT organizer_id INTO _org FROM public.rfqs WHERE id = NEW.rfq_id;
  SELECT name INTO _hotel_name FROM public.hotels WHERE id = NEW.hotel_id;
  IF _org IS NOT NULL THEN
    PERFORM public.create_notification(
      _org, 'quote_received', 'New quotation received',
      COALESCE(_hotel_name,'A hotel') || ' submitted a quotation',
      '/dashboard/rfqs/' || NEW.rfq_id::text,
      jsonb_build_object('rfq_id', NEW.rfq_id, 'quote_id', NEW.id, 'hotel_id', NEW.hotel_id)
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_organizer_on_quote
AFTER INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.notify_organizer_on_quote();

-- Trigger: notify hotel when quote status changes (accepted/rejected)
CREATE OR REPLACE FUNCTION public.notify_hotel_on_quote_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('accepted','rejected') THEN
    SELECT owner_id INTO _owner FROM public.hotels WHERE id = NEW.hotel_id;
    IF _owner IS NOT NULL THEN
      PERFORM public.create_notification(
        _owner,
        CASE WHEN NEW.status='accepted' THEN 'quote_accepted'::public.notification_type ELSE 'quote_rejected'::public.notification_type END,
        CASE WHEN NEW.status='accepted' THEN 'Your quotation was accepted' ELSE 'Your quotation was not selected' END,
        NULL,
        '/dashboard/invitations',
        jsonb_build_object('rfq_id', NEW.rfq_id, 'quote_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_hotel_on_quote_status
AFTER UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.notify_hotel_on_quote_status();

-- Trigger: notify hotel owner when hotel approval status changes
CREATE OR REPLACE FUNCTION public.notify_hotel_on_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.owner_id IS NOT NULL THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.create_notification(NEW.owner_id, 'hotel_approved', 'Hotel approved',
        NEW.name || ' is now live on the marketplace', '/dashboard/hotel', jsonb_build_object('hotel_id', NEW.id));
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.create_notification(NEW.owner_id, 'hotel_rejected', 'Hotel rejected',
        'Your hotel submission was rejected', '/dashboard/hotel', jsonb_build_object('hotel_id', NEW.id));
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_hotel_on_status_change
AFTER UPDATE ON public.hotels
FOR EACH ROW EXECUTE FUNCTION public.notify_hotel_on_status_change();

-- Trigger: notify on company approval status change
CREATE OR REPLACE FUNCTION public.notify_company_on_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.hotel_approval_status IS DISTINCT FROM OLD.hotel_approval_status THEN
    IF NEW.hotel_approval_status = 'approved' THEN
      PERFORM public.create_notification(NEW.id, 'company_approved', 'Company approved',
        'Your company has been approved', '/dashboard', '{}'::jsonb);
    ELSIF NEW.hotel_approval_status = 'rejected' THEN
      PERFORM public.create_notification(NEW.id, 'company_rejected', 'Company rejected',
        'Your company submission was rejected', '/dashboard', '{}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_company_on_status_change
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_company_on_status_change();

-- Trigger: notify recipients on new chat message
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id
  LOOP
    PERFORM public.create_notification(
      r.user_id, 'message_new', 'New message',
      COALESCE(NULLIF(LEFT(NEW.body,120),''),'📎 Attachment'),
      '/dashboard/messages/' || NEW.conversation_id::text,
      jsonb_build_object('conversation_id', NEW.conversation_id)
    );
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_on_new_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_message();
