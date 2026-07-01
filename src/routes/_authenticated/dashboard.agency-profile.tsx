import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { useAgencyVerification } from "@/hooks/use-agency-verification";
import { useCountries, useCities } from "@/hooks/use-master-data";
import { AccessDenied } from "@/components/access-denied";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { z } from "zod";
import { AlertCircle, Clock, ShieldCheck, Upload, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/agency-profile")({
  head: () => ({ meta: [{ title: "Agency Profile — GroupToStay" }] }),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      Failed to load Agency Profile: {error?.message ?? "Unknown error"}
    </div>
  ),
  notFoundComponent: () => <AccessDenied message="Agency Profile not found." />,
});

const AGENCY_TYPES = [
  ["travel", "Travel Agency"],
  ["tour_operator", "Tour Operator"],
  ["dmc", "Destination Management Company (DMC)"],
  ["hajj_umrah", "Hajj & Umrah Company"],
  ["event", "Event Organizer"],
  ["corporate", "Corporate Travel"],
  ["sports", "Sports Travel"],
  ["government", "Government Organization"],
  ["university", "University"],
  ["other", "Other"],
] as const;

const BOOKINGS = ["<10", "10-50", "50-100", ">100"];
const ROOMS = ["20-50", "50-100", "100-300", ">300"];
const EMPLOYEES = ["1-10", "11-50", "51-200", "200+"];

type Profile = Record<string, any>;

function Page() {
  const { user, loading: authLoading } = useAuth();
  const { isOrganizer, isAdmin, loading: rolesLoading } = useRoles();
  const { status, rejectionReason, isVerified, isPending, isRejected, refetch: refetchStatus } = useAgencyVerification();
  const navigate = useNavigate();
  const { data: countries = [] } = useCountries();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"cr" | "tl" | null>(null);
  const [agree1, setAgree1] = useState(false);
  const [agree2, setAgree2] = useState(false);
  const [agree3, setAgree3] = useState(false);
  const [agree4, setAgree4] = useState(false);

  const { data: cities = [] } = useCities(profile?.country_id ?? null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("[agency-profile] load error", error);
        toast.error(error.message || "Failed to load profile");
      }
      // Normalize date to YYYY-MM-DD for <input type="date">
      const row: Profile = { ...(data ?? {}) };
      if (row.cr_expiry_date && typeof row.cr_expiry_date === "string" && row.cr_expiry_date.length > 10) {
        row.cr_expiry_date = row.cr_expiry_date.slice(0, 10);
      }
      setProfile(row);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (authLoading || rolesLoading || loading || !profile) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isHotel) {
    return <AccessDenied message="Agency Profile is only available to agency accounts." />;
  }
  if (!isOrganizer && !isAdmin) {
    return <AccessDenied message="Agency Profile is only available to agency accounts." />;
  }

  const readOnly = isPending || isVerified;

  const set = (k: string, v: any) => setProfile((p) => ({ ...(p ?? {}), [k]: v }));

  async function saveDraft() {
    if (!user) return;
    setSaving(true);
    try {
      const patch = { ...profile };
      delete patch.id;
      delete patch.created_at;
      delete patch.updated_at;
      delete patch.agency_verification_status;
      delete patch.verification_reviewed_at;
      delete patch.verification_reviewed_by;
      delete patch.hotel_approval_status;
      delete patch.approved_at;
      delete patch.approved_by;
      delete patch.approval_notes;
      const { error } = await supabase.from("profiles").update(patch as any).eq("id", user.id);
      if (error) throw error;
      toast.success("Draft saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function upload(kind: "cr" | "tl", file: File) {
    if (!user) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type)) return toast.error("Only PDF, JPG, PNG allowed");
    if (file.size > 10 * 1024 * 1024) return toast.error("File must be under 10 MB");
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("agency-documents").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const col = kind === "cr" ? "cr_document_path" : "tourism_license_document_path";
      set(col, path);
      await supabase.from("profiles").update({ [col]: path } as any).eq("id", user.id);
      toast.success("Document uploaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  const schema = z.object({
    legal_company_name: z.string().min(2, "Legal company name is required"),
    country_id: z.string().uuid("Country is required"),
    city_id: z.string().uuid("City is required"),
    full_address: z.string().min(4, "Address is required"),
    cr_number: z.string().min(2, "Commercial registration number is required"),
    cr_expiry_date: z.string().min(4, "CR expiry date is required"),
    issuing_authority: z.string().min(2, "Issuing authority is required"),
    contact_person_name: z.string().min(2),
    contact_person_position: z.string().min(2),
    contact_person_email: z.string().email(),
    contact_person_phone: z.string().min(5),
    agency_type: z.string().min(1),
    annual_group_bookings: z.string().min(1),
    avg_rooms_per_booking: z.string().min(1),
    legal_billing_name: z.string().min(2),
    vat_billing_number: z.string().min(2),
    billing_address: z.string().min(4),
    billing_email: z.string().email(),
    cr_document_path: z.string().min(1, "Please upload the Commercial Registration document"),
  });

  async function submit() {
    if (!user) return;
    if (!(agree1 && agree2 && agree3 && agree4)) return toast.error("Please accept all legal agreements");
    try {
      schema.parse(profile);
    } catch (e: any) {
      const msg = e?.errors?.[0]?.message ?? "Please complete all required fields";
      return toast.error(msg);
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        ...profile,
        agency_verification_status: "pending_review",
        verification_submitted_at: new Date().toISOString(),
        verification_rejection_reason: null,
        legal_agreements_accepted_at: new Date().toISOString(),
      } as any).eq("id", user.id);

      if (error) throw error;
      await supabase.from("agency_verification_events").insert({
        agency_id: user.id,
        event_type: isRejected ? "resubmitted" : "submitted",
        actor_id: user.id,
      });
      toast.success("Submitted for verification");
      await refetchStatus();
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e?.message ?? "Submission failed");
    } finally {
      setSaving(false);
    }
  }

  const StatusBanner = () => {
    if (isVerified) return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-600" />
        <div>
          <div className="font-medium text-emerald-800">Verified by GroupToStay</div>
          <div className="text-sm text-emerald-700">Your agency is verified. To update information, contact support.</div>
        </div>
      </div>
    );
    if (isPending) return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 flex items-center gap-3">
        <Clock className="h-5 w-5 text-amber-600" />
        <div>
          <div className="font-medium text-amber-800">Verification in progress</div>
          <div className="text-sm text-amber-700">Our team is reviewing your submission. This usually takes 1–2 business days.</div>
        </div>
      </div>
    );
    if (isRejected) return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
        <div>
          <div className="font-medium text-destructive">Verification rejected</div>
          {rejectionReason && <div className="text-sm mt-1"><span className="font-medium">Reason:</span> {rejectionReason}</div>}
          <div className="text-sm text-muted-foreground mt-1">Please update the information below and resubmit.</div>
        </div>
      </div>
    );
    return (
      <div className="rounded-md border border-border bg-accent/30 p-4 text-sm text-muted-foreground">
        Complete all required fields and submit for verification. You cannot publish requests or contact hotels until verified.
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1 container-page py-8 max-w-3xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="font-display text-3xl text-primary">Agency Profile</h1>
          <Badge variant={isVerified ? "default" : "secondary"} className="capitalize">{status.replace("_", " ")}</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">All information is confidential and used only for verification. Documents are visible to admins only.</p>

        <div className="mt-4"><StatusBanner /></div>

        <fieldset disabled={readOnly} className="mt-6 space-y-6">
          <Section title="Company Information">
            <Field label="Legal Company Name" required>
              <Input value={profile.legal_company_name ?? ""} onChange={(e) => set("legal_company_name", e.target.value)} maxLength={200} />
            </Field>
            <Field label="Trade Name">
              <Input value={profile.trade_name ?? ""} onChange={(e) => set("trade_name", e.target.value)} maxLength={200} />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Country" required>
                <Select value={profile.country_id ?? ""} onValueChange={(v) => { set("country_id", v); set("city_id", null); }}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="City" required>
                <Select value={profile.city_id ?? ""} onValueChange={(v) => set("city_id", v)} disabled={!profile.country_id}>
                  <SelectTrigger><SelectValue placeholder={profile.country_id ? "Select…" : "Choose country first"} /></SelectTrigger>
                  <SelectContent>{cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Full Address" required>
              <Textarea rows={2} value={profile.full_address ?? ""} onChange={(e) => set("full_address", e.target.value)} maxLength={500} />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Website">
                <Input value={profile.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
              </Field>
              <Field label="Year Established">
                <Input type="number" min={1900} max={new Date().getFullYear()} value={profile.year_established ?? ""} onChange={(e) => set("year_established", e.target.value ? Number(e.target.value) : null)} />
              </Field>
              <Field label="Number of Employees">
                <Select value={profile.employees_count ?? ""} onValueChange={(v) => set("employees_count", v)}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{EMPLOYEES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          </Section>

          <Section title="Business Registration">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Commercial Registration Number" required>
                <Input value={profile.cr_number ?? ""} onChange={(e) => set("cr_number", e.target.value)} maxLength={80} />
              </Field>
              <Field label="CR Expiry Date" required>
                <Input type="date" value={profile.cr_expiry_date ?? ""} onChange={(e) => set("cr_expiry_date", e.target.value)} />
              </Field>
            </div>
            <Field label="Issuing Authority" required>
              <Input value={profile.issuing_authority ?? ""} onChange={(e) => set("issuing_authority", e.target.value)} maxLength={200} />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Tourism License Number">
                <Input value={profile.tourism_license_number ?? ""} onChange={(e) => set("tourism_license_number", e.target.value)} maxLength={80} />
              </Field>
              <Field label="Tourism License Authority">
                <Input value={profile.tourism_license_authority ?? ""} onChange={(e) => set("tourism_license_authority", e.target.value)} maxLength={200} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UploadField label="Commercial Registration Document" required current={profile.cr_document_path} onFile={(f) => upload("cr", f)} loading={uploading === "cr"} disabled={readOnly} />
              <UploadField label="Tourism License Document" current={profile.tourism_license_document_path} onFile={(f) => upload("tl", f)} loading={uploading === "tl"} disabled={readOnly} />
            </div>
            <p className="text-xs text-muted-foreground">Accepted formats: PDF, JPG, PNG (max 10 MB). Documents are visible to GroupToStay admins only.</p>
          </Section>

          <Section title="Contact Person">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Full Name" required><Input value={profile.contact_person_name ?? ""} onChange={(e) => set("contact_person_name", e.target.value)} /></Field>
              <Field label="Position" required><Input value={profile.contact_person_position ?? ""} onChange={(e) => set("contact_person_position", e.target.value)} /></Field>
              <Field label="Email" required><Input type="email" value={profile.contact_person_email ?? ""} onChange={(e) => set("contact_person_email", e.target.value)} /></Field>
              <Field label="Phone" required><Input value={profile.contact_person_phone ?? ""} onChange={(e) => set("contact_person_phone", e.target.value)} /></Field>
              <Field label="WhatsApp"><Input value={profile.contact_person_whatsapp ?? ""} onChange={(e) => set("contact_person_whatsapp", e.target.value)} /></Field>
            </div>
          </Section>

          <Section title="Business Information">
            <Field label="Agency Type" required>
              <Select value={profile.agency_type ?? ""} onValueChange={(v) => set("agency_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{AGENCY_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Annual group bookings" required>
                <Select value={profile.annual_group_bookings ?? ""} onValueChange={(v) => set("annual_group_bookings", v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{BOOKINGS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Average rooms per booking" required>
                <Select value={profile.avg_rooms_per_booking ?? ""} onValueChange={(v) => set("avg_rooms_per_booking", v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{ROOMS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          </Section>

          <Section title="Billing Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Legal Billing Name" required><Input value={profile.legal_billing_name ?? ""} onChange={(e) => set("legal_billing_name", e.target.value)} /></Field>
              <Field label="VAT Number" required><Input value={profile.vat_billing_number ?? ""} onChange={(e) => set("vat_billing_number", e.target.value)} /></Field>
            </div>
            <Field label="Billing Address" required>
              <Textarea rows={2} value={profile.billing_address ?? ""} onChange={(e) => set("billing_address", e.target.value)} />
            </Field>
            <Field label="Billing Email" required><Input type="email" value={profile.billing_email ?? ""} onChange={(e) => set("billing_email", e.target.value)} /></Field>
          </Section>

          {!readOnly && (
            <Section title="Legal Agreements">
              <label className="flex items-start gap-2 text-sm"><Checkbox checked={agree1} onCheckedChange={(v) => setAgree1(!!v)} /> I confirm all provided information is accurate.</label>
              <label className="flex items-start gap-2 text-sm"><Checkbox checked={agree2} onCheckedChange={(v) => setAgree2(!!v)} /> I agree to the Terms &amp; Conditions.</label>
              <label className="flex items-start gap-2 text-sm"><Checkbox checked={agree3} onCheckedChange={(v) => setAgree3(!!v)} /> I agree to the Privacy Policy.</label>
              <label className="flex items-start gap-2 text-sm"><Checkbox checked={agree4} onCheckedChange={(v) => setAgree4(!!v)} /> I understand that providing false information may result in account suspension.</label>
            </Section>
          )}
        </fieldset>

        {!readOnly && (
          <div className="mt-6 flex gap-3 justify-end">
            <Button variant="outline" onClick={saveDraft} disabled={saving}>Save Draft</Button>
            <Button variant="gold" onClick={submit} disabled={saving}>{saving ? "Submitting…" : (isRejected ? "Resubmit for verification" : "Submit for verification")}</Button>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function UploadField({ label, required, current, onFile, loading, disabled }: {
  label: string; required?: boolean; current?: string | null; onFile: (f: File) => void; loading: boolean; disabled?: boolean;
}) {
  return (
    <div>
      <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
      <div className="mt-1 flex items-center gap-2">
        <label className={`inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm cursor-pointer hover:bg-accent ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
          <Upload className="h-4 w-4" />
          {loading ? "Uploading…" : (current ? "Replace" : "Upload")}
          <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </label>
        {current && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><FileText className="h-3 w-3" /> Uploaded</span>}
      </div>
    </div>
  );
}
