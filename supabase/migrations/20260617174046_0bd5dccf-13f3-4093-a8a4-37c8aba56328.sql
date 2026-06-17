
-- 1) Hotel photos: remove bypassable 'prefer' header check; keep public read.
DROP POLICY IF EXISTS "Hotel photos public read" ON storage.objects;
CREATE POLICY "Hotel photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hotel-photos');

-- 2) Chat attachments: add UPDATE policy scoped to conversation participants.
DROP POLICY IF EXISTS "Participants can update their chat attachments" ON storage.objects;
CREATE POLICY "Participants can update their chat attachments"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'chat-attachments'
    AND owner = auth.uid()
    AND public.is_conversation_participant(((storage.foldername(name))[1])::uuid, auth.uid())
  )
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND owner = auth.uid()
    AND public.is_conversation_participant(((storage.foldername(name))[1])::uuid, auth.uid())
  );

-- 3) Realtime: restrict broadcast subscriptions to conversation participants.
--    Drop any existing permissive policies first.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='realtime' AND tablename='messages'
  LOOP
    EXECUTE format('DROP POLICY %I ON realtime.messages', p.policyname);
  END LOOP;
END $$;

-- Authenticated users may only subscribe to topics that match a conversation
-- they participate in. Topic convention: 'conversation:<conversation_id>'.
CREATE POLICY "Conversation participants can read realtime messages"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN realtime.topic() LIKE 'conversation:%'
        THEN public.is_conversation_participant(
          substring(realtime.topic() FROM 'conversation:(.*)')::uuid,
          auth.uid()
        )
      ELSE false
    END
  );
