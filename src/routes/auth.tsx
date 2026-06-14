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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<"organizer" | "hotel">("organizer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: (search.redirect as any) ?? "/dashboard" });
  }, [user, navigate, search.redirect]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
            data: { full_name: fullName, org_name: orgName, phone, country, role },
          },
        });
        if (error) throw error;
        toast.success(t("auth.checkEmail"));
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

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1 container-page py-16 max-w-md w-full mx-auto">
        <Card><CardContent className="p-6">
          <h1 className="font-display text-2xl text-primary">{mode === "signin" ? t("auth.signInTitle") : t("auth.signUpTitle")}</h1>
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
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
              <div><Label>{t("auth.orgName")}</Label><Input required value={orgName} onChange={e => setOrgName(e.target.value)} maxLength={160} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("auth.phone")}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} maxLength={40} /></div>
                <div><Label>{t("auth.country")}</Label><Input value={country} onChange={e => setCountry(e.target.value)} maxLength={80} /></div>
              </div>
            </>)}
            <div><Label>{t("auth.email")}</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><Label>{t("auth.password")}</Label><Input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {mode === "signin" ? t("auth.submitSignIn") : t("auth.submitSignUp")}
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
