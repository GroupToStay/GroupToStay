
CREATE POLICY "Participants can view chat attachments" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND public.is_conversation_participant((storage.foldername(name))[1]::uuid, auth.uid())
);

CREATE POLICY "Participants can upload chat attachments" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND public.is_conversation_participant((storage.foldername(name))[1]::uuid, auth.uid())
);

CREATE POLICY "Participants can delete their chat attachments" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND owner = auth.uid()
);
