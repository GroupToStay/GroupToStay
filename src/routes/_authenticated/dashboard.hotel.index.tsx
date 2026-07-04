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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, Plus, Star, MapPin } from "lucide-react";
import { SubscriptionCards } from "@/components/subscription-cards";
import { CountryCitySelect } from "@/components/country-city-select";
import { useCountries, useCities } from "@/hooks/use-master-data";
import { EmptyState } from "@/components/empty-state";
import { HotelPhoto } from "@/components/hotel-photo";

export const Route = createFileRoute("/_authenticated/dashboard/hotel/")({
  head: () => ({ meta: [{ title: "My hotels — GroupToStay" }] }),
  component: Page,
  errorComponent: ({ error, reset }) => (
    <div className="space-y-3">
      <h2 className="font-display text-xl text-primary">Unable to load hotel profile.</h2>
      <p className="text-sm text-muted-foreground">Please refresh or contact support.</p>
      <pre className="text-xs text-error whitespace-pre-wrap">{error?.message}</pre>
      <button className="text-sm underline" onClick={() => reset()}>
        Try again
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="text-muted-foreground">Not found</div>,
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
        <h1 className="font-display text-3xl text-primary">{t("hotelDash.myHotel")}</h1>
        <Card>
          <CardContent className="p-6">
            <Badge
              className={
                profile?.hotel_approval_status === "rejected"
                  ? "bg-error/15 text-error"
                  : "bg-muted text-muted-foreground"
              }
            >
              {t(`hotelDash.companyStatus.${profile?.hotel_approval_status ?? "pending"}`)}
            </Badge>
            <h2 className="mt-3 font-display text-xl text-primary">
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
        <div>
          <h1 className="font-display text-3xl text-primary flex items-center gap-2">
            <Building2 className="h-7 w-7" />{" "}
            {t("hotelDash.completeProfileTitle", "Complete Your Hotel Profile")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t(
              "hotelDash.completeProfileSubtitle",
              "Add your hotel details so organizers can find you. Group Requests appear here after your profile is approved.",
            )}
          </p>
        </div>
        <EmptyState
          icon={Building2}
          title={t("hotelDash.noProfileYet", "You haven't created your hotel profile yet.")}
          description={t(
            "hotelDash.completeProfileSubtitle",
            "Add your hotel details so organizers can find you.",
          )}
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
      <div>
        <h1 className="font-display text-3xl text-primary flex items-center gap-2">
          <Building2 className="h-7 w-7" /> {t("hotelDash.myHotel", "My Hotel Profile")}
        </h1>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-medium">
              {t("hotelDash.profileCompletion", "Profile completion")}: {completion}%
            </div>
            <Badge
              className={
                hotel.status === "approved"
                  ? "bg-success/15 text-success"
                  : "bg-muted text-muted-foreground"
              }
            >
              {t(`hotelDash.statuses.${hotel.status}`)}
            </Badge>
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-gold transition-all" style={{ width: `${completion}%` }} />
          </div>
          {completion < 80 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t(
                "hotelDash.completionHint",
                "Reach 80% completion to unlock subscription upgrades and featured placement.",
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {hotel.cover_image ? (
          <div className="aspect-video bg-surface">
            <HotelPhoto
              src={hotel.cover_image}
              alt={hotel.name ?? ""}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-video bg-surface grid place-items-center text-muted-foreground">
            <Building2 className="h-8 w-8" />
          </div>
        )}
        <CardContent className="p-5">
          <h3 className="font-display text-lg text-primary">{hotel.name ?? ""}</h3>
          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <MapPin className="h-3 w-3" /> {hotel.city ?? ""}
            {hotel.city && hotel.country ? ", " : ""}
            {hotel.country ?? ""}
            <span className="flex text-gold">
              {Array.from({ length: Math.max(0, Number(hotel.star_rating) || 0) }).map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-current" />
              ))}
            </span>
          </div>
          <div className="mt-4">
            <Button asChild variant="default" size="sm">
              <Link to="/dashboard/hotel/$id" params={{ id: hotel.id }}>
                {t("hotelDash.manage")}
              </Link>
            </Button>
          </div>
        </CardContent>
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
      toast.error("Please select country and city");
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
        <Button variant="gold">
          <Plus className="h-4 w-4" /> {t("hotelDash.addHotel")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("hotelDash.createTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>{t("hotelDash.fields.name")}</Label>
            <Input
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
            <Label>{t("hotelDash.fields.address")}</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={240} />
          </div>
          <div>
            <Label>{t("hotelDash.fields.stars")}</Label>
            <select
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
            <Label>{t("hotelDash.fields.description")}</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
            />
          </div>
          <div>
            <Label>{t("hotelDash.fields.amenities")}</Label>
            <Input
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
