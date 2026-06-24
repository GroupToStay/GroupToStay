import { createFileRoute, redirect, Link } from "@tanstack/react-router";
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
import { ShieldCheck, Building2, CheckCircle2, XCircle, Eye, RotateCcw, Lock, Mail } from "lucide-react";

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

type Tab = "companies" | "hotels" | "interest";

function Page() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("companies");

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-primary flex items-center gap-2"><ShieldCheck className="h-7 w-7" /> {t("admin.title")}</h1>
      <div className="flex gap-2 flex-wrap">
        <Button variant={tab === "companies" ? "gold" : "outline"} size="sm" onClick={() => setTab("companies")}>{t("admin.tabs.companies")}</Button>
        <Button variant={tab === "hotels" ? "gold" : "outline"} size="sm" onClick={() => setTab("hotels")}>{t("admin.tabs.hotels")}</Button>
        <Button variant={tab === "interest" ? "gold" : "outline"} size="sm" onClick={() => setTab("interest")}>Subscription Interest</Button>
      </div>
      {tab === "companies" && <CompaniesPanel />}
      {tab === "hotels" && <HotelsPanel />}
      {tab === "interest" && <InterestPanel />}
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
        .select("id, full_name, company_name, vat_number, cr_number, contact_email, phone, country, hotel_approval_status, approval_notes, created_at, pms_enabled, pms_provider, pms_provider_other, api_available, technical_contact_name, technical_contact_email, technical_contact_phone")
        .eq("hotel_approval_status", status)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });


  const decide = useMutation({
    mutationFn: async ({ id, decision, notes }: { id: string; decision: "approved" | "rejected" | "pending"; notes: string }) => {
      const { error } = await supabase.from("profiles").update({
        hotel_approval_status: decision,
        approval_notes: notes || null,
        approved_at: decision === "approved" ? new Date().toISOString() : null,
        approved_by: decision === "approved" ? (user?.id ?? null) : null,
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

function CompanyRow({ row, onDecide }: { row: any; onDecide: (decision: "approved" | "rejected" | "pending", notes: string) => void }) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<string>(row.approval_notes ?? "");
  const locked = row.hotel_approval_status === "approved";
  const rejected = row.hotel_approval_status === "rejected";

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
        <Badge className={locked ? "bg-success/15 text-success" : rejected ? "bg-error/15 text-error" : ""}>
          {t(`hotelDash.companyStatus.${row.hotel_approval_status}`)}
        </Badge>
      </div>
      <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">{t("auth.vatNumber")}:</span> <span className="font-mono">{row.vat_number ?? "—"}</span></div>
        <div><span className="text-muted-foreground">{t("auth.crNumber")}:</span> <span className="font-mono">{row.cr_number ?? "—"}</span></div>
      </div>
      <div className="mt-3">
        <Textarea rows={2} placeholder={t("admin.notesPh")} value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} disabled={locked} />
      </div>
      <div className="mt-3 flex gap-2 flex-wrap">
        {locked ? (
          <Badge className="bg-muted text-muted-foreground"><Lock className="h-3 w-3 mr-1" /> Approved — locked</Badge>
        ) : rejected ? (
          <Button size="sm" variant="outline" onClick={() => onDecide("pending", notes)}>
            <RotateCcw className="h-4 w-4" /> Reconsider
          </Button>
        ) : (
          <>
            <Button size="sm" variant="gold" onClick={() => onDecide("approved", notes)}><CheckCircle2 className="h-4 w-4" /> {t("admin.approve")}</Button>
            <Button size="sm" variant="destructive" onClick={() => onDecide("rejected", notes)}><XCircle className="h-4 w-4" /> {t("admin.reject")}</Button>
          </>
        )}
      </div>
    </CardContent></Card>
  );
}

function HotelsPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "approved" | "suspended">("pending");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-hotels", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotels")
        .select("id, name, city, country, star_rating, status, cover_image, description, created_at, archived, owner_id")
        .eq("status", status)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatusFor = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: "approved" | "suspended" }) => {
      const patch: any = { status: next };
      if (next === "suspended") {
        patch.archived = true;
        patch.owner_id = null;
      }
      const { error } = await supabase.from("hotels").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("admin.decisionSaved")); qc.invalidateQueries({ queryKey: ["admin-hotels"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["pending", "approved", "suspended"] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-md border px-3 py-1 text-xs ${status === s ? "border-gold bg-gold/10 text-foreground" : "border-input text-muted-foreground"}`}>
            {t(`hotelDash.statuses.${s}`)}
          </button>
        ))}
      </div>
      {isLoading ? <div className="text-muted-foreground">{t("common.loading")}</div> :
       rows.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("admin.empty")}</CardContent></Card> :
       rows.map((h: any) => {
        const isApproved = h.status === "approved";
        const isSuspended = h.status === "suspended";
        return (
          <Card key={h.id}><CardContent className="p-5 flex items-center gap-4 flex-wrap">
            {h.cover_image && <img src={h.cover_image} alt="" className="h-16 w-24 rounded object-cover border border-border" />}
            <div className="flex-1 min-w-[180px]">
              <div className="font-display text-lg text-primary flex items-center gap-2"><Building2 className="h-4 w-4" /> {h.name}</div>
              <div className="text-xs text-muted-foreground">{h.city}, {h.country} · {h.star_rating}★</div>
              {h.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{h.description}</div>}
            </div>
            <Badge className={isApproved ? "bg-success/15 text-success" : isSuspended ? "bg-error/15 text-error" : ""}>
              {t(`hotelDash.statuses.${h.status}`)}
            </Badge>
            <div className="flex gap-2 flex-wrap">
              <Button asChild size="sm" variant="outline">
                <Link to="/hotels/$id" params={{ id: h.id }} target="_blank"><Eye className="h-4 w-4" /> View Hotel</Link>
              </Button>
              {isApproved ? (
                <Badge className="bg-muted text-muted-foreground"><Lock className="h-3 w-3 mr-1" /> Locked</Badge>
              ) : isSuspended ? (
                <Badge className="bg-muted text-muted-foreground">Final — archived</Badge>
              ) : (
                <>
                  <Button size="sm" variant="gold" onClick={() => setStatusFor.mutate({ id: h.id, next: "approved" })}>{t("admin.approve")}</Button>
                  <Button size="sm" variant="destructive" onClick={() => setStatusFor.mutate({ id: h.id, next: "suspended" })}>{t("admin.suspend")}</Button>
                </>
              )}
            </div>
          </CardContent></Card>
        );
      })}
    </div>
  );
}

function InterestPanel() {
  const qc = useQueryClient();
  const [planFilter, setPlanFilter] = useState<"all" | "professional" | "featured">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "waiting" | "notified">("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-interest", planFilter, statusFilter],
    queryFn: async () => {
      let q = supabase.from("subscription_interest")
        .select("*").order("created_at", { ascending: false });
      if (planFilter !== "all") q = q.eq("requested_plan", planFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const mark = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscription_interest").update({
        status: "notified", notified_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marked as notified"); qc.invalidateQueries({ queryKey: ["admin-interest"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap text-xs">
        <span className="text-muted-foreground self-center">Plan:</span>
        {(["all","professional","featured"] as const).map(p => (
          <button key={p} onClick={() => setPlanFilter(p)}
            className={`rounded-md border px-3 py-1 capitalize ${planFilter === p ? "border-gold bg-gold/10" : "border-input text-muted-foreground"}`}>{p}</button>
        ))}
        <span className="text-muted-foreground self-center ml-3">Status:</span>
        {(["all","waiting","notified"] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-md border px-3 py-1 capitalize ${statusFilter === s ? "border-gold bg-gold/10" : "border-input text-muted-foreground"}`}>{s}</button>
        ))}
      </div>
      {isLoading ? <div className="text-muted-foreground">Loading…</div> :
       rows.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">No waitlist entries.</CardContent></Card> :
       rows.map((r: any) => (
        <Card key={r.id}><CardContent className="p-5 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="font-medium">{r.full_name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {r.email}</div>
            {r.hotel_name && <div className="text-xs text-muted-foreground">Hotel: {r.hotel_name}</div>}
            <div className="text-xs text-muted-foreground">Registered: {new Date(r.created_at).toLocaleString()}</div>
          </div>
          <Badge className="capitalize">{r.requested_plan}</Badge>
          <Badge className={r.status === "notified" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}>{r.status}</Badge>
          {r.status === "waiting" && (
            <Button size="sm" variant="gold" onClick={() => mark.mutate(r.id)}>Mark as Notified</Button>
          )}
        </CardContent></Card>
      ))}
    </div>
  );
}
