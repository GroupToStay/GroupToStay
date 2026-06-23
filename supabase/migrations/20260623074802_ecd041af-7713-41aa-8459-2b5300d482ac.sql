
-- Trigger-only / internal SECURITY DEFINER functions: revoke direct EXECUTE from all roles.
-- They continue to run from triggers under the function owner's privileges.
DO $$
DECLARE
  fn text;
  trigger_only text[] := ARRAY[
    'public.handle_new_user()',
    'public.update_updated_at_column()',
    'public.match_hotel_to_rfqs()',
    'public.match_rfq_to_hotels()',
    'public.restrict_organizer_quote_updates()',
    'public.restrict_profile_company_fields()',
    'public.restrict_organizer_booking_updates()',
    'public.prevent_profile_approval_self_update()',
    'public.enforce_admin_exclusive_role()',
    'public.create_conversation_for_quote()',
    'public.bump_conversation_last_message()',
    'public.lock_company_approval()',
    'public.lock_hotel_approval()',
    'public.notify_hotel_on_invitation()',
    'public.notify_organizer_on_quote()',
    'public.notify_hotel_on_quote_status()',
    'public.notify_hotel_on_status_change()',
    'public.notify_company_on_status_change()',
    'public.notify_on_new_message()',
    'public.create_notification(uuid, public.notification_type, text, text, text, jsonb)',
    'public._norm(text)'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_only LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;

-- RLS helper functions: lock down to `authenticated` only (used inside policy expressions).
DO $$
DECLARE
  fn text;
  rls_helpers text[] := ARRAY[
    'public.has_role(uuid, public.app_role)',
    'public.is_rfq_organizer(uuid, uuid)',
    'public.is_hotel_invited_to_rfq(uuid, uuid)',
    'public.is_conversation_participant(uuid, uuid)',
    'public.is_hotel_profile_approved(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY rls_helpers LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
