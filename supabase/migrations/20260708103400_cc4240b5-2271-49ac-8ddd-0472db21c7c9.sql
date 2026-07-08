-- Defense-in-depth: revoke UPDATE privileges on sensitive profile columns from authenticated role.
-- Triggers still enforce the same rules; this adds a hard column-level guarantee at the RLS/grants layer.

REVOKE UPDATE (
  account_status,
  agency_verification_status,
  verification_reviewed_at,
  verification_reviewed_by,
  verification_rejection_reason,
  verification_trust_level,
  approved_by,
  approved_at,
  approval_notes,
  hotel_approval_status
) ON public.profiles FROM authenticated;

-- Ensure service_role retains full access for admin operations via edge/server functions.
GRANT ALL ON public.profiles TO service_role;