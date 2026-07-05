import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Server } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

const PROVIDERS = [
  { value: "MyCloud PMS", labelKey: "auth.pms.providers.mycloud" },
  { value: "Oracle Opera PMS", labelKey: "auth.pms.providers.oracleOpera" },
  { value: "Cloudbeds", labelKey: "auth.pms.providers.cloudbeds" },
  { value: "Mews", labelKey: "auth.pms.providers.mews" },
  { value: "eZee Absolute", labelKey: "auth.pms.providers.ezeeAbsolute" },
  { value: "Hotelogix", labelKey: "auth.pms.providers.hotelogix" },
  { value: "Protel", labelKey: "auth.pms.providers.protel" },
  { value: "Other", labelKey: "auth.pms.providers.other" },
] as const;

const API_AVAILABILITY_OPTIONS = [
  { value: "Yes", labelKey: "auth.pms.yes" },
  { value: "No", labelKey: "auth.pms.no" },
  { value: "Not Sure", labelKey: "auth.pms.notSure" },
] as const;
const PMS_OTHER_PROVIDER = "Other";

export function PmsSection({ userId, profile }: { userId: string; profile: any }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState<"yes" | "no" | "">("");
  const [provider, setProvider] = useState("");
  const [otherProvider, setOtherProvider] = useState("");
  const [api, setApi] = useState<"" | "Yes" | "No" | "Not Sure">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setEnabled(profile.pms_enabled === true ? "yes" : profile.pms_enabled === false ? "no" : "");
    setProvider(profile.pms_provider ?? "");
    setOtherProvider(profile.pms_provider_other ?? "");
    setApi((profile.api_available as any) ?? "");
    setName(profile.technical_contact_name ?? "");
    setEmail(profile.technical_contact_email ?? "");
    setPhone(profile.technical_contact_phone ?? "");
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (enabled === "yes") {
        const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!provider) throw new Error(t("auth.pms.errors.providerRequired"));
        if (provider === PMS_OTHER_PROVIDER && !otherProvider.trim())
          throw new Error(t("auth.pms.errors.providerOtherRequired"));
        if (!api) throw new Error(t("auth.pms.errors.apiRequired"));
        if (!name.trim()) throw new Error(t("auth.pms.errors.techNameRequired"));
        if (!emailRx.test(email.trim())) throw new Error(t("auth.pms.errors.techEmailInvalid"));
        if (!/^[+\d][\d\s\-()]{5,}$/.test(phone.trim()))
          throw new Error(t("auth.pms.errors.techPhoneInvalid"));
      }
      const patch: any = {
        pms_enabled: enabled === "" ? null : enabled === "yes",
        pms_provider: enabled === "yes" ? provider : null,
        pms_provider_other:
          enabled === "yes" && provider === PMS_OTHER_PROVIDER ? otherProvider.trim() : null,
        api_available: enabled === "yes" ? api : null,
        technical_contact_name: enabled === "yes" ? name.trim() : null,
        technical_contact_email: enabled === "yes" ? email.trim() : null,
        technical_contact_phone: enabled === "yes" ? phone.trim() : null,
      };
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (error) throw error;
      toast.success(t("auth.pms.saved"));
      qc.invalidateQueries({ queryKey: ["my-profile-full", userId] });
    } catch (err: any) {
      toast.error(err.message ?? t("auth.pms.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-display text-xl text-primary flex items-center gap-2">
          <Server className="h-5 w-5" /> {t("auth.pms.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.pms.intro")}</p>
        <form onSubmit={save} className="mt-4 space-y-4">
          <div>
            <Label>{t("auth.pms.question")}</Label>
            <div className="mt-1 grid grid-cols-2 gap-2 max-w-xs">
              {(["yes", "no"] as const).map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setEnabled(v)}
                  className={`rounded-md border px-3 py-2 text-sm capitalize ${enabled === v ? "border-gold bg-gold/10 text-foreground" : "border-input bg-background text-muted-foreground"}`}
                >
                  {t(`auth.pms.${v}`)}
                </button>
              ))}
            </div>
          </div>
          {enabled === "yes" && (
            <>
              <div>
                <Label>{t("auth.pms.provider")}</Label>
                <select
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                >
                  <option value="">{t("auth.pms.select")}</option>
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {t(p.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              {provider === PMS_OTHER_PROVIDER && (
                <div>
                  <Label>{t("auth.pms.specifyProvider")}</Label>
                  <Input
                    value={otherProvider}
                    onChange={(e) => setOtherProvider(e.target.value)}
                    maxLength={120}
                  />
                </div>
              )}
              <div>
                <Label>{t("auth.pms.apiAvailable")}</Label>
                <select
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={api}
                  onChange={(e) => setApi(e.target.value as any)}
                >
                  <option value="">{t("auth.pms.select")}</option>
                  {API_AVAILABILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t("auth.pms.technicalContactName")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />
                </div>
                <div>
                  <Label>{t("auth.pms.technicalContactEmail")}</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>{t("auth.pms.technicalContactPhone")}</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={40}
                    placeholder="+966 5..."
                  />
                </div>
              </div>
            </>
          )}
          <Button type="submit" variant="gold" disabled={saving}>
            {saving ? t("auth.pms.saving") : t("auth.pms.save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
