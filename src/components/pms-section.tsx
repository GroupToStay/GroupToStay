import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Server } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const PROVIDERS = ["MyCloud PMS","Oracle Opera PMS","Cloudbeds","Mews","eZee Absolute","Hotelogix","Protel","Other"];

export function PmsSection({ userId, profile }: { userId: string; profile: any }) {
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
        if (!provider) throw new Error("Please select your PMS provider");
        if (provider === "Other" && !otherProvider.trim()) throw new Error("Please specify your PMS provider");
        if (!api) throw new Error("Please select API availability");
        if (!name.trim()) throw new Error("Technical contact name is required");
        if (!emailRx.test(email.trim())) throw new Error("Invalid technical contact email");
        if (!/^[+\d][\d\s\-()]{5,}$/.test(phone.trim())) throw new Error("Invalid technical contact phone");
      }
      const patch: any = {
        pms_enabled: enabled === "" ? null : enabled === "yes",
        pms_provider: enabled === "yes" ? provider : null,
        pms_provider_other: enabled === "yes" && provider === "Other" ? otherProvider.trim() : null,
        api_available: enabled === "yes" ? api : null,
        technical_contact_name: enabled === "yes" ? name.trim() : null,
        technical_contact_email: enabled === "yes" ? email.trim() : null,
        technical_contact_phone: enabled === "yes" ? phone.trim() : null,
      };
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (error) throw error;
      toast.success("PMS information saved");
      qc.invalidateQueries({ queryKey: ["my-profile-full", userId] });
    } catch (err: any) {
      toast.error(err.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card><CardContent className="p-6">
      <h2 className="font-display text-xl text-primary flex items-center gap-2">
        <Server className="h-5 w-5" /> PMS Information
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Optional. Helps us prepare future PMS integrations.</p>
      <form onSubmit={save} className="mt-4 space-y-4">
        <div>
          <Label>Do you use a Property Management System?</Label>
          <div className="mt-1 grid grid-cols-2 gap-2 max-w-xs">
            {(["yes","no"] as const).map(v => (
              <button type="button" key={v} onClick={() => setEnabled(v)}
                className={`rounded-md border px-3 py-2 text-sm capitalize ${enabled === v ? "border-gold bg-gold/10 text-foreground" : "border-input bg-background text-muted-foreground"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
        {enabled === "yes" && (
          <>
            <div>
              <Label>PMS Provider</Label>
              <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={provider} onChange={e => setProvider(e.target.value)}>
                <option value="">Select…</option>
                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {provider === "Other" && (
              <div>
                <Label>Please specify PMS</Label>
                <Input value={otherProvider} onChange={e => setOtherProvider(e.target.value)} maxLength={120} />
              </div>
            )}
            <div>
              <Label>API Available?</Label>
              <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={api} onChange={e => setApi(e.target.value as any)}>
                <option value="">Select…</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Not Sure">Not Sure</option>
              </select>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>Technical Contact Name</Label><Input value={name} onChange={e => setName(e.target.value)} maxLength={160} /></div>
              <div><Label>Technical Contact Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={255} /></div>
              <div className="sm:col-span-2"><Label>Technical Contact Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} maxLength={40} placeholder="+966 5..." /></div>
            </div>
          </>
        )}
        <Button type="submit" variant="gold" disabled={saving}>{saving ? "Saving…" : "Save PMS Information"}</Button>
      </form>
    </CardContent></Card>
  );
}
