import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { useCountries, useLocalizedName } from "@/hooks/use-master-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, User as UserIcon, Mail, ShieldCheck } from "lucide-react";
import { PhoneInput } from "@/components/phone-input";
import { DEFAULT_PHONE_CODE } from "@/lib/phone-codes";
import { PmsSection } from "@/components/pms-section";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  head: () => ({ meta: [{ title: "My profile — GroupToStay" }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isHotel, isAdmin } = useRoles();
  const qc = useQueryClient();
  const { data: countries = [] } = useCountries();
  const localized = useLocalizedName();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [fullName, setFullName] = useState("");
  const [phoneCode, setPhoneCode] = useState(DEFAULT_PHONE_CODE);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [saving, setSaving] = useState(false);

  const [authEmail, setAuthEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhoneCode((profile as any).country_code ?? DEFAULT_PHONE_CODE);
      setPhoneNumber((profile as any).phone_number ?? "");
      setContactEmail(profile.contact_email ?? "");
      setOrgName(profile.org_name ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (user?.email) setAuthEmail(user.email);
  }, [user?.email]);

  const countryLabel = (() => {
    const cid = (profile as any)?.country_id as string | null | undefined;
    if (cid) {
      const c = countries.find((x) => x.id === cid);
      if (c) return localized(c);
    }
    return profile?.country ?? "—";
  })();

  // ===== ADMIN: read-only =====
  if (isAdmin) {
    if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="font-display text-3xl text-primary flex items-center gap-2">
            <ShieldCheck className="h-7 w-7" /> Admin Account
          </h1>
          <p className="mt-1 text-muted-foreground">Read-only account information.</p>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <ReadRow label="Name" value={profile?.full_name} />
            <ReadRow label="Email" value={user?.email} />
            <ReadRow label="Country" value={countryLabel} />
            <ReadRow label="Phone" value={profile?.phone} />
          </CardContent>
        </Card>
      </div>
    );
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const fullPhone = phoneNumber ? `${phoneCode}${phoneNumber}` : null;
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          country_code: phoneCode,
          phone_number: phoneNumber.trim() || null,
          phone: fullPhone,
          contact_email: contactEmail.trim() || null,
          org_name: orgName.trim() || null,
        } as any)
        .eq("id", user.id);
      if (error) throw error;
      toast.success(t("profile.savedToast"));
      qc.invalidateQueries({ queryKey: ["my-profile-full", user.id] });
    } catch (err: any) {
      toast.error(err.message ?? t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function changeLoginEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!authEmail || authEmail === user?.email) return;
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: authEmail.trim() });
      if (error) throw error;
      toast.success(t("profile.emailChangeSent"));
    } catch (err: any) {
      toast.error(err.message ?? t("common.error"));
    } finally {
      setSavingEmail(false);
    }
  }

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <UserIcon className="h-7 w-7" /> My Profile
        </h1>
        <p className="mt-1 text-muted-foreground">{t("profile.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-display text-xl text-primary">{t("profile.personalInfo")}</h2>
          <form onSubmit={saveProfile} className="mt-4 space-y-4">
            <div>
              <Label>{t("profile.fullName")}</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={160}
              />
            </div>
            <div>
              <Label>{t("profile.phone")}</Label>
              <PhoneInput
                code={phoneCode}
                number={phoneNumber}
                onCodeChange={setPhoneCode}
                onNumberChange={setPhoneNumber}
              />
            </div>
            <div>
              <Label>{t("profile.country")}</Label>
              <Input value={countryLabel} disabled readOnly />
              <p className="mt-1 text-xs text-muted-foreground">
                Country is set at signup and cannot be changed here.
              </p>
            </div>
            <div>
              <Label>{t("profile.contactEmail")}</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                maxLength={255}
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("profile.contactEmailHint")}</p>
            </div>
            {isHotel && (
              <div>
                <Label>{t("profile.orgName")}</Label>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  maxLength={160}
                />
              </div>
            )}
            <Button type="submit" variant="gold" disabled={saving}>
              {saving ? t("common.loading") : t("profile.save")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-display text-xl text-primary flex items-center gap-2">
            <Mail className="h-5 w-5" /> {t("profile.loginEmail")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("profile.loginEmailHint")}</p>
          <form
            onSubmit={changeLoginEmail}
            className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-end"
          >
            <div className="flex-1">
              <Label>{t("profile.email")}</Label>
              <Input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                maxLength={255}
              />
            </div>
            <Button
              type="submit"
              variant="default"
              disabled={savingEmail || authEmail === user?.email}
            >
              {savingEmail ? t("common.loading") : t("profile.changeEmail")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isHotel && (
        <Card>
          <CardContent className="p-6">
            <h2 className="font-display text-xl text-primary flex items-center gap-2">
              <Lock className="h-5 w-5" /> {t("profile.companyInfo")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("profile.companyLockedHint")}</p>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div>
                <Label>{t("profile.companyName")}</Label>
                <Input value={profile?.company_name ?? ""} disabled readOnly />
              </div>
              <div>
                <Label>{t("profile.vatNumber")}</Label>
                <Input value={profile?.vat_number ?? ""} disabled readOnly />
              </div>
              <div>
                <Label>{t("profile.crNumber")}</Label>
                <Input value={profile?.cr_number ?? ""} disabled readOnly />
              </div>
              <div>
                <Label>{t("profile.idNumber")}</Label>
                <Input value={profile?.id_number ?? ""} disabled readOnly />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isHotel && user && <PmsSection userId={user.id} profile={profile} />}
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value ?? "—"} disabled readOnly />
    </div>
  );
}
