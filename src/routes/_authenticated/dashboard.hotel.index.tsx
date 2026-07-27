import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowRight, Building2, Plus, Star, MapPin } from "lucide-react";
import { SubscriptionCards } from "@/components/subscription-cards";
import { CountryCitySelect } from "@/components/country-city-select";
import { useCountries, useCities } from "@/hooks/use-master-data";
import { EmptyState } from "@/components/empty-state";
import { HotelPhoto } from "@/components/hotel-photo";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/hotel/")({
  head: () => ({ meta: [{ title: i18n.t("hotelDash.meta.myHotels") }] }),
  component: Page,
  errorComponent: ({ error, reset }) => (
    <div className="space-y-3">
      <h2 className="font-display text-xl text-primary">
        {i18n.t("hotelDash.errors.unableToLoadProfile")}
      </h2>
      <p className="text-sm text-muted-foreground">{i18n.t("hotelDash.errors.refreshOrContact")}</p>
      <pre className="text-xs text-error whitespace-pre-wrap">{error?.message}</pre>
      <button className="text-sm underline" onClick={() => reset()}>
        {i18n.t("hotelDash.errors.tryAgain")}
      </button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="text-muted-foreground">{i18n.t("hotelDash.errors.notFound")}</div>
  ),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function Page() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("hotel_approval_status, approval_notes, company_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: hotels = [], isLoading } = useQuery({
    queryKey: ["my-hotels", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("hotels")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (isLoading || profileLoading)
    return <div className="text-muted-foreground">{t("common.loading")}</div>;

  if (profile?.hotel_approval_status !== "approved") {
    return (
      <div className="space-y-6">
        <PageHeader title={t("hotelDash.myHotel")} icon={Building2} />
        <Card>
          <CardContent className="p-6">
            <StatusBadge status={profile?.hotel_approval_status ?? "pending"} />
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              {t("hotelDash.companyReviewTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {profile?.hotel_approval_status === "rejected"
                ? t("hotelDash.companyRejected")
                : t("hotelDash.companyPending")}
            </p>
            {profile?.approval_notes && (
              <div className="mt-3 rounded-md border border-border bg-surface p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("hotelDash.adminNotes")}
                </div>
                <div className="mt-1">{profile.approval_notes}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const hotel = hotels[0];

  // Single hotel per account. If none exists yet, prompt to complete the profile.
  if (!hotel) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("hotelDash.completeProfileTitle")}
          description={t("hotelDash.completeProfileSubtitle")}
          icon={Building2}
        />
        <EmptyState
          icon={Building2}
          title={t("hotelDash.noProfileYet")}
          description={t("hotelDash.completeProfileSubtitle")}
        >
          <div className="flex justify-center">
            <AddHotelDialog
              onCreated={() => qc.invalidateQueries({ queryKey: ["my-hotels", user?.id] })}
            />
          </div>
        </EmptyState>
      </div>
    );
  }

  // Profile completion %
  const fields: Array<[string, any]> = [
    ["name", hotel.name],
    ["description", hotel.description],
    ["city", hotel.city],
    ["country", hotel.country],
    ["address", hotel.address],
    ["star_rating", hotel.star_rating],
    ["cover_image", hotel.cover_image],
    ["amenities", hotel.amenities && hotel.amenities.length > 0 ? "y" : null],
  ];
  const filled = fields.filter(([, v]) => v != null && v !== "").length;
  const completion = Math.round((filled / fields.length) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("hotelDash.myHotel")}
        icon={Building2}
        meta={<StatusBadge status={hotel.status} />}
      />

      <Card className="bg-surface/60">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-medium">
              {t("hotelDash.profileCompletion")}: {completion}%
            </div>
            <span className="text-xs text-muted-foreground">{t("hotelDash.completionHint")}</span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={completion}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full bg-primary transition-all" style={{ width: `${completion}%` }} />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {hotel.cover_image ? (
            <div className="aspect-[16/10] bg-surface sm:w-72 sm:shrink-0">
              <HotelPhoto
                src={hotel.cover_image}
                alt={hotel.name ?? ""}
                width={1280}
                height={720}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="grid aspect-[16/10] place-items-center bg-surface text-muted-foreground sm:w-72 sm:shrink-0">
              <Building2 className="h-8 w-8" />
            </div>
          )}
          <CardContent className="flex flex-1 flex-col justify-between p-5">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{hotel.name ?? ""}</h3>
              <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <MapPin className="h-3 w-3" /> {hotel.city ?? ""}
                {hotel.city && hotel.country ? ", " : ""}
                {hotel.country ?? ""}
                <span className="flex text-gold">
                  {Array.from({ length: Math.max(0, Number(hotel.star_rating) || 0) }).map(
                    (_, i) => (
                      <Star key={i} className="h-3 w-3 fill-current" />
                    ),
                  )}
                </span>
              </div>
            </div>
            <div className="mt-4">
              <Button asChild size="sm">
                <Link to="/dashboard/hotel/$id" params={{ id: hotel.id }}>
                  {t("hotelDash.manage")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </div>
      </Card>

      <SubscriptionCards />
    </div>
  );
}

function AddHotelDialog({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [countryId, setCountryId] = useState<string | null>(null);
  const [cityId, setCityId] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [starRating, setStarRating] = useState("4");
  const [description, setDescription] = useState("");
  const [amenities, setAmenities] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { data: countries = [] } = useCountries();
  const { data: cities = [] } = useCities(countryId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!countryId || !cityId) {
      toast.error(t("hotelDash.selectCountryCity"));
      return;
    }
    setSubmitting(true);
    try {
      const country = countries.find((c) => c.id === countryId);
      const city = cities.find((c) => c.id === cityId);
      const { error } = await supabase.from("hotels").insert({
        owner_id: user.id,
        name: name.trim(),
        country_id: countryId,
        city_id: cityId,
        city: city?.name_en ?? "",
        country: country?.name_en ?? "",
        address: address.trim() || null,
        slug: `${slugify(name)}-${Date.now().toString(36)}`,
        star_rating: Number(starRating),
        description: description.trim() || null,
        amenities: amenities
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        status: "pending",
      });
      if (error) throw error;
      toast.success(t("hotelDash.createdToast"));
      setOpen(false);
      setName("");
      setCountryId(null);
      setCityId(null);
      setAddress("");
      setStarRating("4");
      setDescription("");
      setAmenities("");
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> {t("hotelDash.addHotel")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("hotelDash.createTitle")}</DialogTitle>
        </DialogHeader>
        <form method="post" onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="new-hotel-name">{t("hotelDash.fields.name")}</Label>
            <Input
              id="new-hotel-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={160}
            />
          </div>
          <CountryCitySelect
            countryId={countryId}
            cityId={cityId}
            onChange={({ countryId: c, cityId: ci }) => {
              setCountryId(c);
              setCityId(ci);
            }}
            required
          />
          <div>
            <Label htmlFor="new-hotel-address">{t("hotelDash.fields.address")}</Label>
            <Input
              id="new-hotel-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={240}
            />
          </div>
          <div>
            <Label htmlFor="new-hotel-stars">{t("hotelDash.fields.stars")}</Label>
            <select
              id="new-hotel-stars"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={starRating}
              onChange={(e) => setStarRating(e.target.value)}
            >
              {[3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="new-hotel-description">{t("hotelDash.fields.description")}</Label>
            <Textarea
              id="new-hotel-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
            />
          </div>
          <div>
            <Label htmlFor="new-hotel-amenities">{t("hotelDash.fields.amenities")}</Label>
            <Input
              id="new-hotel-amenities"
              value={amenities}
              onChange={(e) => setAmenities(e.target.value)}
              placeholder={t("hotelDash.fields.amenitiesPh")}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("hotelDash.photosAfterCreate")}</p>
          <DialogFooter>
            <Button type="submit" variant="gold" disabled={submitting}>
              {submitting ? t("rfq.submitting") : t("hotelDash.createSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
