import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/site-header";
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

type Search = { redirect?: string };

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — GroupToStay" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({ redirect: typeof s.redirect === "string" ? s.redirect : undefined }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const { user } = useAuth();
  const { data: countries = [] } = useCountries();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
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
  const [apiAvailable, setApiAvailable] = useState<"" | "Yes" | "No" | "Not Sure">("");
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
    if (user) navigate({ to: (search.redirect as any) ?? "/dashboard" });
  }, [user, navigate, search.redirect]);

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
        setMode("signin");
      } else if (mode === "signup") {
        if (role === "hotel" && (!companyName.trim() || !vatNumber.trim() || !crNumber.trim())) {
          throw new Error(t("auth.errors.companyRequired"));
        }
        if (role === "organizer" && idNumber.length !== 10) {
          throw new Error("ID number must be 10 digits");
        }
        if (!countryId) throw new Error("Please select your country");
        if (!phoneNumber.trim()) throw new Error("Please enter your phone number");

        const country = countries.find(c => c.id === countryId);
        const fullPhone = `${phoneCode}${phoneNumber}`;
        const orgName = role === "hotel" ? companyName : (agencyName.trim() || fullName);
        const data: Record<string, string> = {
          full_name: fullName,
          org_name: orgName,
          phone: fullPhone,
          country_code: phoneCode,
          phone_number: phoneNumber,
          country_id: countryId,
          country: country?.name_en ?? "",
          role,
        };
        if (role === "hotel") {
          data.company_name = companyName;
          data.vat_number = vatNumber;
          data.cr_number = crNumber;
          data.contact_email = contactEmail || email;
          if (pmsEnabled) {
            data.pms_enabled = pmsEnabled === "yes" ? "true" : "false";
            if (pmsEnabled === "yes") {
              const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!pmsProvider) throw new Error("Please select your PMS provider");
              if (pmsProvider === "Other" && !pmsProviderOther.trim()) throw new Error("Please specify your PMS provider");
              if (!apiAvailable) throw new Error("Please select API availability");
              if (!techName.trim()) throw new Error("Technical contact name is required");
              if (!emailRx.test(techEmail.trim())) throw new Error("Invalid technical contact email");
              if (!/^[+\d][\d\s\-()]{5,}$/.test(techPhone.trim())) throw new Error("Invalid technical contact phone");
              data.pms_provider = pmsProvider;
              if (pmsProvider === "Other") data.pms_provider_other = pmsProviderOther.trim();
              data.api_available = apiAvailable;
              data.technical_contact_name = techName.trim();
              data.technical_contact_email = techEmail.trim();
              data.technical_contact_phone = techPhone.trim();
            }
          }
        } else {
          data.id_type = idType;
          data.id_number = idNumber;
        }

        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
            data,
          },
        });
        if (error) throw error;
        toast.success(role === "hotel" ? t("auth.hotelPendingNotice") : t("auth.checkEmail"));
        setMode("signin");
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

  const title = mode === "signin" ? t("auth.signInTitle") : mode === "signup" ? t("auth.signUpTitle") : t("auth.resetPasswordTitle");

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1 container-page py-16 max-w-md w-full mx-auto">
        <Card><CardContent className="p-6">
          <h1 className="font-display text-2xl text-primary">{title}</h1>
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            {mode === "forgot" && (
              <p className="text-sm text-muted-foreground">{t("auth.forgotIntro")}</p>
            )}

            {mode === "signup" && (<>
              <div>
                <Label>{t("auth.accountType")}</Label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(["organizer","hotel"] as const).map(r => (
                    <button type="button" key={r} onClick={() => setRole(r)}
                      className={`rounded-md border px-3 py-2 text-sm text-start ${role === r ? "border-gold bg-gold/10 text-foreground" : "border-input bg-background text-muted-foreground"}`}>
                      <div className="font-medium text-foreground">{t(`auth.role.${r}`)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{t(`auth.roleDesc.${r}`)}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div><Label>{t("auth.fullName")}</Label><Input required value={fullName} onChange={e => setFullName(e.target.value)} maxLength={120} /></div>
              <div>
                <Label>{t("auth.phone")}</Label>
                <PhoneInput code={phoneCode} number={phoneNumber} onCodeChange={setPhoneCode} onNumberChange={setPhoneNumber} required />
              </div>
              <div>
                <Label>{t("auth.country")} <span className="text-destructive">*</span></Label>
                <CountrySelect
                  value={countryId}
                  onChange={setCountryId}
                  filterCodes={role === "hotel" ? ["SA","EG","AE","KW","BH","OM","QA","JO","MA","TR"] : undefined}
                />
              </div>

              {role === "hotel" && (
                <div className="rounded-md border border-border bg-accent/30 p-3 space-y-3">
                  <div className="text-xs text-muted-foreground">{t("auth.hotelExtraIntro")}</div>
                  <div><Label>{t("auth.companyName")}</Label><Input required value={companyName} onChange={e => setCompanyName(e.target.value)} maxLength={160} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t("auth.vatNumber")}</Label><Input required value={vatNumber} onChange={e => setVatNumber(e.target.value)} maxLength={40} /></div>
                    <div><Label>{t("auth.crNumber")}</Label><Input required value={crNumber} onChange={e => setCrNumber(e.target.value)} maxLength={40} /></div>
                  </div>
                  <div><Label>{t("auth.contactEmail")}</Label><Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder={t("auth.contactEmailPh")} /></div>
                </div>
              )}

              {role === "hotel" && (
                <div className="rounded-md border border-border bg-accent/30 p-3 space-y-3">
                  <div className="font-display text-base text-primary">Property Management System (PMS)</div>
                  <div className="text-xs text-muted-foreground">Optional — helps us prepare future integrations.</div>
                  <div>
                    <Label>Do you use a Property Management System?</Label>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      {(["yes","no"] as const).map(v => (
                        <button type="button" key={v} onClick={() => setPmsEnabled(v)}
                          className={`rounded-md border px-3 py-2 text-sm capitalize ${pmsEnabled === v ? "border-gold bg-gold/10 text-foreground" : "border-input bg-background text-muted-foreground"}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  {pmsEnabled === "yes" && (
                    <>
                      <div>
                        <Label>PMS Provider</Label>
                        <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={pmsProvider} onChange={e => setPmsProvider(e.target.value)}>
                          <option value="">Select…</option>
                          {["MyCloud PMS","Oracle Opera PMS","Cloudbeds","Mews","eZee Absolute","Hotelogix","Protel","Other"].map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      {pmsProvider === "Other" && (
                        <div>
                          <Label>Please specify PMS</Label>
                          <Input value={pmsProviderOther} onChange={e => setPmsProviderOther(e.target.value)} maxLength={120} />
                        </div>
                      )}
                      <div>
                        <Label>API Available?</Label>
                        <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={apiAvailable} onChange={e => setApiAvailable(e.target.value as any)}>
                          <option value="">Select…</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                          <option value="Not Sure">Not Sure</option>
                        </select>
                      </div>
                      <div><Label>Technical Contact Name</Label><Input value={techName} onChange={e => setTechName(e.target.value)} maxLength={160} /></div>
                      <div><Label>Technical Contact Email</Label><Input type="email" value={techEmail} onChange={e => setTechEmail(e.target.value)} maxLength={255} /></div>
                      <div><Label>Technical Contact Phone</Label><Input value={techPhone} onChange={e => setTechPhone(e.target.value)} maxLength={40} placeholder="+966 5..." /></div>
                    </>
                  )}
                </div>

              )}

              {role === "organizer" && (
                <div className="rounded-md border border-border bg-accent/30 p-3 space-y-3">
                  <div className="text-xs text-muted-foreground">{t("auth.organizerIdIntro")}</div>
                  <div>
                    <Label>{t("auth.idType")}</Label>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      {(["saudi_id","iqama"] as const).map(it => (
                        <button type="button" key={it} onClick={() => setIdType(it)}
                          className={`rounded-md border px-3 py-2 text-sm ${idType === it ? "border-gold bg-gold/10 text-foreground" : "border-input bg-background text-muted-foreground"}`}>
                          {t(`auth.idTypes.${it}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>{t(`auth.idNumberLabel.${idType}`)}</Label>
                    <Input
                      required
                      value={idNumber}
                      onChange={e => setIdNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      inputMode="numeric"
                    />
                  </div>
                </div>
              )}
            </>)}
            <div><Label>{t("auth.email")}</Label><Input type="email" required={mode !== "signup"} value={email} onChange={e => setEmail(e.target.value)} /></div>
            {mode !== "forgot" && (
              <div>
                <Label>{t("auth.password")}</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}
            {mode === "signin" && (
              <div className="text-right">
                <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("forgot")}>
                  {t("auth.forgotPassword")}
                </button>
              </div>
            )}
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {mode === "signin" ? t("auth.submitSignIn") : mode === "signup" ? t("auth.submitSignUp") : t("auth.sendResetLink")}
            </Button>
          </form>
          <button type="button" className="mt-4 text-sm text-muted-foreground hover:text-foreground w-full text-center" onClick={() => setMode(m => m === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}
          </button>
          <div className="mt-4 text-center text-xs text-muted-foreground"><Link to="/">← Home</Link></div>
        </CardContent></Card>
      </main>
      <SiteFooter />
    </div>
  );
}
