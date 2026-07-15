import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { hasCompleteAgencyVerificationProfile } from "@/lib/agency-verification";

export type AgencyVerificationStatus =
  "draft" | "submitted" | "pending_review" | "verified" | "rejected";

export function useAgencyVerification() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["agency-verification", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "agency_verification_status, verification_rejection_reason, verification_submitted_at, verification_reviewed_at, verification_trust_level, legal_company_name, country_id, city_id, full_address, cr_number, cr_expiry_date, issuing_authority, cr_document_path, contact_person_name, contact_person_position, contact_person_email, contact_person_phone, agency_type, annual_group_bookings, avg_rooms_per_booking, legal_billing_name, vat_billing_number, billing_address, billing_email, legal_agreements_accepted_at",
        )
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const status = (q.data?.agency_verification_status ?? "draft") as AgencyVerificationStatus;
  const isProfileComplete = hasCompleteAgencyVerificationProfile(q.data);
  return {
    status,
    isVerified: status === "verified",
    isProfileComplete,
    canCreateRfq: status === "verified" && isProfileComplete,
    isPending: status === "submitted" || status === "pending_review",
    isRejected: status === "rejected",
    isDraft: status === "draft",
    rejectionReason: q.data?.verification_rejection_reason ?? null,
    trustLevel: q.data?.verification_trust_level ?? "verified",
    loading: q.isLoading,
    refetch: q.refetch,
  };
}
