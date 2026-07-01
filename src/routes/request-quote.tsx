import { createFileRoute, Link, Navigate, useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { useAgencyVerification } from "@/hooks/use-agency-verification";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { CountryCitySelect } from "@/components/country-city-select";
import { useCountries, useCities } from "@/hooks/use-master-data";
import { Star, ShieldCheck, Clock, AlertCircle, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const HOTEL_CATEGORIES = [
  "Budget", "Economy", "Midscale", "Upper Midscale", "Upscale", "Luxury",
  "Resort", "Boutique Hotel", "Serviced Apartments", "Business Hotel",
  "Airport Hotel", "Beach Resort", "City Hotel", "Convention Hotel",
  "Hostel", "Villa", "Other",
] as const;


type Search = {
  city?: string; country?: string;
  country_id?: string; city_id?: string;
  guests?: string; rooms?: string;
  check_in?: string; check_out?: string;
  accommodation?: string; meal_plan?: string; category?: string;
};

export const Route = createFileRoute("/request-quote")({
  head: () => ({ meta: [
    { title: "Create a group request — GroupToStay" },
    { name: "description", content: "One request. Multiple hotel offers. Submit one group accommodation request and receive competing hotel quotations." },
  ]}),
  validateSearch: (s: Record<string, unknown>): Search => {
    const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : undefined);
    return {
      city: str("city"), country: str("country"),
      country_id: str("country_id"), city_id: str("city_id"),
      guests: str("guests"), rooms: str("rooms"),
      check_in: str("check_in"), check_out: str("check_out"),
      accommodation: str("accommodation"), meal_plan: str("meal_plan"), category: str("category"),
    };
  },
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
  hotel_categories_v2: z.array(z.string()).optional(),
  accommodation_type: z.enum(["any","hotel","hotel_apartment","resort"]),
  meal_plan_code: z.enum(["room_only","bb","hb","fb"]),
  additional_requirements: z.string().max(2000).optional().or(z.literal("")),
  requirements: z.string().max(4000).optional().or(z.literal("")),
  deadline: z.string().optional().or(z.literal("")),
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
      toast.info(isAdmin
        ? "Admins cannot create group requests."
        : "Hotel accounts cannot create group requests.");
    }
  }, [blocked, isAdmin]);

  const accom = search.accommodation;
  const meal = search.meal_plan;
  const cats = search.category ? search.category.split(",") : [];
  const [form, setForm] = useState({
    title: "",
    group_type: "umrah" as const,
    destination_country_id: search.country_id ?? null as string | null,
    destination_city_id: search.city_id ?? null as string | null,
    check_in: search.check_in ?? "",
    check_out: search.check_out ?? "",
    guests_count: search.guests ? Number(search.guests) : 30,
    rooms_needed: search.rooms ? Number(search.rooms) : 10,
    hotel_categories_v2: cats.filter((c: string) => (HOTEL_CATEGORIES as readonly string[]).includes(c)) as string[],
    accommodation_type: (accom && ["any","hotel","hotel_apartment","resort"].includes(accom) ? accom : "any") as "any"|"hotel"|"hotel_apartment"|"resort",
    meal_plan_code: (meal && ["room_only","bb","hb","fb"].includes(meal) ? meal : "bb") as "room_only"|"bb"|"hb"|"fb",
    additional_requirements: "",
    requirements: "",
    deadline: "",
  });

  const update = (k: keyof typeof form, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const toggleCategory = (n: string) => setForm(f => ({
    ...f,
    hotel_categories_v2: f.hotel_categories_v2.includes(n)
      ? f.hotel_categories_v2.filter((x: string) => x !== n)
      : [...f.hotel_categories_v2, n],
  }));
  const { status: verifStatus, isVerified, isPending, isRejected, isDraft, rejectionReason } = useAgencyVerification();



  const { data: countries = [] } = useCountries();
  const { data: citiesOfCountry = [] } = useCities(form.destination_country_id);

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
      });
      const country = countries.find(c => c.id === parsed.destination_country_id);
      const city = citiesOfCountry.find(c => c.id === parsed.destination_city_id);

      // Map meal plan code into legacy board_type for back-compat
      const boardMap: Record<string, string> = { room_only: "room_only", bb: "breakfast", hb: "half_board", fb: "full_board" };

      const { data, error } = await supabase.from("rfqs").insert({
        title: parsed.title,
        group_type: parsed.group_type,
        destination_country_id: parsed.destination_country_id,
        destination_city_id: parsed.destination_city_id,
        destination_country: country?.name_en ?? "",
        destination_city: city?.name_en ?? "",
        check_in: parsed.check_in,
        check_out: parsed.check_out,
        guests_count: parsed.guests_count,
        rooms_needed: parsed.rooms_needed,
        hotel_categories_v2: parsed.hotel_categories_v2 && parsed.hotel_categories_v2.length > 0 ? parsed.hotel_categories_v2 : null,
        accommodation_type: parsed.accommodation_type,
        meal_plan_code: parsed.meal_plan_code,
        board_type: boardMap[parsed.meal_plan_code] as any,
        additional_requirements: parsed.additional_requirements || null,
        requirements: parsed.requirements || null,
        special_requirements: parsed.additional_requirements || parsed.requirements || null,

        deadline: parsed.deadline || null,
        currency: "USD",
        organizer_id: user.id,
        status: "open",
      } as any).select("id").single();
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

  useEffect(() => {
    if (!authLoading && user) {
      const stored = sessionStorage.getItem("pending_rfq");
      if (stored) {
        try { setForm(JSON.parse(stored)); } catch {}
      }
    }
  }, [authLoading, user]);

  if (blocked) return <Navigate to="/dashboard" />;

  const totalSteps = 3;

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1 container-page py-12 max-w-2xl">
        <div className="text-sm text-muted-foreground">{t("rfq.step")} {step} {t("rfq.of")} {totalSteps}</div>
        <h1 className="font-display text-3xl md:text-4xl text-primary mt-1">{t("rfq.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("rfq.subtitle")}</p>
        {!user && <div className="mt-3 text-sm rounded-md bg-warning/10 text-warning border border-warning/30 px-3 py-2">{t("rfq.anonymous")}</div>}

        {user && isOrganizer && !isVerified && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-4">
            <div className="flex items-start gap-2">
              {isPending ? <Clock className="h-5 w-5 mt-0.5" /> : <AlertCircle className="h-5 w-5 mt-0.5" />}
              <div className="flex-1 text-sm">
                {isPending && (<><b>Verification in progress.</b> Your agency profile is under review. You will be able to publish requests once verified.</>)}
                {isRejected && (<><b>Verification rejected.</b> {rejectionReason && <>Reason: {rejectionReason}. </>}Please update your profile and resubmit.</>)}
                {(isDraft || (!isPending && !isRejected && verifStatus !== "verified")) && (<><b>Complete your agency verification</b> to publish requests and contact hotels.</>)}
                <div className="mt-2">
                  <Link to="/dashboard/agency-profile"><Button variant="gold" size="sm">Open Agency Profile</Button></Link>
                </div>
              </div>
            </div>
          </div>
        )}



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
            <CountryCitySelect
              countryId={form.destination_country_id}
              cityId={form.destination_city_id}
              onChange={({ countryId, cityId }) => setForm(f => ({ ...f, destination_country_id: countryId, destination_city_id: cityId }))}
              labelCountry={t("rfq.fields.destCountry")}
              labelCity={t("rfq.fields.destCity")}
              required
            />
          </>)}

          {step === 2 && (<>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("rfq.fields.checkIn")}</Label>
                <DatePickerField value={form.check_in} onChange={(v) => update("check_in", v)} />
              </div>
              <div>
                <Label>{t("rfq.fields.checkOut")}</Label>
                <DatePickerField value={form.check_out} onChange={(v) => update("check_out", v)} min={form.check_in} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("rfq.fields.guests")}</Label><Input type="number" min={1} value={form.guests_count} onChange={e => update("guests_count", Number(e.target.value))} /></div>
              <div><Label>{t("rfq.fields.rooms")}</Label><Input type="number" min={1} value={form.rooms_needed} onChange={e => update("rooms_needed", Number(e.target.value))} /></div>
            </div>
            <div>
              <Label>Hotel Categories</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Choose one or more categories. Leave empty for Any.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {HOTEL_CATEGORIES.map((n) => {
                  const active = form.hotel_categories_v2.includes(n);
                  return (
                    <button key={n} type="button" onClick={() => toggleCategory(n)}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm ${active ? "border-gold bg-gold/10 text-foreground" : "border-input text-muted-foreground"}`}>
                      {n}
                    </button>
                  );
                })}
                <button type="button" onClick={() => update("hotel_categories_v2", [])}
                  className={`rounded-full border px-3 py-1.5 text-sm ${form.hotel_categories_v2.length === 0 ? "border-gold bg-gold/10 text-foreground" : "border-input text-muted-foreground"}`}>
                  Any
                </button>
              </div>
            </div>
            <div>
              <Label>Requirements (optional)</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Share any operational requirements. Hotels will see this with the RFQ.</p>
              <Textarea
                rows={6}
                maxLength={4000}
                value={form.requirements}
                onChange={e => {
                  update("requirements", e.target.value);
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
                placeholder={`Example:\n• Airport transfer required\n• Twin beds preferred\n• Meeting room required\n• Early breakfast\n• Wheelchair accessibility\n• Parking required\n• Special meals\n• Any additional operational requirements...`}
                className="whitespace-pre-wrap"
              />
            </div>
          </>)}


          {step === 3 && (<>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("rfq.fields.accommodation")}</Label>
                <Select value={form.accommodation_type} onValueChange={v => update("accommodation_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["any","hotel","hotel_apartment","resort"].map(k => (
                      <SelectItem key={k} value={k}>{t(`rfq.accommodationTypes.${k}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("rfq.fields.mealPlan")}</Label>
                <Select value={form.meal_plan_code} onValueChange={v => update("meal_plan_code", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["room_only","bb","hb","fb"].map(k => (
                      <SelectItem key={k} value={k}>{t(`rfq.mealPlans.${k}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("rfq.fields.deadline")}</Label>
              <DatePickerField value={form.deadline} onChange={(v) => update("deadline", v)} />
            </div>
            <div>
              <Label>{t("rfq.fields.notes")}</Label>
              <Textarea rows={3} maxLength={2000} value={form.additional_requirements} onChange={e => update("additional_requirements", e.target.value)} placeholder={t("rfq.fields.notesPh")} />
            </div>
          </>)}


          <div className="flex justify-between pt-4">
            <Button variant="ghost" disabled={step === 1} onClick={() => setStep(s => s - 1)}>{t("rfq.back")}</Button>
            {step < totalSteps ? (
              <Button variant="gold" onClick={() => {
                if (step === 1) {
                  if (!form.title.trim() || form.title.trim().length < 3) return toast.error("Please enter a request title (min 3 characters).");
                  if (!form.destination_country_id) return toast.error("Please select a destination country.");
                  if (!form.destination_city_id) return toast.error("Please select a destination city.");
                }
                if (step === 2) {
                  if (!form.check_in) return toast.error("Please select a check-in date.");
                  if (!form.check_out) return toast.error("Please select a check-out date.");
                  const ci = new Date(form.check_in); const co = new Date(form.check_out);
                  const today = new Date(); today.setHours(0,0,0,0);
                  if (ci < today) return toast.error("Check-in cannot be in the past.");
                  if (co <= ci) return toast.error("Check-out must be after check-in.");
                  if (!(form.guests_count > 0) || form.guests_count > 100000) return toast.error("Number of guests must be between 1 and 100,000.");
                  if (!(form.rooms_needed > 0) || form.rooms_needed > 10000) return toast.error("Number of rooms must be between 1 and 10,000.");
                }
                setStep(s => s + 1);
              }}>{t("rfq.next")}</Button>
            ) : (
              <Button variant="gold" disabled={submitting || (!!user && isOrganizer && !isVerified)} onClick={submit}>{submitting ? t("rfq.submitting") : t("rfq.submit")}</Button>
            )}
          </div>
        </CardContent></Card>
      </main>
      <SiteFooter />
    </div>
  );
}

function DatePickerField({ value, onChange, min }: { value: string; onChange: (v: string) => void; min?: string }) {
  const date = value ? new Date(value) : undefined;
  const minDate = min ? new Date(min) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "MM/dd/yyyy") : <span>MM/DD/YYYY</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")}
          disabled={(d) => {
            const today = new Date(); today.setHours(0,0,0,0);
            if (d < today) return true;
            if (minDate && d <= minDate) return true;
            return false;
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

