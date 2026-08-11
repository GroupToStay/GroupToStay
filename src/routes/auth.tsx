import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PublicSiteHeader } from "@/components/public-site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { PhoneInput } from "@/components/phone-input";
import { CountrySelect } from "@/components/country-select";
import { useCountries } from "@/hooks/use-master-data";
import { DEFAULT_PHONE_CODE } from "@/lib/phone-codes";
import i18n from "@/lib/i18n";

export type AuthMode = "signin" | "signup" | "forgot";
type Search = { redirect?: string; mode?: AuthMode };

export function parseAuthSearch(search: Record<string, unknown>): Search {
  const mode =
    search.mode === "signin" || search.mode === "signup" || search.mode === "forgot"
      ? search.mode
      : undefined;
  return {
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    mode,
  };
}

const PMS_PROVIDER_OPTIONS = [
  { value: "MyCloud PMS", labelKey: "auth.pms.providers.mycloud" },
  { value: "Oracle Opera PMS", labelKey: "auth.pms.providers.oracleOpera" },
  { value: "Cloudbeds", labelKey: "auth.pms.providers.cloudbeds" },
  { value: "Mews", labelKey: "auth.pms.providers.mews" },
  { value: "eZee Absolute", labelKey: "auth.pms.providers.ezeeAbsolute" },
  { value: "Hotelogix", labelKey: "auth.pms.providers.hotelogix" },
  { value: "Protel", labelKey: "auth.pms.providers.protel" },
  { value: "Other", labelKey: "auth.pms.providers.other" },
] as const;
const OTHER_PMS_PROVIDER = "Other";
const API_AVAILABILITY_OPTIONS = [
  { value: "Yes", labelKey: "auth.pms.yes" },
  { value: "No", labelKey: "auth.pms.no" },
  { value: "Not Sure", labelKey: "auth.pms.notSure" },
] as const;
type ApiAvailability = (typeof API_AVAILABILITY_OPTIONS)[number]["value"];

function safeAuthRedirect(redirect?: string): string {
  const fallback = "/dashboard";
  if (!redirect) return fallback;

  const target = redirect.trim();
  if (
    !target.startsWith("/") ||
    target.startsWith("//") ||
    target.includes("\\") ||
    target.startsWith("/auth")
  ) {
    return fallback;
  }

  return target;
}

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: i18n.t("auth.metaTitle") }] }),
  validateSearch: parseAuthSearch,
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const { user } = useAuth();
  const { data: countries = [] } = useCountries();
  const mode = search.mode ?? "signin";
  const [role, setRole] = useState<"organizer" | "hotel">("organizer");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneCode, setPhoneCode] = useState(DEFAULT_PHONE_CODE);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryId, setCountryId] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // PMS (hotel only, optional)
  const [pmsEnabled, setPmsEnabled] = useState<"yes" | "no" | "">("");
  const [pmsProvider, setPmsProvider] = useState("");
  const [pmsProviderOther, setPmsProviderOther] = useState("");
  const [apiAvailable, setApiAvailable] = useState<"" | ApiAvailability>("");
  const [techName, setTechName] = useState("");
  const [techEmail, setTechEmail] = useState("");
  const [techPhone, setTechPhone] = useState("");

  const [idType, setIdType] = useState<"saudi_id" | "iqama">("saudi_id");
  const [idNumber, setIdNumber] = useState("");

  // Agency-only fields
  const [agencyName, setAgencyName] = useState("");
  const [agencyType, setAgencyType] = useState<string>("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [website, setWebsite] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: safeAuthRedirect(search.redirect as string | undefined) as any });
  }, [user, navigate, search.redirect]);

  function changeMode(nextMode: AuthMode) {
    void navigate({
      to: "/auth",
      search: {
        redirect: search.redirect,
        mode: nextMode === "signin" ? undefined : nextMode,
      },
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t("auth.resetLinkSent"));
        changeMode("signin");
      } else if (mode === "signup") {
        if (role === "hotel" && (!companyName.trim() || !vatNumber.trim() || !crNumber.trim())) {
          throw new Error(t("auth.errors.companyRequired"));
        }
        if (role === "hotel" && !countryId) throw new Error(t("auth.errors.countryRequired"));
        if (!phoneNumber.trim()) throw new Error(t("auth.errors.phoneRequired"));

        const country = countries.find((c) => c.id === countryId);
        const fullPhone = `${phoneCode}${phoneNumber}`;
        const orgName = role === "hotel" ? companyName : fullName;
        const data: Record<string, string> = {
          full_name: fullName,
          org_name: orgName,
          phone: fullPhone,
          country_code: phoneCode,
          phone_number: phoneNumber,
          role,
        };
        if (countryId) {
          data.country_id = countryId;
          data.country = country?.name_en ?? "";
        }
        if (role === "hotel") {
          data.company_name = companyName;
          data.vat_number = vatNumber;
          data.cr_number = crNumber;
          data.contact_email = contactEmail || email;
          if (pmsEnabled) {
            data.pms_enabled = pmsEnabled === "yes" ? "true" : "false";
            if (pmsEnabled === "yes") {
              const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!pmsProvider) throw new Error(t("auth.pms.errors.providerRequired"));
              if (pmsProvider === OTHER_PMS_PROVIDER && !pmsProviderOther.trim())
                throw new Error(t("auth.pms.errors.providerOtherRequired"));
              if (!apiAvailable) throw new Error(t("auth.pms.errors.apiRequired"));
              if (!techName.trim()) throw new Error(t("auth.pms.errors.techNameRequired"));
              if (!emailRx.test(techEmail.trim()))
                throw new Error(t("auth.pms.errors.techEmailInvalid"));
              if (!/^[+\d][\d\s\-()]{5,}$/.test(techPhone.trim()))
                throw new Error(t("auth.pms.errors.techPhoneInvalid"));
              data.pms_provider = pmsProvider;
              if (pmsProvider === OTHER_PMS_PROVIDER)
                data.pms_provider_other = pmsProviderOther.trim();
              data.api_available = apiAvailable;
              data.technical_contact_name = techName.trim();
              data.technical_contact_email = techEmail.trim();
              data.technical_contact_phone = techPhone.trim();
            }
          }
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
            data,
          },
        });
        if (error) throw error;
        toast.success(role === "hotel" ? t("auth.hotelPendingNotice") : t("auth.checkEmail"));
        changeMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      toast.error(e?.message ?? t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  const title =
    mode === "signin"
      ? t("auth.signInTitle")
      : mode === "signup"
        ? t("auth.signUpTitle")
        : t("auth.resetPasswordTitle");

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <PublicSiteHeader />
      <main className="container-page w-full flex-1 py-10 md:py-14">
        <div className={mode === "signup" ? "mx-auto max-w-3xl" : "mx-auto max-w-lg"}>
          <Card className="overflow-hidden border-t-4 border-t-gold">
            <CardContent className="p-6 md:p-8">
              <div className="border-b border-border pb-5">
                <h1 className="font-display text-2xl text-primary md:text-3xl">{title}</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {mode === "signup"
                    ? t(`auth.roleDesc.${role}`)
                    : mode === "forgot"
                      ? t("auth.forgotIntro")
                      : t("common.brand.tagline")}
                </p>
              </div>
              <form method="post" onSubmit={onSubmit} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <>
                    <div>
                      <Label>{t("auth.accountType")}</Label>
                      <div
                        className="mt-1 grid grid-cols-2 gap-2"
                        role="group"
                        aria-label={t("auth.accountType")}
                      >
                        {(["organizer", "hotel"] as const).map((r) => (
                          <button
                            type="button"
                            key={r}
                            aria-pressed={role === r}
                            onClick={() => setRole(r)}
                            className={`min-h-24 rounded-lg border p-4 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${role === r ? "border-primary bg-primary/5 text-foreground shadow-sm" : "border-input bg-background text-muted-foreground hover:border-primary/25 hover:bg-surface"}`}
                          >
                            <div className="font-medium text-foreground">{t(`auth.role.${r}`)}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {t(`auth.roleDesc.${r}`)}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="auth-full-name">{t("auth.fullName")}</Label>
                      <Input
                        id="auth-full-name"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        maxLength={120}
                      />
                    </div>
                    <div>
                      <Label htmlFor="auth-phone-number">{t("auth.phone")}</Label>
                      <PhoneInput
                        codeId="auth-phone-code"
                        numberId="auth-phone-number"
                        codeAriaLabel={t("auth.phoneCode")}
                        numberAriaLabel={t("auth.phone")}
                        code={phoneCode}
                        number={phoneNumber}
                        onCodeChange={setPhoneCode}
                        onNumberChange={setPhoneNumber}
                        required
                      />
                    </div>
                    {role === "hotel" && (
                      <div>
                        <Label htmlFor="auth-country">
                          {t("auth.country")} <span className="text-destructive">*</span>
                        </Label>
                        <CountrySelect
                          id="auth-country"
                          aria-label={t("auth.country")}
                          value={countryId}
                          onChange={setCountryId}
                          filterCodes={["SA", "EG", "AE", "KW", "BH", "OM", "QA", "JO", "MA", "TR"]}
                        />
                      </div>
                    )}

                    {role === "hotel" && (
                      <div className="space-y-4 rounded-lg border border-border bg-surface p-4 md:p-5">
                        <div className="text-xs text-muted-foreground">
                          {t("auth.hotelExtraIntro")}
                        </div>
                        <div>
                          <Label htmlFor="auth-company-name">{t("auth.companyName")}</Label>
                          <Input
                            id="auth-company-name"
                            required
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            maxLength={160}
                          />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="auth-vat-number">{t("auth.vatNumber")}</Label>
                            <Input
                              id="auth-vat-number"
                              required
                              value={vatNumber}
                              onChange={(e) => setVatNumber(e.target.value)}
                              maxLength={40}
                            />
                          </div>
                          <div>
                            <Label htmlFor="auth-cr-number">{t("auth.crNumber")}</Label>
                            <Input
                              id="auth-cr-number"
                              required
                              value={crNumber}
                              onChange={(e) => setCrNumber(e.target.value)}
                              maxLength={40}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="auth-contact-email">{t("auth.contactEmail")}</Label>
                          <Input
                            id="auth-contact-email"
                            type="email"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            placeholder={t("auth.contactEmailPh")}
                          />
                        </div>
                      </div>
                    )}

                    {role === "hotel" && (
                      <div className="space-y-4 rounded-lg border border-border bg-surface p-4 md:p-5">
                        <div className="text-base font-semibold text-foreground">
                          {t("auth.pms.title")}
                        </div>
                        <div className="text-xs text-muted-foreground">{t("auth.pms.intro")}</div>
                        <div>
                          <Label>{t("auth.pms.question")}</Label>
                          <div
                            className="mt-1 grid grid-cols-2 gap-2"
                            role="group"
                            aria-label={t("auth.pms.question")}
                          >
                            {(["yes", "no"] as const).map((v) => (
                              <button
                                type="button"
                                key={v}
                                aria-pressed={pmsEnabled === v}
                                onClick={() => setPmsEnabled(v)}
                                className={`min-h-10 rounded-md border px-3 py-2 text-sm ${pmsEnabled === v ? "border-primary bg-primary/5 text-foreground" : "border-input bg-background text-muted-foreground"}`}
                              >
                                {t(`auth.pms.${v}`)}
                              </button>
                            ))}
                          </div>
                        </div>
                        {pmsEnabled === "yes" && (
                          <>
                            <div>
                              <Label htmlFor="auth-pms-provider">{t("auth.pms.provider")}</Label>
                              <select
                                id="auth-pms-provider"
                                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={pmsProvider}
                                onChange={(e) => setPmsProvider(e.target.value)}
                              >
                                <option value="">{t("auth.pms.select")}</option>
                                {PMS_PROVIDER_OPTIONS.map((provider) => (
                                  <option key={provider.value} value={provider.value}>
                                    {t(provider.labelKey)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {pmsProvider === OTHER_PMS_PROVIDER && (
                              <div>
                                <Label htmlFor="auth-pms-provider-other">
                                  {t("auth.pms.specifyProvider")}
                                </Label>
                                <Input
                                  id="auth-pms-provider-other"
                                  value={pmsProviderOther}
                                  onChange={(e) => setPmsProviderOther(e.target.value)}
                                  maxLength={120}
                                />
                              </div>
                            )}
                            <div>
                              <Label htmlFor="auth-pms-api">{t("auth.pms.apiAvailable")}</Label>
                              <select
                                id="auth-pms-api"
                                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={apiAvailable}
                                onChange={(e) => setApiAvailable(e.target.value as any)}
                              >
                                <option value="">{t("auth.pms.select")}</option>
                                {API_AVAILABILITY_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {t(option.labelKey)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <Label htmlFor="auth-tech-name">
                                {t("auth.pms.technicalContactName")}
                              </Label>
                              <Input
                                id="auth-tech-name"
                                value={techName}
                                onChange={(e) => setTechName(e.target.value)}
                                maxLength={160}
                              />
                            </div>
                            <div>
                              <Label htmlFor="auth-tech-email">
                                {t("auth.pms.technicalContactEmail")}
                              </Label>
                              <Input
                                id="auth-tech-email"
                                type="email"
                                value={techEmail}
                                onChange={(e) => setTechEmail(e.target.value)}
                                maxLength={255}
                              />
                            </div>
                            <div>
                              <Label htmlFor="auth-tech-phone">
                                {t("auth.pms.technicalContactPhone")}
                              </Label>
                              <Input
                                id="auth-tech-phone"
                                value={techPhone}
                                onChange={(e) => setTechPhone(e.target.value)}
                                maxLength={40}
                                placeholder="+966 5..."
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {role === "organizer" && (
                      <div className="rounded-lg border border-gold/25 bg-gold/10 p-4 text-sm leading-6 text-foreground">
                        {t("auth.agencyVerificationNotice")}
                      </div>
                    )}
                  </>
                )}
                <div>
                  <Label htmlFor="auth-email">{t("auth.email")}</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {mode !== "forgot" && (
                  <div>
                    <Label htmlFor="auth-password">{t("auth.password")}</Label>
                    <div className="relative mt-1">
                      <Input
                        id="auth-password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pe-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 end-0 flex w-10 items-center justify-center rounded-e-md text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                )}
                {mode === "signin" && (
                  <div className="text-end">
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => changeMode("forgot")}
                    >
                      {t("auth.forgotPassword")}
                    </button>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {mode === "signin"
                    ? t("auth.submitSignIn")
                    : mode === "signup"
                      ? t("auth.submitSignUp")
                      : t("auth.sendResetLink")}
                </Button>
              </form>
              <button
                type="button"
                className="mt-5 w-full rounded-md py-2 text-center text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => changeMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}
              </button>
              <div className="mt-4 text-center text-xs text-muted-foreground">
                <Link to="/" className="underline-offset-4 hover:text-foreground hover:underline">
                  {t("auth.backHome")}
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
