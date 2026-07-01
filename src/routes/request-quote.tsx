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

  const [shared, setShared] = useState<RfqSharedValues>(() =>
    sharedValuesFromSearch(search, { guests_count: 30, rooms_needed: 10 }),
  );
  const [extras, setExtras] = useState({
    title: "",
    group_type: "umrah" as
      | "umrah" | "hajj" | "tourism" | "corporate" | "government"
      | "sports" | "education" | "event" | "other",
    additional_requirements: "",
    deadline: "",
  });

  const patchShared = (patch: Partial<RfqSharedValues>) => setShared((v) => ({ ...v, ...patch }));
  const { status: verifStatus, isVerified, isPending, isRejected, isDraft, rejectionReason } = useAgencyVerification();

  const { data: countries = [] } = useCountries();
  const { data: citiesOfCountry = [] } = useCities(shared.destination_country_id);

  async function submit() {
    const payload = {
      ...extras,
      ...shared,
      guests_count: Number(shared.guests_count ?? 0),
      rooms_needed: Number(shared.rooms_needed ?? 0),
    };
    if (!user) {
      toast.info(t("rfq.authRequired"));
      sessionStorage.setItem("pending_rfq", JSON.stringify(payload));
      navigate({ to: "/auth", search: { redirect: "/request-quote" } });
      return;
    }
    setSubmitting(true);
    try {
      const country = countries.find(c => c.id === shared.destination_country_id);
      const city = citiesOfCountry.find(c => c.id === shared.destination_city_id);
      const { id } = await submitRfq(payload, {
        userId: user.id,
        countryNameEn: country?.name_en,
        cityNameEn: city?.name_en,
      });
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
        try {
          const p = JSON.parse(stored);
          setShared((v) => ({
            ...v,
            destination_country_id: p.destination_country_id ?? v.destination_country_id,
            destination_city_id: p.destination_city_id ?? v.destination_city_id,
            guests_count: p.guests_count ?? v.guests_count,
            rooms_needed: p.rooms_needed ?? v.rooms_needed,
            check_in: p.check_in ?? v.check_in,
            check_out: p.check_out ?? v.check_out,
            hotel_categories_v2: p.hotel_categories_v2 ?? v.hotel_categories_v2,
            accommodation_type: p.accommodation_type ?? v.accommodation_type,
            meal_plan_code: p.meal_plan_code ?? v.meal_plan_code,
            requirements: p.requirements ?? v.requirements,
          }));
          setExtras((e) => ({
            title: p.title ?? e.title,
            group_type: p.group_type ?? e.group_type,
            additional_requirements: p.additional_requirements ?? e.additional_requirements,
            deadline: p.deadline ?? e.deadline,
          }));
        } catch { /* ignore */ }
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
            <div>
              <Label>{t("rfq.fields.title")}</Label>
              <Input value={extras.title} onChange={e => setExtras(x => ({ ...x, title: e.target.value }))} placeholder={t("rfq.fields.titlePh")} maxLength={160} />
            </div>
            <div>
              <Label>{t("rfq.fields.groupType")}</Label>
              <Select value={extras.group_type} onValueChange={v => setExtras(x => ({ ...x, group_type: v as typeof x.group_type }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["umrah","hajj","tourism","corporate","government","sports","education","event","other"].map(k => (
                    <SelectItem key={k} value={k}>{t(`rfq.groupTypes.${k}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <RfqSharedFields
              value={shared}
              onChange={patchShared}
              sections={["destination"]}
              destinationRequired
              destinationLabels={{ country: t("rfq.fields.destCountry"), city: t("rfq.fields.destCity") }}
            />
          </>)}

          {step === 2 && (
            <RfqSharedFields
              value={shared}
              onChange={patchShared}
              sections={["dates", "counts", "categories", "requirements"]}
              requirementsHint="Share any operational requirements. Hotels will see this with the RFQ."
            />
          )}

          {step === 3 && (<>
            <RfqSharedFields
              value={shared}
              onChange={patchShared}
              sections={["accommodation", "mealPlan"]}
            />
            <div>
              <Label>{t("rfq.fields.deadline")}</Label>
              <RfqDatePickerField value={extras.deadline} onChange={(v) => setExtras(x => ({ ...x, deadline: v }))} />
            </div>
            <div>
              <Label>{t("rfq.fields.notes")}</Label>
              <Textarea rows={3} maxLength={2000} value={extras.additional_requirements} onChange={e => setExtras(x => ({ ...x, additional_requirements: e.target.value }))} placeholder={t("rfq.fields.notesPh")} />
            </div>
          </>)}

          <div className="flex justify-between pt-4">
            <Button variant="ghost" disabled={step === 1} onClick={() => setStep(s => s - 1)}>{t("rfq.back")}</Button>
            {step < totalSteps ? (
              <Button variant="gold" onClick={() => {
                if (step === 1) {
                  const err = validateDestination({
                    title: extras.title,
                    destination_country_id: shared.destination_country_id,
                    destination_city_id: shared.destination_city_id,
                  });
                  if (err) return toast.error(err);
                }
                if (step === 2) {
                  const err = validateDatesAndCounts({
                    check_in: shared.check_in,
                    check_out: shared.check_out,
                    guests_count: Number(shared.guests_count ?? 0),
                    rooms_needed: Number(shared.rooms_needed ?? 0),
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

