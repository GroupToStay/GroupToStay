import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { useCountries, useLocalizedName } from "@/hooks/use-master-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  Languages,
  Lock,
  Mail,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { PhoneInput } from "@/components/phone-input";
import { DEFAULT_PHONE_CODE } from "@/lib/phone-codes";
import { PmsSection } from "@/components/pms-section";
import i18n from "@/lib/i18n";
import { PageHeader } from "@/components/workspace/page-header";
import { RoleBadge } from "@/components/role-badge";
import { ProfilePhotoEditor } from "@/components/profile-photo-editor";
import { useAccountIdentity } from "@/hooks/use-account-identity";
import { useApplicationLocale } from "@/lib/application-locale";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  head: () => ({ meta: [{ title: i18n.t("profile.metaTitle") }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isHotel, isAdmin } = useRoles();
  const { avatarUrl, displayName, role } = useAccountIdentity();
  const qc = useQueryClient();
  const { data: countries = [] } = useCountries();
  const localized = useLocalizedName();
  const { language, setLanguage } = useApplicationLocale();

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
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={isAdmin ? t("profile.admin.title") : t("profile.title")}
        description={isAdmin ? t("profile.admin.description") : t("profile.subtitle")}
        icon={isAdmin ? ShieldCheck : UserIcon}
        actions={<RoleBadge role={role} />}
      />

      <Card>
        <CardContent className="p-6">
          <h2 className="font-display text-xl text-primary">{t("profile.photo.title")}</h2>
          <div className="mt-4">
            <ProfilePhotoEditor name={displayName} imageUrl={avatarUrl} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-display text-xl text-primary">{t("profile.personalInfo")}</h2>
          {isAdmin ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <ReadRow label={t("profile.admin.name")} value={profile?.full_name} />
              <ReadRow label={t("profile.email")} value={user?.email} />
              <ReadRow label={t("profile.country")} value={countryLabel} />
              <ReadRow label={t("profile.phone")} value={profile?.phone} />
            </div>
          ) : (
            <form method="post" onSubmit={saveProfile} className="mt-4 space-y-4">
              <div>
                <Label htmlFor="profile-full-name">{t("profile.fullName")}</Label>
                <Input
                  id="profile-full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={160}
                />
              </div>
              <div>
                <Label htmlFor="profile-phone-number">{t("profile.phone")}</Label>
                <PhoneInput
                  codeId="profile-phone-code"
                  numberId="profile-phone-number"
                  codeAriaLabel={t("auth.phoneCode")}
                  numberAriaLabel={t("profile.phone")}
                  code={phoneCode}
                  number={phoneNumber}
                  onCodeChange={setPhoneCode}
                  onNumberChange={setPhoneNumber}
                />
              </div>
              <div>
                <Label htmlFor="profile-country">{t("profile.country")}</Label>
                <Input id="profile-country" value={countryLabel} disabled readOnly />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("profile.countryLockedHint")}
                </p>
              </div>
              <div>
                <Label htmlFor="profile-contact-email">{t("profile.contactEmail")}</Label>
                <Input
                  id="profile-contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  maxLength={255}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("profile.contactEmailHint")}
                </p>
              </div>
              {isHotel ? (
                <div>
                  <Label htmlFor="profile-org-name">{t("profile.orgName")}</Label>
                  <Input
                    id="profile-org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    maxLength={160}
                  />
                </div>
              ) : null}
              <Button type="submit" disabled={saving}>
                {saving ? t("common.loading") : t("profile.save")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-display text-xl text-primary flex items-center gap-2">
            <Mail className="h-5 w-5" /> {t("profile.account.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("profile.loginEmailHint")}</p>
          {isAdmin ? (
            <div className="mt-4">
              <ReadRow label={t("profile.email")} value={user?.email} />
            </div>
          ) : (
            <form
              method="post"
              onSubmit={changeLoginEmail}
              className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <Label htmlFor="profile-auth-email">{t("profile.email")}</Label>
                <Input
                  id="profile-auth-email"
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
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <h2 className="flex items-center gap-2 font-display text-lg text-primary">
              <Languages className="h-5 w-5" /> {t("profile.language.title")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("profile.language.description")}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 min-h-11 w-full"
              onClick={() => void setLanguage(language === "ar" ? "en" : "ar")}
            >
              <Languages className="h-4 w-4" />
              {language === "ar"
                ? t("profile.language.switchToEnglish")
                : t("profile.language.switchToArabic")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="flex items-center gap-2 font-display text-lg text-primary">
              <Bell className="h-5 w-5" /> {t("profile.notifications.title")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("profile.notifications.description")}
            </p>
            <Button asChild variant="outline" className="mt-4 min-h-11 w-full">
              <Link to="/dashboard/notifications">
                <Bell className="h-4 w-4" />
                {t("profile.notifications.open")}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="flex items-center gap-2 font-display text-lg text-primary">
              <Lock className="h-5 w-5" /> {t("profile.security.title")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("profile.security.description")}
            </p>
            <div className="mt-4 flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" />
              {user?.email_confirmed_at
                ? t("profile.security.emailVerified")
                : t("profile.security.emailPending")}
            </div>
          </CardContent>
        </Card>
      </div>

      {isHotel && (
        <Card>
          <CardContent className="p-6">
            <h2 className="font-display text-xl text-primary flex items-center gap-2">
              <Lock className="h-5 w-5" /> {t("profile.companyInfo")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("profile.companyLockedHint")}</p>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="profile-company-name">{t("profile.companyName")}</Label>
                <Input
                  id="profile-company-name"
                  value={profile?.company_name ?? ""}
                  disabled
                  readOnly
                />
              </div>
              <div>
                <Label htmlFor="profile-vat-number">{t("profile.vatNumber")}</Label>
                <Input
                  id="profile-vat-number"
                  value={profile?.vat_number ?? ""}
                  disabled
                  readOnly
                />
              </div>
              <div>
                <Label htmlFor="profile-cr-number">{t("profile.crNumber")}</Label>
                <Input id="profile-cr-number" value={profile?.cr_number ?? ""} disabled readOnly />
              </div>
              <div>
                <Label htmlFor="profile-id-number">{t("profile.idNumber")}</Label>
                <Input id="profile-id-number" value={profile?.id_number ?? ""} disabled readOnly />
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
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value ?? "—"} disabled readOnly />
    </div>
  );
}
