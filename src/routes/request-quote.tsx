import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { CountryCitySelect } from "@/components/country-city-select";
import { useCities, useCountries } from "@/hooks/use-master-data";

type Search = { city?: string; country?: string };

export const Route = createFileRoute("/request-quote")({
  head: () => ({ meta: [{ title: "Request a group quote — GroupToStay" }, { name: "description", content: "Submit one group accommodation request and receive competing hotel quotations." }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    city: typeof s.city === "string" ? s.city : undefined,
    country: typeof s.country === "string" ? s.country : undefined,
  }),
  component: Page,
});

const Schema = z.object({
  title: z.string().min(3).max(160),
  group_type: z.enum(["umrah","hajj","tourism","corporate","government","sports","education","event","other"]),
  destination_country_id: z.string().uuid({ message: "Please select a country." }),
  destination_city_id: z.string().uuid({ message: "Please select a city." }),
  check_in: z.string().min(1),
  check_out: z.string().min(1),
  guests_count: z.number().int().min(1).max(100000),
  rooms_needed: z.number().int().min(1).max(10000),
  room_type_pref: z.string().max(120).optional().or(z.literal("")),
  board_type: z.enum(["room_only","breakfast","half_board","full_board"]),
  budget_min: z.number().optional(),
  budget_max: z.number().optional(),
  currency: z.string().min(1).max(8),
  deadline: z.string().optional().or(z.literal("")),
  special_requirements: z.string().max(2000).optional().or(z.literal("")),
});

function Page() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: "/request-quote" });
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isOrganizer, loading: rolesLoading } = useRoles();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const blocked = !!user && !rolesLoading && !isOrganizer;
  useEffect(() => {
    if (blocked) {
      toast.info(
        isAdmin
          ? "Admins cannot submit quote requests."
          : t("rfq.hotelCannotRequest", { defaultValue: "Hotel accounts cannot submit quote requests." })
      );
    }
  }, [blocked, isAdmin, t]);
  const [form, setForm] = useState({
    title: "",
    group_type: "umrah" as const,
    destination_city: search.city ?? "",
    destination_country: search.country ?? "",
    check_in: "",
    check_out: "",
    guests_count: 30,
    rooms_needed: 10,
    room_type_pref: "",
    board_type: "breakfast" as const,
    budget_min: "" as string | number,
    budget_max: "" as string | number,
    currency: "USD",
    deadline: "",
    special_requirements: "",
  });

  const update = (k: keyof typeof form, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  async function submit() {
    if (!user) {
      toast.info(t("rfq.authRequired"));
      sessionStorage.setItem("pending_rfq", JSON.stringify(form));
      navigate({ to: "/auth", search: { redirect: "/request-quote" } });
      return;
    }
    setSubmitting(true);
    try {
      const parsed = Schema.parse({
        ...form,
        guests_count: Number(form.guests_count),
        rooms_needed: Number(form.rooms_needed),
        budget_min: form.budget_min === "" ? undefined : Number(form.budget_min),
        budget_max: form.budget_max === "" ? undefined : Number(form.budget_max),
      });
      const { data, error } = await supabase.from("rfqs").insert({
        ...parsed,
        room_type_pref: parsed.room_type_pref || null,
        special_requirements: parsed.special_requirements || null,
        deadline: parsed.deadline || null,
        organizer_id: user.id,
        status: "open",
      }).select("id").single();
      if (error) throw error;
      toast.success(t("rfq.createdToast"));
      sessionStorage.removeItem("pending_rfq");
      navigate({ to: "/dashboard/rfqs/$id", params: { id: data.id } });
    } catch (e: any) {
      toast.error(e?.message ?? t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  // Restore pending after auth
  useEffect(() => {
    if (!authLoading && user) {
      const stored = sessionStorage.getItem("pending_rfq");
      if (stored) {
        try { setForm(JSON.parse(stored)); } catch {}
      }
    }
  }, [authLoading, user]);

  const totalSteps = 3;

  if (blocked) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <SiteHeader />
        <main className="flex-1 container-page py-12">
          <AccessDenied
            message={
              isAdmin
                ? "Admins cannot submit quote requests. Only organizers can create new requests."
                : "Hotel accounts cannot submit quote requests. Only organizers can create new requests."
            }
          />
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1 container-page py-12 max-w-2xl">
        <div className="text-sm text-muted-foreground">{t("rfq.step")} {step} {t("rfq.of")} {totalSteps}</div>
        <h1 className="font-display text-3xl md:text-4xl text-primary mt-1">{t("rfq.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("rfq.subtitle")}</p>
        {!user && <div className="mt-3 text-sm rounded-md bg-warning/10 text-warning border border-warning/30 px-3 py-2">{t("rfq.anonymous")}</div>}

        <Card className="mt-6"><CardContent className="p-6 space-y-4">
          {step === 1 && (<>
            <div><Label>{t("rfq.fields.title")}</Label><Input value={form.title} onChange={e => update("title", e.target.value)} placeholder={t("rfq.fields.titlePh")} maxLength={160} /></div>
            <div><Label>{t("rfq.fields.groupType")}</Label>
              <Select value={form.group_type} onValueChange={v => update("group_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["umrah","hajj","tourism","corporate","government","sports","education","event","other"].map(k => (
                    <SelectItem key={k} value={k}>{t(`rfq.groupTypes.${k}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("rfq.fields.destCity")}</Label><Input value={form.destination_city} onChange={e => update("destination_city", e.target.value)} maxLength={120} /></div>
              <div><Label>{t("rfq.fields.destCountry")}</Label><Input value={form.destination_country} onChange={e => update("destination_country", e.target.value)} maxLength={120} /></div>
            </div>
          </>)}

          {step === 2 && (<>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("rfq.fields.checkIn")}</Label><Input type="date" value={form.check_in} onChange={e => update("check_in", e.target.value)} /></div>
              <div><Label>{t("rfq.fields.checkOut")}</Label><Input type="date" value={form.check_out} onChange={e => update("check_out", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("rfq.fields.guests")}</Label><Input type="number" min={1} value={form.guests_count} onChange={e => update("guests_count", e.target.value)} /></div>
              <div><Label>{t("rfq.fields.rooms")}</Label><Input type="number" min={1} value={form.rooms_needed} onChange={e => update("rooms_needed", e.target.value)} /></div>
            </div>
            <div><Label>{t("rfq.fields.roomPref")}</Label><Input value={form.room_type_pref} onChange={e => update("room_type_pref", e.target.value)} placeholder={t("rfq.fields.roomPrefPh")} /></div>
            <div><Label>{t("rfq.fields.board")}</Label>
              <Select value={form.board_type} onValueChange={v => update("board_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["room_only","breakfast","half_board","full_board"].map(k => <SelectItem key={k} value={k}>{t(`rfq.boards.${k}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </>)}

          {step === 3 && (<>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>{t("rfq.fields.budgetMin")}</Label><Input type="number" value={form.budget_min} onChange={e => update("budget_min", e.target.value)} /></div>
              <div><Label>{t("rfq.fields.budgetMax")}</Label><Input type="number" value={form.budget_max} onChange={e => update("budget_max", e.target.value)} /></div>
              <div><Label>{t("rfq.fields.currency")}</Label>
                <Select value={form.currency} onValueChange={v => update("currency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["USD","EUR","GBP","SAR","AED","TRY"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{t("rfq.fields.deadline")}</Label><Input type="date" value={form.deadline} onChange={e => update("deadline", e.target.value)} /></div>
            <div><Label>{t("rfq.fields.notes")}</Label><Textarea rows={4} maxLength={2000} value={form.special_requirements} onChange={e => update("special_requirements", e.target.value)} placeholder={t("rfq.fields.notesPh")} /></div>
          </>)}

          <div className="flex justify-between pt-4">
            <Button variant="ghost" disabled={step === 1} onClick={() => setStep(s => s - 1)}>{t("rfq.back")}</Button>
            {step < totalSteps ? (
              <Button variant="gold" onClick={() => setStep(s => s + 1)}>{t("rfq.next")}</Button>
            ) : (
              <Button variant="gold" disabled={submitting} onClick={submit}>{submitting ? t("rfq.submitting") : t("rfq.submit")}</Button>
            )}
          </div>
        </CardContent></Card>
      </main>
      <SiteFooter />
    </div>
  );
}
