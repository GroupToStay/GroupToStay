import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Children, cloneElement, isValidElement, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { useAgencyVerification } from "@/hooks/use-agency-verification";
import { useCountries, useCities, useLocalizedName } from "@/hooks/use-master-data";
import { AccessDenied } from "@/components/access-denied";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { z } from "zod";
import { AlertCircle, Building2, Clock, ShieldCheck, Upload, FileText } from "lucide-react";
import i18n from "@/lib/i18n";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";

export const Route = createFileRoute("/_authenticated/dashboard/agency-profile")({
  head: () => ({ meta: [{ title: i18n.t("profile.agency.metaTitle") }] }),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      {i18n.t("profile.agency.errors.loadBoundary", {
        message: error?.message ?? i18n.t("errors.unknown"),
      })}
    </div>
  ),
  notFoundComponent: () => <AccessDenied message={i18n.t("profile.agency.errors.notFound")} />,
});

const AGENCY_TYPES = [
  ["travel", "profile.agency.agencyTypes.travel"],
  ["tour_operator", "profile.agency.agencyTypes.tourOperator"],
  ["dmc", "profile.agency.agencyTypes.dmc"],
  ["hajj_umrah", "profile.agency.agencyTypes.hajjUmrah"],
  ["event", "profile.agency.agencyTypes.event"],
  ["corporate", "profile.agency.agencyTypes.corporate"],
  ["sports", "profile.agency.agencyTypes.sports"],
  ["government", "profile.agency.agencyTypes.government"],
  ["university", "profile.agency.agencyTypes.university"],
  ["other", "profile.agency.agencyTypes.other"],
] as const;

const BOOKINGS = ["<10", "10-50", "50-100", ">100"];
const ROOMS = ["20-50", "50-100", "100-300", ">300"];
const EMPLOYEES = ["1-10", "11-50", "51-200", "200+"];

type Profile = Record<string, any>;

function Page() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { isOrganizer, isAdmin, isHotel, loading: rolesLoading } = useRoles();
  const {
    status,
    rejectionReason,
    isVerified,
    isPending,
    isRejected,
    refetch: refetchStatus,
  } = useAgencyVerification();
  const navigate = useNavigate();
  const localized = useLocalizedName();
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
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("[agency-profile] load error", error);
        toast.error(error.message || t("profile.agency.errors.loadFailed"));
      }
      // Normalize date to YYYY-MM-DD for <input type="date">
      const row: Profile = { ...(data ?? {}) };
      if (
        row.cr_expiry_date &&
        typeof row.cr_expiry_date === "string" &&
        row.cr_expiry_date.length > 10
      ) {
        row.cr_expiry_date = row.cr_expiry_date.slice(0, 10);
      }
      setProfile(row);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [t, user]);

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
    return <AccessDenied message={t("profile.agency.errors.agencyOnly")} />;
  }
  if (!isOrganizer && !isAdmin) {
    return <AccessDenied message={t("profile.agency.errors.agencyOnly")} />;
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
      const { error } = await supabase
        .from("profiles")
        .update(patch as any)
        .eq("id", user.id);
      if (error) throw error;
      toast.success(t("profile.agency.toasts.draftSaved"));
    } catch (e: any) {
      toast.error(e?.message ?? t("profile.agency.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function upload(kind: "cr" | "tl", file: File) {
    if (!user) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type)) return toast.error(t("profile.agency.errors.fileType"));
    if (file.size > 10 * 1024 * 1024) return toast.error(t("profile.agency.errors.fileSize"));
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("agency-documents")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const col = kind === "cr" ? "cr_document_path" : "tourism_license_document_path";
      set(col, path);
      await supabase
        .from("profiles")
        .update({ [col]: path } as any)
        .eq("id", user.id);
      toast.success(t("profile.agency.toasts.documentUploaded"));
    } catch (e: any) {
      toast.error(e?.message ?? t("profile.agency.errors.uploadFailed"));
    } finally {
      setUploading(null);
    }
  }

  const schema = z.object({
    legal_company_name: z.string().min(2, t("profile.agency.validation.legalCompanyName")),
    country_id: z.string().uuid(t("validation.countryRequired")),
    city_id: z.string().uuid(t("validation.cityRequired")),
    full_address: z.string().min(4, t("profile.agency.validation.address")),
    cr_number: z.string().min(2, t("profile.agency.validation.crNumber")),
    cr_expiry_date: z.string().min(4, t("profile.agency.validation.crExpiry")),
    issuing_authority: z.string().min(2, t("profile.agency.validation.issuingAuthority")),
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
    cr_document_path: z.string().min(1, t("profile.agency.validation.crDocument")),
  });

  async function submit() {
    if (!user) return;
    if (!(agree1 && agree2 && agree3 && agree4))
      return toast.error(t("profile.agency.errors.legalAgreements"));
    try {
      schema.parse(profile);
    } catch (e: any) {
      const msg = e?.errors?.[0]?.message ?? t("validation.completeRequiredFields");
      return toast.error(msg);
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          ...profile,
          agency_verification_status: "pending_review",
          verification_submitted_at: new Date().toISOString(),
          verification_rejection_reason: null,
          legal_agreements_accepted_at: new Date().toISOString(),
        } as any)
        .eq("id", user.id);

      if (error) throw error;
      await supabase.from("agency_verification_events").insert({
        agency_id: user.id,
        event_type: isRejected ? "resubmitted" : "submitted",
        actor_id: user.id,
      });
      toast.success(t("profile.agency.toasts.submitted"));
      await refetchStatus();
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e?.message ?? t("profile.agency.errors.submissionFailed"));
    } finally {
      setSaving(false);
    }
  }

  const StatusBanner = () => {
    if (isVerified)
      return (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <div>
            <div className="font-medium text-emerald-800">
              {t("profile.agency.status.verifiedTitle")}
            </div>
            <div className="text-sm text-emerald-700">
              {t("profile.agency.status.verifiedDescription")}
            </div>
          </div>
        </div>
      );
    if (isPending)
      return (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-600" />
          <div>
            <div className="font-medium text-amber-800">
              {t("profile.agency.status.pendingTitle")}
            </div>
            <div className="text-sm text-amber-700">
              {t("profile.agency.status.pendingDescription")}
            </div>
          </div>
        </div>
      );
    if (isRejected)
      return (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <div className="font-medium text-destructive">
              {t("profile.agency.status.rejectedTitle")}
            </div>
            {rejectionReason && (
              <div className="text-sm mt-1">
                <span className="font-medium">
                  {t("admin.agencyVerifications.history.reason")}:
                </span>{" "}
                {rejectionReason}
              </div>
            )}
            <div className="text-sm text-muted-foreground mt-1">
              {t("profile.agency.status.rejectedDescription")}
            </div>
          </div>
        </div>
      );
    return (
      <div className="rounded-md border border-border bg-accent/30 p-4 text-sm text-muted-foreground">
        {t("profile.agency.status.draftDescription")}
      </div>
    );
  };

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={t("profile.agency.title")}
        description={t("profile.agency.description")}
        icon={Building2}
        meta={<StatusBadge status={status} />}
      />

      <div>
        <StatusBanner />
      </div>

      <fieldset disabled={readOnly} className="space-y-6">
        <Section title={t("profile.agency.sections.companyInfo")}>
          <Field label={t("profile.agency.fields.legalCompanyName")} required>
            <Input
              value={profile.legal_company_name ?? ""}
              onChange={(e) => set("legal_company_name", e.target.value)}
              maxLength={200}
            />
          </Field>
          <Field label={t("profile.agency.fields.tradeName")}>
            <Input
              value={profile.trade_name ?? ""}
              onChange={(e) => set("trade_name", e.target.value)}
              maxLength={200}
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t("common.country")} required>
              <Select
                value={profile.country_id ?? ""}
                onValueChange={(v) => {
                  set("country_id", v);
                  set("city_id", null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("forms.select")} />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {localized(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("common.city")} required>
              <Select
                value={profile.city_id ?? ""}
                onValueChange={(v) => set("city_id", v)}
                disabled={!profile.country_id}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      profile.country_id ? t("forms.select") : t("common.selectCountryFirst")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {localized(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label={t("profile.agency.fields.fullAddress")} required>
            <Textarea
              rows={2}
              value={profile.full_address ?? ""}
              onChange={(e) => set("full_address", e.target.value)}
              maxLength={500}
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label={t("profile.agency.fields.website")}>
              <Input
                value={profile.website ?? ""}
                onChange={(e) => set("website", e.target.value)}
                placeholder={t("profile.agency.fields.websitePlaceholder")}
              />
            </Field>
            <Field label={t("profile.agency.fields.yearEstablished")}>
              <Input
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                value={profile.year_established ?? ""}
                onChange={(e) =>
                  set("year_established", e.target.value ? Number(e.target.value) : null)
                }
              />
            </Field>
            <Field label={t("profile.agency.fields.employees")}>
              <Select
                value={profile.employees_count ?? ""}
                onValueChange={(v) => set("employees_count", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("forms.optional")} />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </Section>

        <Section title={t("profile.agency.sections.businessRegistration")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t("profile.agency.fields.crNumber")} required>
              <Input
                value={profile.cr_number ?? ""}
                onChange={(e) => set("cr_number", e.target.value)}
                maxLength={80}
              />
            </Field>
            <Field label={t("profile.agency.fields.crExpiryDate")} required>
              <Input
                type="date"
                value={profile.cr_expiry_date ?? ""}
                onChange={(e) => set("cr_expiry_date", e.target.value)}
              />
            </Field>
          </div>
          <Field label={t("profile.agency.fields.issuingAuthority")} required>
            <Input
              value={profile.issuing_authority ?? ""}
              onChange={(e) => set("issuing_authority", e.target.value)}
              maxLength={200}
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t("profile.agency.fields.tourismLicenseNumber")}>
              <Input
                value={profile.tourism_license_number ?? ""}
                onChange={(e) => set("tourism_license_number", e.target.value)}
                maxLength={80}
              />
            </Field>
            <Field label={t("profile.agency.fields.tourismLicenseAuthority")}>
              <Input
                value={profile.tourism_license_authority ?? ""}
                onChange={(e) => set("tourism_license_authority", e.target.value)}
                maxLength={200}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UploadField
              label={t("profile.agency.fields.crDocument")}
              required
              current={profile.cr_document_path}
              onFile={(f) => upload("cr", f)}
              loading={uploading === "cr"}
              disabled={readOnly}
            />
            <UploadField
              label={t("profile.agency.fields.tourismLicenseDocument")}
              current={profile.tourism_license_document_path}
              onFile={(f) => upload("tl", f)}
              loading={uploading === "tl"}
              disabled={readOnly}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("profile.agency.documentsHint")}</p>
        </Section>

        <Section title={t("profile.agency.sections.contactPerson")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t("profile.agency.fields.fullName")} required>
              <Input
                value={profile.contact_person_name ?? ""}
                onChange={(e) => set("contact_person_name", e.target.value)}
              />
            </Field>
            <Field label={t("profile.agency.fields.position")} required>
              <Input
                value={profile.contact_person_position ?? ""}
                onChange={(e) => set("contact_person_position", e.target.value)}
              />
            </Field>
            <Field label={t("admin.users.fields.email")} required>
              <Input
                type="email"
                value={profile.contact_person_email ?? ""}
                onChange={(e) => set("contact_person_email", e.target.value)}
              />
            </Field>
            <Field label={t("admin.users.table.phone")} required>
              <Input
                value={profile.contact_person_phone ?? ""}
                onChange={(e) => set("contact_person_phone", e.target.value)}
              />
            </Field>
            <Field label={t("profile.agency.fields.whatsapp")}>
              <Input
                value={profile.contact_person_whatsapp ?? ""}
                onChange={(e) => set("contact_person_whatsapp", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title={t("profile.agency.sections.businessInfo")}>
          <Field label={t("profile.agency.fields.agencyType")} required>
            <Select value={profile.agency_type ?? ""} onValueChange={(v) => set("agency_type", v)}>
              <SelectTrigger>
                <SelectValue placeholder={t("forms.select")} />
              </SelectTrigger>
              <SelectContent>
                {AGENCY_TYPES.map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {t(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t("profile.agency.fields.annualBookings")} required>
              <Select
                value={profile.annual_group_bookings ?? ""}
                onValueChange={(v) => set("annual_group_bookings", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("forms.select")} />
                </SelectTrigger>
                <SelectContent>
                  {BOOKINGS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("profile.agency.fields.averageRooms")} required>
              <Select
                value={profile.avg_rooms_per_booking ?? ""}
                onValueChange={(v) => set("avg_rooms_per_booking", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("forms.select")} />
                </SelectTrigger>
                <SelectContent>
                  {ROOMS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </Section>

        <Section title={t("profile.agency.sections.billingInfo")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t("profile.agency.fields.legalBillingName")} required>
              <Input
                value={profile.legal_billing_name ?? ""}
                onChange={(e) => set("legal_billing_name", e.target.value)}
              />
            </Field>
            <Field label={t("profile.agency.fields.vatNumber")} required>
              <Input
                value={profile.vat_billing_number ?? ""}
                onChange={(e) => set("vat_billing_number", e.target.value)}
              />
            </Field>
          </div>
          <Field label={t("profile.agency.fields.billingAddress")} required>
            <Textarea
              rows={2}
              value={profile.billing_address ?? ""}
              onChange={(e) => set("billing_address", e.target.value)}
            />
          </Field>
          <Field label={t("profile.agency.fields.billingEmail")} required>
            <Input
              type="email"
              value={profile.billing_email ?? ""}
              onChange={(e) => set("billing_email", e.target.value)}
            />
          </Field>
        </Section>

        {!readOnly && (
          <Section title={t("profile.agency.sections.legalAgreements")}>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={agree1} onCheckedChange={(v) => setAgree1(!!v)} />{" "}
              {t("profile.agency.agreements.accurate")}
            </label>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={agree2} onCheckedChange={(v) => setAgree2(!!v)} />{" "}
              {t("profile.agency.agreements.terms")}
            </label>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={agree3} onCheckedChange={(v) => setAgree3(!!v)} />{" "}
              {t("profile.agency.agreements.privacy")}
            </label>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={agree4} onCheckedChange={(v) => setAgree4(!!v)} />{" "}
              {t("profile.agency.agreements.falseInfo")}
            </label>
          </Section>
        )}
      </fieldset>

      {!readOnly && (
        <div className="mt-6 flex gap-3 justify-end">
          <Button variant="outline" onClick={saveDraft} disabled={saving}>
            {t("profile.agency.actions.saveDraft")}
          </Button>
          <Button variant="gold" onClick={submit} disabled={saving}>
            {saving
              ? t("rfq.submitting")
              : isRejected
                ? t("profile.agency.actions.resubmit")
                : t("profile.agency.actions.submit")}
          </Button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const id = useId();
  const control = isValidElement(children)
    ? children.type === Select
      ? cloneElement(
          children,
          undefined,
          Children.map((children.props as { children?: React.ReactNode }).children, (child) =>
            isValidElement(child) && child.type === SelectTrigger
              ? cloneElement(child as React.ReactElement<{ id?: string; "aria-label"?: string }>, {
                  id,
                  "aria-label": label,
                })
              : child,
          ),
        )
      : cloneElement(children as React.ReactElement<{ id?: string; "aria-label"?: string }>, {
          id,
          "aria-label": label,
        })
    : children;

  return (
    <div>
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="mt-1">{control}</div>
    </div>
  );
}

function UploadField({
  label,
  required,
  current,
  onFile,
  loading,
  disabled,
}: {
  label: string;
  required?: boolean;
  current?: string | null;
  onFile: (f: File) => void;
  loading: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div>
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="mt-1 flex items-center gap-2">
        <label
          className={`inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm cursor-pointer hover:bg-accent ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        >
          <Upload className="h-4 w-4" />
          {loading
            ? t("profile.agency.upload.uploading")
            : current
              ? t("profile.agency.upload.replace")
              : t("profile.agency.upload.upload")}
          <input
            id={id}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
        {current && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" /> {t("profile.agency.upload.uploaded")}
          </span>
        )}
      </div>
    </div>
  );
}
