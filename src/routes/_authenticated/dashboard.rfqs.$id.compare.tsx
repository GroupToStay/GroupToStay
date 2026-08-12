"use client";

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GitCompare, Star } from "lucide-react";
import { toast } from "sonner";
import { useApplicationLocale } from "@/lib/application-locale";
import i18n from "@/lib/i18n";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";

export const Route = createFileRoute("/_authenticated/dashboard/rfqs/$id/compare")({
  head: () => ({ meta: [{ title: i18n.t("dashboard.compare.metaTitle") }] }),
  component: Page,
});

export function Page() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { formatDateTime, formatNumber } = useApplicationLocale();

  const { data, isLoading } = useQuery({
    queryKey: ["rfq-compare", id],
    enabled: !!user,
    queryFn: async () => {
      const { data: rfq } = await supabase.from("rfqs").select("*").eq("id", id).maybeSingle();
      if (!rfq) return null;
      const { data: quotes } = await supabase
        .from("quotes")
        .select("*, hotels(name, city, country, star_rating)")
        .eq("rfq_id", id)
        .order("total_price", { ascending: true });
      return { rfq, quotes: quotes ?? [] };
    },
  });

  const award = useMutation({
    mutationFn: async (q: any) => {
      const { error } = await supabase.rpc("award_quote", {
        _rfq_id: id,
        _quote_id: q.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("dashboard.acceptedToast"));
      qc.invalidateQueries({ queryKey: ["rfq-compare", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!data) throw notFound();
  const { rfq, quotes } = data;
  const isLocked = !["open", "quoting", "under_review"].includes(rfq.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.compare.title")}
        icon={GitCompare}
        eyebrow={
          <Link
            to="/dashboard/rfqs/$id"
            params={{ id }}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> {rfq.title}
          </Link>
        }
        meta={<StatusBadge status={rfq.status} />}
      />

      {quotes.length === 0 ? (
        <EmptyState icon={GitCompare} title={t("dashboard.compare.noQuotes")} />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="bg-muted/50">
                <tr className="text-start">
                  {[
                    t("dashboard.compare.hotel"),
                    t("dashboard.compare.rating"),
                    t("dashboard.compare.location"),
                    t("dashboard.compare.pricePerRoom"),
                    t("dashboard.compare.totalPrice"),
                    t("dashboard.compare.mealPlan"),
                    t("dashboard.compare.services"),
                    t("dashboard.compare.responseTime"),
                    t("dashboard.compare.action"),
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3 text-start font-medium text-muted-foreground border-b border-border"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotes.map((q: any) => (
                  <tr key={q.id} className="hover:bg-muted/30">
                    <td className="px-3 py-3 border-b border-border">
                      <div className="font-medium">{q.hotels?.name ?? t("role.hotel")}</div>
                      <StatusBadge status={q.status} className="mt-1" />
                    </td>
                    <td className="px-3 py-3 border-b border-border">
                      <span className="inline-flex text-gold">
                        {Array.from({ length: q.hotels?.star_rating ?? 0 }).map((_, i) => (
                          <Star key={i} className="h-3.5 w-3.5 fill-current" />
                        ))}
                      </span>
                    </td>
                    <td className="px-3 py-3 border-b border-border">
                      {q.hotels?.city}, {q.hotels?.country}
                    </td>
                    <td className="px-3 py-3 border-b border-border">
                      {q.price_per_room_night
                        ? `${q.currency} ${formatNumber(q.price_per_room_night)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-3 border-b border-border font-display text-base">
                      {q.currency} {formatNumber(q.total_price)}
                    </td>
                    <td className="px-3 py-3 border-b border-border">
                      {q.board_included ? t(`rfq.boards.${q.board_included}`) : "—"}
                    </td>
                    <td className="px-3 py-3 border-b border-border max-w-[280px]">
                      <div className="line-clamp-3 text-muted-foreground">{q.notes || "—"}</div>
                    </td>
                    <td className="px-3 py-3 border-b border-border text-muted-foreground">
                      {q.created_at ? formatDateTime(q.created_at) : "—"}
                    </td>
                    <td className="px-3 py-3 border-b border-border">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isLocked || award.isPending || q.status === "accepted"}
                        onClick={() => award.mutate(q)}
                      >
                        {q.status === "accepted"
                          ? t("dashboard.status.accepted")
                          : t("dashboard.compare.selectWinner")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
