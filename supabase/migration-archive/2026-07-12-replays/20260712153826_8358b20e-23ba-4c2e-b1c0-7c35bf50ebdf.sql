
INSERT INTO public.countries (code, name_en, name_ar, is_active) VALUES
  ('MA','Morocco','المغرب',true),
  ('GB','United Kingdom','المملكة المتحدة',true),
  ('US','United States','الولايات المتحدة',true),
  ('FR','France','فرنسا',true),
  ('DE','Germany','ألمانيا',true),
  ('IT','Italy','إيطاليا',true),
  ('ES','Spain','إسبانيا',true),
  ('NL','Netherlands','هولندا',true),
  ('BE','Belgium','بلجيكا',true),
  ('CH','Switzerland','سويسرا',true),
  ('SE','Sweden','السويد',true),
  ('NO','Norway','النرويج',true),
  ('DK','Denmark','الدنمارك',true),
  ('FI','Finland','فنلندا',true),
  ('IE','Ireland','أيرلندا',true),
  ('PT','Portugal','البرتغال',true),
  ('AT','Austria','النمسا',true),
  ('GR','اليونان','اليونان',true),
  ('PL','Poland','بولندا',true),
  ('RU','Russia','روسيا',true),
  ('UA','Ukraine','أوكرانيا',true),
  ('CA','Canada','كندا',true),
  ('MX','Mexico','المكسيك',true),
  ('BR','Brazil','البرازيل',true),
  ('AR','Argentina','الأرجنتين',true),
  ('CL','Chile','تشيلي',true),
  ('CO','Colombia','كولومبيا',true),
  ('CN','China','الصين',true),
  ('JP','Japan','اليابان',true),
  ('KR','South Korea','كوريا الجنوبية',true),
  ('IN','India','الهند',true),
  ('PK','Pakistan','باكستان',true),
  ('BD','Bangladesh','بنغلاديش',true),
  ('ID','Indonesia','إندونيسيا',true),
  ('MY','Malaysia','ماليزيا',true),
  ('SG','Singapore','سنغافورة',true),
  ('TH','Thailand','تايلاند',true),
  ('PH','Philippines','الفلبين',true),
  ('VN','Vietnam','فيتنام',true),
  ('AU','Australia','أستراليا',true),
  ('NZ','New Zealand','نيوزيلندا',true),
  ('ZA','South Africa','جنوب أفريقيا',true),
  ('NG','Nigeria','نيجيريا',true),
  ('KE','Kenya','كينيا',true),
  ('ET','Ethiopia','إثيوبيا',true),
  ('GH','Ghana','غانا',true),
  ('SN','Senegal','السنغال',true),
  ('TN','Tunisia','تونس',true),
  ('DZ','Algeria','الجزائر',true),
  ('LY','Libya','ليبيا',true),
  ('SD','Sudan','السودان',true),
  ('LB','Lebanon','لبنان',true),
  ('SY','Syria','سوريا',true),
  ('IQ','Iraq','العراق',true),
  ('IR','Iran','إيران',true),
  ('TR','Turkey','تركيا',true),
  ('YE','Yemen','اليمن',true),
  ('PS','Palestine','فلسطين',true),
  ('AF','Afghanistan','أفغانستان',true),
  ('AZ','Azerbaijan','أذربيجان',true),
  ('KZ','Kazakhstan','كازاخستان',true),
  ('UZ','Uzbekistan','أوزبكستان',true),
  ('IL','Israel','إسرائيل',true),
  ('CY','Cyprus','قبرص',true),
  ('MT','Malta','مالطا',true),
  ('RO','Romania','رومانيا',true),
  ('CZ','Czech Republic','جمهورية التشيك',true),
  ('HU','Hungary','المجر',true)
ON CONFLICT (code) DO NOTHING;

UPDATE public.countries SET name_en = 'Greece' WHERE code = 'GR';

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['countries','cities','hotel_types','room_types','meal_plans','amenities','organizer_types']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Anyone reads active %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Anyone reads active %1$s" ON public.%1$s FOR SELECT USING (is_active = true)', t);
    EXECUTE format('GRANT SELECT ON public.%1$s TO anon, authenticated', t);
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role public.app_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'organizer');
  _country_id uuid;
  _country_text text := NULLIF(NEW.raw_user_meta_data->>'country_id', '');
BEGIN
  IF _country_text IS NOT NULL THEN
    IF _country_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      _country_id := _country_text::uuid;
    ELSE
      SELECT c.id INTO _country_id
      FROM public.countries c
      WHERE upper(c.code) = upper(_country_text)
         OR lower(c.name_en) = lower(_country_text)
      LIMIT 1;
    END IF;
  END IF;

  INSERT INTO public.profiles (
    id, full_name, org_name, phone, country, locale,
    country_code, phone_number, country_id,
    company_name, vat_number, cr_number, contact_email,
    id_type, id_number, hotel_approval_status
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'org_name',
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'country', (SELECT c.name_en FROM public.countries c WHERE c.id = _country_id), _country_text),
    COALESCE(NEW.raw_user_meta_data->>'locale','en'),
    NEW.raw_user_meta_data->>'country_code',
    NEW.raw_user_meta_data->>'phone_number',
    _country_id,
    NEW.raw_user_meta_data->>'company_name',
    NEW.raw_user_meta_data->>'vat_number',
    NEW.raw_user_meta_data->>'cr_number',
    COALESCE(NEW.raw_user_meta_data->>'contact_email', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'id_type','')::public.id_doc_type,
    NEW.raw_user_meta_data->>'id_number',
    CASE WHEN _role = 'hotel' THEN 'pending'::public.hotel_approval_status ELSE NULL END
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END;
$function$;-- Restrict admin-management policies to authenticated role so anon never evaluates has_role()
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies
           WHERE schemaname='public'
             AND tablename IN ('countries','cities','hotel_types','room_types','meal_plans','amenities','organizer_types')
             AND policyname ILIKE 'Admins manage%'
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Belt-and-suspenders: allow anon/authenticated to execute has_role (security definer, safe)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
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
