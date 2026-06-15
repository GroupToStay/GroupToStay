import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — GroupToStay" }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validRecovery, setValidRecovery] = useState<boolean | null>(null);

  useEffect(() => {
    // Supabase recovery links set type=recovery in the URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setValidRecovery(true);
    } else {
      setValidRecovery(false);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("auth.resetSuccess"));
      setTimeout(() => {
        window.location.href = "/auth";
      }, 1500);
    } catch (err: any) {
      toast.error(err?.message ?? t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1 container-page py-16 max-w-md w-full mx-auto">
        <Card>
          <CardContent className="p-6">
            <h1 className="font-display text-2xl text-primary">
              {t("auth.resetPasswordTitle")}
            </h1>

            {validRecovery === null && (
              <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p>
            )}

            {validRecovery === false && (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-destructive">{t("auth.resetInvalid")}</p>
                <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground underline">
                  {t("auth.signInTitle")}
                </Link>
              </div>
            )}

            {validRecovery === true && (
              <form onSubmit={onSubmit} className="mt-4 space-y-3">
                <div>
                  <Label>{t("auth.newPassword")}</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                  {t("auth.resetPasswordBtn")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
