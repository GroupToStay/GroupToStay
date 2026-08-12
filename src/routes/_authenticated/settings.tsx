"use client";

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  CheckCircle2,
  KeyRound,
  Languages,
  Lock,
  Mail,
  MonitorSmartphone,
  Settings,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/workspace/page-header";
import { PhoneInput } from "@/components/phone-input";
import { PmsSection } from "@/components/pms-section";
import { ProfilePhotoEditor } from "@/components/profile-photo-editor";
import { RoleBadge } from "@/components/role-badge";
import { useAccountIdentity } from "@/hooks/use-account-identity";
import { useAuth } from "@/hooks/use-auth";
import { useCountries, useLocalizedName } from "@/hooks/use-master-data";
import { useRoles } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { useApplicationLocale } from "@/lib/application-locale";
import i18n from "@/lib/i18n";
import { DEFAULT_PHONE_CODE } from "@/lib/phone-codes";
import { parseSettingsSearch, SETTINGS_TABS, type SettingsTab } from "@/lib/settings-navigation";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: i18n.t("profile.settings.metaTitle") }] }),
  validateSearch: parseSettingsSearch,
  component: SettingsPage,
});

const TAB_ICONS = {
  profile: UserIcon,
  account: Mail,
  notifications: Bell,
  language: Languages,
  security: Lock,
} satisfies Record<SettingsTab, typeof UserIcon>;

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab } = parseSettingsSearch(Route.useSearch());
  const { user } = useAuth();
  const { isHotel, isAdmin } = useRoles();
  const { avatarUrl, displayName, role } = useAccountIdentity();
  const queryClient = useQueryClient();
  const { data: countries = [] } = useCountries();
  const localizedName = useLocalizedName();
  const { formatDate, language, setLanguage } = useApplicationLocale();

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
  const [authEmail, setAuthEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhoneCode((profile as any).country_code ?? DEFAULT_PHONE_CODE);
    setPhoneNumber((profile as any).phone_number ?? "");
    setContactEmail(profile.contact_email ?? "");
    setOrgName(profile.org_name ?? "");
  }, [profile]);

  useEffect(() => {
    if (user?.email) setAuthEmail(user.email);
  }, [user?.email]);

  const countryLabel = (() => {
    const countryId = (profile as any)?.country_id as string | null | undefined;
    if (countryId) {
      const country = countries.find((item) => item.id === countryId);
      if (country) return localizedName(country);
    }
    return profile?.country ?? "—";
  })();

  const openTab = (nextTab: SettingsTab) => {
    void navigate({ to: "/settings", search: { tab: nextTab } });
  };

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!user || isAdmin) return;
    setSavingProfile(true);
    try {
      const fullPhone = phoneNumber ? `${phoneCode}${phoneNumber}` : null;
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          country_code: phoneCode,
          phone_number: phoneNumber.trim() || null,
          phone: fullPhone,
        } as any)
        .eq("id", user.id);
      if (error) throw error;
      toast.success(t("profile.savedToast"));
      queryClient.invalidateQueries({ queryKey: ["my-profile-full", user.id] });
      queryClient.invalidateQueries({ queryKey: ["current-profile", user.id] });
    } catch (error: any) {
      toast.error(error.message ?? t("common.error"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveAccountInformation(event: React.FormEvent) {
    event.preventDefault();
    if (!user || isAdmin) return;
    setSavingAccount(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          contact_email: contactEmail.trim() || null,
          org_name: isHotel ? orgName.trim() || null : profile?.org_name,
        } as any)
        .eq("id", user.id);
      if (error) throw error;
      toast.success(t("profile.settings.account.saved"));
      queryClient.invalidateQueries({ queryKey: ["my-profile-full", user.id] });
      queryClient.invalidateQueries({ queryKey: ["current-profile", user.id] });
    } catch (error: any) {
      toast.error(error.message ?? t("common.error"));
    } finally {
      setSavingAccount(false);
    }
  }

  async function changeLoginEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!authEmail || authEmail === user?.email || isAdmin) return;
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: authEmail.trim() });
      if (error) throw error;
      toast.success(t("profile.emailChangeSent"));
    } catch (error: any) {
      toast.error(error.message ?? t("common.error"));
    } finally {
      setSavingEmail(false);
    }
  }

  async function sendPasswordReset() {
    if (!user?.email) return;
    setSendingPasswordReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(t("profile.settings.account.passwordResetSent"));
    } catch (error: any) {
      toast.error(error.message ?? t("common.error"));
    } finally {
      setSendingPasswordReset(false);
    }
  }

  if (isLoading) {
    return <div className="text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={t("profile.settings.title")}
        description={t("profile.settings.description")}
        icon={Settings}
        actions={<RoleBadge role={role} />}
      />

      <Tabs
        value={tab}
        onValueChange={(value) => openTab(value as SettingsTab)}
        className="space-y-5"
      >
        <div className="overflow-x-auto pb-1">
          <TabsList
            className="h-auto min-w-max justify-start gap-1 p-1"
            aria-label={t("profile.settings.tabsLabel")}
          >
            {SETTINGS_TABS.map((item) => {
              const Icon = TAB_ICONS[item];
              return (
                <TabsTrigger key={item} value={item} className="min-h-11 gap-2 px-4">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t(`profile.settings.tabs.${item}`)}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="profile" className="space-y-5">
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
                  <ReadRow label={t("profile.phone")} value={profile?.phone} />
                  <ReadRow
                    label={t("profile.settings.profile.preferredLanguage")}
                    value={t(
                      `common.languageNames.${language === "ar" ? "arabicShort" : "englishShort"}`,
                    )}
                  />
                </div>
              ) : (
                <form method="post" onSubmit={saveProfile} className="mt-4 space-y-4">
                  <div>
                    <Label htmlFor="settings-full-name">{t("profile.fullName")}</Label>
                    <Input
                      id="settings-full-name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      maxLength={160}
                    />
                  </div>
                  <div>
                    <Label htmlFor="settings-email">{t("profile.email")}</Label>
                    <Input id="settings-email" type="email" value={user?.email ?? ""} readOnly />
                  </div>
                  <div>
                    <Label htmlFor="settings-phone-number">{t("profile.phone")}</Label>
                    <PhoneInput
                      codeId="settings-phone-code"
                      numberId="settings-phone-number"
                      codeAriaLabel={t("auth.phoneCode")}
                      numberAriaLabel={t("profile.phone")}
                      code={phoneCode}
                      number={phoneNumber}
                      onCodeChange={setPhoneCode}
                      onNumberChange={setPhoneNumber}
                    />
                  </div>
                  <div>
                    <Label htmlFor="settings-language">
                      {t("profile.settings.profile.preferredLanguage")}
                    </Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="settings-language"
                        value={t(
                          `common.languageNames.${language === "ar" ? "arabicShort" : "englishShort"}`,
                        )}
                        readOnly
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => openTab("language")}
                      >
                        <Languages className="h-4 w-4" />
                        {t("profile.settings.profile.manageLanguage")}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? t("common.loading") : t("profile.save")}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-5">
          <Card>
            <CardContent className="p-6">
              <h2 className="font-display text-xl text-primary">
                {t("profile.settings.account.information")}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <ReadRow label={t("profile.email")} value={user?.email} />
                <ReadRow label={t("profile.country")} value={countryLabel} />
                <div>
                  <p className="mb-2 text-sm font-medium">{t("profile.settings.account.role")}</p>
                  <div className="flex min-h-10 items-center rounded-md border border-input bg-background px-3">
                    <RoleBadge role={role} />
                  </div>
                </div>
                <ReadRow
                  label={t("profile.settings.account.created")}
                  value={user?.created_at ? formatDate(user.created_at) : "—"}
                />
              </div>
            </CardContent>
          </Card>

          {!isAdmin ? (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-display text-xl text-primary">
                  {t("profile.settings.account.contact")}
                </h2>
                <form method="post" onSubmit={saveAccountInformation} className="mt-4 space-y-4">
                  <div>
                    <Label htmlFor="settings-contact-email">{t("profile.contactEmail")}</Label>
                    <Input
                      id="settings-contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      maxLength={255}
                    />
                  </div>
                  {isHotel ? (
                    <div>
                      <Label htmlFor="settings-org-name">{t("profile.orgName")}</Label>
                      <Input
                        id="settings-org-name"
                        value={orgName}
                        onChange={(event) => setOrgName(event.target.value)}
                        maxLength={160}
                      />
                    </div>
                  ) : null}
                  <Button type="submit" disabled={savingAccount}>
                    {savingAccount ? t("common.loading") : t("profile.save")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="p-6">
              <h2 className="flex items-center gap-2 font-display text-xl text-primary">
                <Mail className="h-5 w-5" /> {t("profile.loginEmail")}
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
                    <Label htmlFor="settings-auth-email">{t("profile.email")}</Label>
                    <Input
                      id="settings-auth-email"
                      type="email"
                      required
                      value={authEmail}
                      onChange={(event) => setAuthEmail(event.target.value)}
                      maxLength={255}
                    />
                  </div>
                  <Button type="submit" disabled={savingEmail || authEmail === user?.email}>
                    {savingEmail ? t("common.loading") : t("profile.changeEmail")}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <h2 className="flex items-center gap-2 font-display text-lg text-primary">
                  <KeyRound className="h-5 w-5" />
                  {t("profile.settings.account.changePassword")}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("profile.settings.account.changePasswordDescription")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 min-h-11"
                  disabled={sendingPasswordReset}
                  onClick={() => void sendPasswordReset()}
                >
                  {sendingPasswordReset
                    ? t("common.loading")
                    : t("profile.settings.account.sendPasswordReset")}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h2 className="flex items-center gap-2 font-display text-lg text-primary">
                  <MonitorSmartphone className="h-5 w-5" />
                  {t("profile.settings.account.activeSessions")}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("profile.settings.account.activeSessionsPlaceholder")}
                </p>
                <Button type="button" variant="outline" className="mt-4 min-h-11" disabled>
                  {t("profile.settings.account.signOutAll")}
                </Button>
              </CardContent>
            </Card>
          </div>

          {isHotel ? (
            <>
              <Card>
                <CardContent className="p-6">
                  <h2 className="font-display text-xl text-primary">{t("profile.companyInfo")}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("profile.companyLockedHint")}
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <ReadRow label={t("profile.companyName")} value={profile?.company_name} />
                    <ReadRow label={t("profile.vatNumber")} value={profile?.vat_number} />
                    <ReadRow label={t("profile.crNumber")} value={profile?.cr_number} />
                    <ReadRow label={t("profile.idNumber")} value={profile?.id_number} />
                  </div>
                </CardContent>
              </Card>
              {user ? <PmsSection userId={user.id} profile={profile} /> : null}
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardContent className="p-6">
              <h2 className="flex items-center gap-2 font-display text-xl text-primary">
                <Bell className="h-5 w-5" /> {t("profile.notifications.title")}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("profile.notifications.description")}
              </p>
              <Button asChild variant="outline" className="mt-4 min-h-11">
                <Link to="/dashboard/notifications">
                  <Bell className="h-4 w-4" />
                  {t("profile.notifications.open")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="language">
          <Card>
            <CardContent className="p-6">
              <h2 className="flex items-center gap-2 font-display text-xl text-primary">
                <Languages className="h-5 w-5" /> {t("profile.language.title")}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("profile.language.description")}
              </p>
              <div
                className="mt-4 grid max-w-md grid-cols-1 gap-2 sm:grid-cols-2"
                role="group"
                aria-label={t("profile.language.title")}
              >
                {(["en", "ar"] as const).map((locale) => (
                  <Button
                    key={locale}
                    type="button"
                    variant={language === locale ? "default" : "outline"}
                    className="min-h-11"
                    aria-pressed={language === locale}
                    onClick={() => void setLanguage(locale)}
                  >
                    {t(`common.languageNames.${locale === "ar" ? "arabicShort" : "englishShort"}`)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <h2 className="flex items-center gap-2 font-display text-xl text-primary">
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
            <Card>
              <CardContent className="p-6">
                <h2 className="flex items-center gap-2 font-display text-xl text-primary">
                  <ShieldCheck className="h-5 w-5" />
                  {t("profile.settings.security.mfa")}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("profile.settings.security.mfaPlaceholder")}
                </p>
                <Button type="button" variant="outline" className="mt-4 min-h-11" disabled>
                  {t("common.soon")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
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
