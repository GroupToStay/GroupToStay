import { createFileRoute, Link, Navigate, useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
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
import { useCountries, useCities } from "@/hooks/use-master-data";
import { Clock, AlertCircle } from "lucide-react";

import { validateDatesAndCounts, validateDestination } from "@/features/rfq/rfq-validation";
import { submitRfq } from "@/features/rfq/rfq-service";
import { RfqDatePickerField } from "@/features/rfq/RfqDatePickerField";
import { RfqSharedFields, type RfqSharedValues } from "@/features/rfq/RfqSharedFields";
import {
  validateRfqSearch,
  sharedValuesFromSearch,
  type RfqSearchParams,
} from "@/features/rfq/rfq-search-params";

export const Route = createFileRoute("/request-quote")({
  head: () => ({ meta: [
    { title: "Create a group request — GroupToStay" },
    { name: "description", content: "One request. Multiple hotel offers. Submit one group accommodation request and receive competing hotel quotations." },
  ]}),
  validateSearch: (s: Record<string, unknown>): RfqSearchParams => validateRfqSearch(s),
  component: Page,
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
  const [form, setForm] = useState({
    title: "",
    group_type: "umrah" as const,
    destination_country_id: search.country_id ?? null as string | null,
    destination_city_id: search.city_id ?? null as string | null,
    check_in: search.check_in ?? "",
    check_out: search.check_out ?? "",
    guests_count: search.guests ? Number(search.guests) : 30,
    rooms_needed: search.rooms ? Number(search.rooms) : 10,
    hotel_categories_v2: parseCategoriesParam(search.category) as HotelCategory[],
    accommodation_type: (accom && (ACCOMMODATION_TYPES as readonly string[]).includes(accom) ? accom : "any") as AccommodationType,
    meal_plan_code: (meal && (MEAL_PLANS as readonly string[]).includes(meal) ? meal : "bb") as MealPlan,
    additional_requirements: "",
    requirements: "",
    deadline: "",
  });

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));
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
      const country = countries.find(c => c.id === form.destination_country_id);
      const city = citiesOfCountry.find(c => c.id === form.destination_city_id);
      const { id } = await submitRfq({
        ...form,
        guests_count: Number(form.guests_count),
        rooms_needed: Number(form.rooms_needed),
      }, { userId: user.id, countryNameEn: country?.name_en, cityNameEn: city?.name_en });
      toast.success(t("rfq.createdToast"));
      sessionStorage.removeItem("pending_rfq");
      navigate({ to: "/dashboard/rfqs/$id", params: { id } });
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
        try { setForm(JSON.parse(stored)); } catch { /* ignore */ }
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
              <Select value={form.group_type} onValueChange={v => update("group_type", v as typeof form.group_type)}>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{t("rfq.fields.checkIn")}</Label>
                <RfqDatePickerField value={form.check_in} onChange={(v) => update("check_in", v)} />
              </div>
              <div>
                <Label>{t("rfq.fields.checkOut")}</Label>
                <RfqDatePickerField value={form.check_out} onChange={(v) => update("check_out", v)} min={form.check_in} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>{t("rfq.fields.guests")}</Label><Input type="number" min={1} value={form.guests_count} onChange={e => update("guests_count", Number(e.target.value))} /></div>
              <div><Label>{t("rfq.fields.rooms")}</Label><Input type="number" min={1} value={form.rooms_needed} onChange={e => update("rooms_needed", Number(e.target.value))} /></div>
            </div>
            <div>
              <Label>Categories</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Choose one or more categories. Leave empty for Any.</p>
              <div className="mt-2">
                <RfqCategoriesMultiSelect
                  value={form.hotel_categories_v2}
                  onChange={(v) => update("hotel_categories_v2", v)}
                />
              </div>
            </div>
            <div>
              <Label>Requirements (optional)</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Share any operational requirements. Hotels will see this with the RFQ.</p>
              <RfqRequirementsField value={form.requirements} onChange={(v) => update("requirements", v)} />
            </div>
          </>)}

          {step === 3 && (<>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{t("rfq.fields.accommodation")}</Label>
                <RfqAccommodationSelect value={form.accommodation_type} onChange={(v) => update("accommodation_type", v)} />
              </div>
              <div>
                <Label>{t("rfq.fields.mealPlan")}</Label>
                <RfqMealPlanSelect value={form.meal_plan_code} onChange={(v) => update("meal_plan_code", v)} />
              </div>
            </div>
            <div>
              <Label>{t("rfq.fields.deadline")}</Label>
              <RfqDatePickerField value={form.deadline} onChange={(v) => update("deadline", v)} />
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
                  const err = validateDestination({
                    title: form.title,
                    destination_country_id: form.destination_country_id,
                    destination_city_id: form.destination_city_id,
                  });
                  if (err) return toast.error(err);
                }
                if (step === 2) {
                  const err = validateDatesAndCounts({
                    check_in: form.check_in,
                    check_out: form.check_out,
                    guests_count: Number(form.guests_count),
                    rooms_needed: Number(form.rooms_needed),
                  });
                  if (err) return toast.error(err);
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
