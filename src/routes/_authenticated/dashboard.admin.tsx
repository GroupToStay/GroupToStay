import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ShieldCheck, Building2, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/admin")({
  head: () => ({ meta: [{ title: "Admin — GroupToStay" }] }),
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"companies" | "hotels">("companies");

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-primary flex items-center gap-2"><ShieldCheck className="h-7 w-7" /> {t("admin.title")}</h1>
      <div className="flex gap-2">
        <Button variant={tab === "companies" ? "gold" : "outline"} size="sm" onClick={() => setTab("companies")}>{t("admin.tabs.companies")}</Button>
        <Button variant={tab === "hotels" ? "gold" : "outline"} size="sm" onClick={() => setTab("hotels")}>{t("admin.tabs.hotels")}</Button>
      </div>
      {tab === "companies" ? <CompaniesPanel /> : <HotelsPanel />}
    </div>
  );
}

function CompaniesPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-companies", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, company_name, vat_number, cr_number, contact_email, phone, country, hotel_approval_status, approval_notes, created_at")
        .eq("hotel_approval_status", status)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, decision, notes }: { id: string; decision: "approved" | "rejected"; notes: string }) => {
      const { error } = await supabase.from("profiles").update({
        hotel_approval_status: decision,
        approval_notes: notes || null,
        approved_at: new Date().toISOString(),
        approved_by: user?.id ?? null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.decisionSaved"));
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["pending", "approved", "rejected"] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-md border px-3 py-1 text-xs ${status === s ? "border-gold bg-gold/10 text-foreground" : "border-input text-muted-foreground"}`}>
            {t(`hotelDash.companyStatus.${s}`)}
          </button>
        ))}
      </div>
      {isLoading ? <div className="text-muted-foreground">{t("common.loading")}</div> :
       rows.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("admin.empty")}</CardContent></Card> :
       rows.map((r: any) => (
        <CompanyRow key={r.id} row={r} onDecide={(decision, notes) => decide.mutate({ id: r.id, decision, notes })} />
      ))}
    </div>
  );
}

function CompanyRow({ row, onDecide }: { row: any; onDecide: (decision: "approved" | "rejected", notes: string) => void }) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<string>(row.approval_notes ?? "");
  return (
    <Card><CardContent className="p-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-lg text-primary">{row.company_name ?? "—"}</span>
            <Badge variant="outline">{row.full_name}</Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{row.contact_email ?? "—"} · {row.phone ?? "—"} · {row.country ?? "—"}</div>
        </div>
        <Badge>{t(`hotelDash.companyStatus.${row.hotel_approval_status}`)}</Badge>
      </div>
      <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">{t("auth.vatNumber")}:</span> <span className="font-mono">{row.vat_number ?? "—"}</span></div>
        <div><span className="text-muted-foreground">{t("auth.crNumber")}:</span> <span className="font-mono">{row.cr_number ?? "—"}</span></div>
      </div>
      <div className="mt-3">
        <Textarea rows={2} placeholder={t("admin.notesPh")} value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} />
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="gold" onClick={() => onDecide("approved", notes)}><CheckCircle2 className="h-4 w-4" /> {t("admin.approve")}</Button>
        <Button size="sm" variant="destructive" onClick={() => onDecide("rejected", notes)}><XCircle className="h-4 w-4" /> {t("admin.reject")}</Button>
      </div>
    </CardContent></Card>
  );
}

function HotelsPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-hotels", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotels")
        .select("id, name, city, country, star_rating, status, cover_image, created_at")
        .eq("status", status)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatusFor = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: "approved" | "rejected" | "pending" }) => {
      const { error } = await supabase.from("hotels").update({ status: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("admin.decisionSaved")); qc.invalidateQueries({ queryKey: ["admin-hotels"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["pending", "approved", "rejected"] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-md border px-3 py-1 text-xs ${status === s ? "border-gold bg-gold/10 text-foreground" : "border-input text-muted-foreground"}`}>
            {t(`hotelDash.statuses.${s}`)}
          </button>
        ))}
      </div>
      {isLoading ? <div className="text-muted-foreground">{t("common.loading")}</div> :
       rows.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("admin.empty")}</CardContent></Card> :
       rows.map((h: any) => (
        <Card key={h.id}><CardContent className="p-5 flex items-center gap-4 flex-wrap">
          {h.cover_image && <img src={h.cover_image} alt="" className="h-16 w-24 rounded object-cover border border-border" />}
          <div className="flex-1 min-w-[180px]">
            <div className="font-display text-lg text-primary flex items-center gap-2"><Building2 className="h-4 w-4" /> {h.name}</div>
            <div className="text-xs text-muted-foreground">{h.city}, {h.country} · {h.star_rating}★</div>
          </div>
          <Badge>{t(`hotelDash.statuses.${h.status}`)}</Badge>
          <div className="flex gap-2">
            <Button size="sm" variant="gold" onClick={() => setStatusFor.mutate({ id: h.id, next: "approved" })}>{t("admin.approve")}</Button>
            <Button size="sm" variant="destructive" onClick={() => setStatusFor.mutate({ id: h.id, next: "rejected" })}>{t("admin.reject")}</Button>
          </div>
        </CardContent></Card>
      ))}
    </div>
  );
}
