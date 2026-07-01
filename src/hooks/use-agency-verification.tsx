import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type AgencyVerificationStatus = "draft" | "submitted" | "pending_review" | "verified" | "rejected";

export function useAgencyVerification() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["agency-verification", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("agency_verification_status, verification_rejection_reason, verification_submitted_at, verification_reviewed_at, verification_trust_level")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const status = (q.data?.agency_verification_status ?? "draft") as AgencyVerificationStatus;
  return {
    status,
    isVerified: status === "verified",
    isPending: status === "submitted" || status === "pending_review",
    isRejected: status === "rejected",
    isDraft: status === "draft",
    rejectionReason: q.data?.verification_rejection_reason ?? null,
    trustLevel: q.data?.verification_trust_level ?? "verified",
    loading: q.isLoading,
    refetch: q.refetch,
  };
}
