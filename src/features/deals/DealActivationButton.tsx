import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Handshake, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { dealActivationEnabled } from "@/features/deals/deal-activation-config";
import {
  ensureDealForInvitation,
  negotiationListQueryRoot,
} from "@/features/deals/deal-activation-service";
import { classifyDealWorkspaceError } from "@/features/deals/deal-workspace-model";

export function DealActivationButton({
  invitationId,
  dealId,
  label = dealId ? "open" : "start",
  size = "sm",
  onActivated,
}: {
  invitationId: string;
  dealId?: string | null;
  label?: "start" | "open" | "continue" | "review";
  size?: "sm" | "default";
  onActivated?: () => void;
}) {
  const { t } = useTranslation("deals");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const activation = useMutation({
    mutationFn: () => ensureDealForInvitation(invitationId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: negotiationListQueryRoot });
      onActivated?.();
      toast.success(
        t(result.created ? "activation.feedback.created" : "activation.feedback.opened"),
      );
      await navigate({ to: "/deals/$dealId", params: { dealId: result.dealId } });
    },
    onError: (error) => {
      const kind = classifyDealWorkspaceError(error);
      toast.error(t(`activation.errors.${kind}`));
    },
  });

  if (!dealActivationEnabled) return null;

  if (dealId) {
    return (
      <Button asChild size={size} variant="gold" className="min-h-11">
        <Link to="/deals/$dealId" params={{ dealId }}>
          <Handshake className="h-4 w-4" aria-hidden="true" />
          {t(`activation.actions.${label}`)}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      variant="gold"
      className="min-h-11"
      disabled={activation.isPending}
      onClick={() => activation.mutate()}
    >
      {activation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <Handshake className="h-4 w-4" aria-hidden="true" />
      )}
      {activation.isPending ? t("activation.actions.opening") : t(`activation.actions.${label}`)}
    </Button>
  );
}
