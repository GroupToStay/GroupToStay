import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { BadgeCheck, ShieldCheck, FileText, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/agency-verifications")({
  head: () => ({ meta: [{ title: "Agency Verifications — Admin" }] }),
  component: Page,
});

type Row = any;

function Page() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<"pending" | "verified" | "rejected" | "all">("pending");
  const [selected, setSelected] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-agency-verifications", tab],
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("*")
        .not("agency_verification_status", "is", null)
        .order("verification_submitted_at", { ascending: false, nullsFirst: false });
      if (tab === "pending") q = q.in("agency_verification_status", ["submitted", "pending_review"]);
      else if (tab === "verified") q = q.eq("agency_verification_status", "verified");
      else if (tab === "rejected") q = q.eq("agency_verification_status", "rejected");
      const { data } = await q;
      // Filter agencies only (client-side; profiles table also contains hotel users)
      if (!data) return [];
      const ids = data.map((d: any) => d.id);
      if (!ids.length) return [];
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", ids);
      const agencyIds = new Set((roles ?? []).filter((r: any) => r.role === "organizer").map((r: any) => r.user_id));
      return data.filter((d: any) => agencyIds.has(d.id));
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["agency-events", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase.from("agency_verification_events").select("*").eq("agency_id", selected!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function getDocUrl(path?: string | null) {
    if (!path) return null;
    const { data } = await supabase.storage.from("agency-documents").createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  }

  async function act(kind: "approve" | "reject" | "info") {
    if (!selected || !user) return;
    if ((kind === "reject" || kind === "info") && !note.trim()) return toast.error("Please write a reason / note");
    setBusy(true);
    try {
      const status = kind === "approve" ? "verified" : kind === "reject" ? "rejected" : "pending_review";
      const patch: any = {
        agency_verification_status: status,
        verification_reviewed_at: new Date().toISOString(),
        verification_reviewed_by: user.id,
      };
      if (kind === "reject" || kind === "info") patch.verification_rejection_reason = note.trim();
      if (kind === "approve") patch.verification_rejection_reason = null;
      const { error } = await supabase.from("profiles").update(patch).eq("id", selected.id);
      if (error) throw error;
      await supabase.from("agency_verification_events").insert({
        agency_id: selected.id,
        event_type: kind === "approve" ? "approved" : kind === "reject" ? "rejected" : "info_requested",
        notes: note.trim() || null,
        actor_id: user.id,
      });
      toast.success(kind === "approve" ? "Agency verified" : kind === "reject" ? "Agency rejected" : "Info requested");
      setSelected(null); setNote("");
      qc.invalidateQueries({ queryKey: ["admin-agency-verifications"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally { setBusy(false); }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2"><BadgeCheck className="h-7 w-7" /> Agency Verifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review submitted agency profiles, open uploaded documents, and approve or reject.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(["pending", "verified", "rejected", "all"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full border px-3 py-1.5 text-sm capitalize ${tab === k ? "border-gold bg-gold/10 text-foreground" : "border-input text-muted-foreground"}`}>
            {k}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No submissions" description="Nothing to review in this tab." />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r: any) => (
                <li key={r.id} className="p-4 flex items-center gap-4 hover:bg-accent/30 cursor-pointer" onClick={() => { setSelected(r); setNote(""); }}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.legal_company_name || r.trade_name || r.company_name || r.org_name || r.full_name || "Untitled agency"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.country ?? ""} • {r.agency_type ?? "—"} • {r.contact_person_email ?? r.contact_email ?? "—"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.verification_submitted_at ? formatDistanceToNow(new Date(r.verification_submitted_at), { addSuffix: true }) : "—"}
                  </div>
                  <StatusBadge status={r.agency_verification_status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.legal_company_name || selected.trade_name || selected.company_name || "Agency"}
                  <StatusBadge status={selected.agency_verification_status} />
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <Group title="Company">
                  <Row2 k="Legal Name" v={selected.legal_company_name} />
                  <Row2 k="Trade Name" v={selected.trade_name} />
                  <Row2 k="Country" v={selected.country} />
                  <Row2 k="Address" v={selected.full_address} />
                  <Row2 k="Website" v={selected.website} />
                  <Row2 k="Year Established" v={selected.year_established} />
                  <Row2 k="Employees" v={selected.employees_count} />
                </Group>
                <Group title="Business Registration">
                  <Row2 k="CR Number" v={selected.cr_number} />
                  <Row2 k="CR Expiry" v={selected.cr_expiry_date} />
                  <Row2 k="Issuing Authority" v={selected.issuing_authority} />
                  <Row2 k="Tourism License" v={selected.tourism_license_number} />
                  <div className="flex flex-wrap gap-2 pt-2">
                    <DocButton label="Commercial Registration" path={selected.cr_document_path} get={getDocUrl} />
                    <DocButton label="Tourism License" path={selected.tourism_license_document_path} get={getDocUrl} />
                  </div>
                </Group>
                <Group title="Contact Person">
                  <Row2 k="Name" v={selected.contact_person_name} />
                  <Row2 k="Position" v={selected.contact_person_position} />
                  <Row2 k="Email" v={selected.contact_person_email} />
                  <Row2 k="Phone" v={selected.contact_person_phone} />
                  <Row2 k="WhatsApp" v={selected.contact_person_whatsapp} />
                </Group>
                <Group title="Business">
                  <Row2 k="Agency Type" v={selected.agency_type} />
                  <Row2 k="Annual bookings" v={selected.annual_group_bookings} />
                  <Row2 k="Avg rooms/booking" v={selected.avg_rooms_per_booking} />
                </Group>
                <Group title="Billing">
                  <Row2 k="Legal Billing Name" v={selected.legal_billing_name} />
                  <Row2 k="VAT" v={selected.vat_billing_number} />
                  <Row2 k="Address" v={selected.billing_address} />
                  <Row2 k="Email" v={selected.billing_email} />
                </Group>

                <Group title="Verification History">
                  {events.length === 0 ? (
                    <div className="col-span-2 text-xs text-muted-foreground">No events yet.</div>
                  ) : (
                    <ul className="col-span-2 space-y-2">
                      {events.map((e: any) => {
                        const t = String(e.event_type);
                        const color =
                          t === "approved" ? "bg-emerald-100 text-emerald-800" :
                          t === "rejected" ? "bg-red-100 text-red-800" :
                          t === "info_requested" ? "bg-amber-100 text-amber-800" :
                          t === "resubmitted" ? "bg-blue-100 text-blue-800" :
                          "bg-muted text-muted-foreground";
                        return (
                          <li key={e.id} className="rounded-md border border-border p-2 text-xs">
                            <div className="flex items-center gap-2">
                              <Badge className={`${color} border-0 capitalize`}>{t.replace("_", " ")}</Badge>
                              <span className="ml-auto text-muted-foreground">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</span>
                            </div>
                            {e.notes && (
                              <div className="mt-1 text-foreground">
                                <span className="font-medium">Reason:</span> {e.notes}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Group>

                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Review note / rejection reason</label>
                  <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Required for Reject / Request more info" />
                </div>
              </div>

              <DialogFooter className="gap-2 flex-wrap">
                <Button variant="outline" onClick={() => act("info")} disabled={busy}>Request more info</Button>
                <Button variant="destructive" onClick={() => act("reject")} disabled={busy}>Reject</Button>
                <Button variant="gold" onClick={() => act("approve")} disabled={busy}>Approve</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">{children}</div>
    </div>
  );
}
function Row2({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-foreground text-right truncate">{v ?? "—"}</span>
    </div>
  );
}
function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    submitted: "bg-amber-100 text-amber-800",
    pending_review: "bg-amber-100 text-amber-800",
    verified: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
    draft: "bg-muted text-muted-foreground",
  };
  const cls = map[status ?? "draft"] ?? "bg-muted";
  return <Badge className={`${cls} border-0 capitalize`}>{String(status ?? "").replace("_", " ") || "draft"}</Badge>;
}
function DocButton({ label, path, get }: { label: string; path?: string | null; get: (p?: string | null) => Promise<string | null> }) {
  const [loading, setLoading] = useState(false);
  if (!path) return <Badge variant="secondary" className="opacity-60">{label}: not uploaded</Badge>;
  return (
    <Button variant="outline" size="sm" disabled={loading} onClick={async () => {
      setLoading(true);
      const url = await get(path);
      setLoading(false);
      if (url) window.open(url, "_blank");
      else toast.error("Could not open document");
    }}>
      <FileText className="h-4 w-4 mr-1" /> {label}
    </Button>
  );
}
