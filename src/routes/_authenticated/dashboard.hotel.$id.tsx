import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Plus, Trash2, Star, Upload, Image as ImageIcon, ChevronLeft, Save } from "lucide-react";
import { CountryCitySelect } from "@/components/country-city-select";
import { useHotelTypes, useLocalizedName, useCities, useCountries } from "@/hooks/use-master-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard/hotel/$id")({
  head: () => ({ meta: [{ title: "Manage hotel — GroupToStay" }] }),
  component: Page,
  errorComponent: ({ error }) => <div className="text-error">{error.message}</div>,
  notFoundComponent: () => <div className="text-muted-foreground">Not found</div>,
});

function Page() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: hotel, isLoading } = useQuery({
    queryKey: ["hotel-detail", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("hotels").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!hotel) throw notFound();
  if (hotel.owner_id !== user?.id) return <div className="text-error">{t("common.error")}</div>;

  return <ManageHotel hotel={hotel} onChanged={() => qc.invalidateQueries({ queryKey: ["hotel-detail", id] })} />;
}

function ManageHotel({ hotel, onChanged }: { hotel: any; onChanged: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Edit hotel info
  const [name, setName] = useState(hotel.name);
  const [countryId, setCountryId] = useState<string | null>(hotel.country_id ?? null);
  const [cityId, setCityId] = useState<string | null>(hotel.city_id ?? null);
  const [hotelTypeId, setHotelTypeId] = useState<string | null>(hotel.hotel_type_id ?? null);
  const [address, setAddress] = useState(hotel.address ?? "");
  const [starRating, setStarRating] = useState(String(hotel.star_rating ?? 4));
  const [description, setDescription] = useState(hotel.description ?? "");
  const [amenities, setAmenities] = useState((hotel.amenities ?? []).join(", "));
  const [savingInfo, setSavingInfo] = useState(false);

  const localized = useLocalizedName();
  const { data: hotelTypes = [] } = useHotelTypes();
  const { data: allCountries = [] } = useCountries();
  const { data: allCities = [] } = useCities(countryId);

  useEffect(() => {
    setName(hotel.name);
    setCountryId(hotel.country_id ?? null);
    setCityId(hotel.city_id ?? null);
    setHotelTypeId(hotel.hotel_type_id ?? null);
    setAddress(hotel.address ?? "");
    setStarRating(String(hotel.star_rating ?? 4));
    setDescription(hotel.description ?? "");
    setAmenities((hotel.amenities ?? []).join(", "));
  }, [hotel]);

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!countryId || !cityId) {
      toast.error(t("common.selectCountryCity", { defaultValue: "Please select a country and city." }));
      return;
    }
    if (!hotelTypeId) {
      toast.error(t("common.selectHotelType", { defaultValue: "Please select a hotel type." }));
      return;
    }
    setSavingInfo(true);
    try {
      const country = allCountries.find(c => c.id === countryId);
      const city = allCities.find(c => c.id === cityId);
      const { error } = await supabase.from("hotels").update({
        name: name.trim(),
        country_id: countryId,
        city_id: cityId,
        hotel_type_id: hotelTypeId,
        // keep legacy text columns in sync for back-compat
        city: city?.name_en ?? hotel.city,
        country: country?.name_en ?? hotel.country,
        address: address.trim() || null,
        star_rating: Number(starRating),
        description: description.trim() || null,
        amenities: amenities.split(",").map((s: string) => s.trim()).filter(Boolean),
      }).eq("id", hotel.id);
      if (error) throw error;
      toast.success(t("hotelDash.infoSaved"));
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingInfo(false);
    }
  }

  const { data: rooms = [] } = useQuery({
    queryKey: ["my-hotel-rooms", hotel.id],
    queryFn: async () => {
      const { data } = await supabase.from("hotel_rooms").select("*").eq("hotel_id", hotel.id).order("created_at");
      return data ?? [];
    },
  });

  const [roomType, setRoomType] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [count, setCount] = useState("10");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");

  const addRoom = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hotel_rooms").insert({
        hotel_id: hotel.id, room_type: roomType, capacity: Number(capacity),
        count_available: Number(count), base_price: Number(price), currency,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("hotelDash.roomAdded"));
      setRoomType(""); setPrice("");
      qc.invalidateQueries({ queryKey: ["my-hotel-rooms", hotel.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delRoom = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hotel_rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-hotel-rooms", hotel.id] }),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length || !user) return;
    setUploading(true);
    try {
      const newGallery: string[] = [...(hotel.gallery ?? [])];
      let newCover = hotel.cover_image as string | null;
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name}: ${t("hotelDash.fileTooLarge")}`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${hotel.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("hotel-photos").upload(path, file, {
          contentType: file.type, upsert: false,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("hotel-photos").getPublicUrl(path);
        newGallery.push(pub.publicUrl);
        if (!newCover) newCover = pub.publicUrl;
      }
      const { error: updErr } = await supabase.from("hotels")
        .update({ gallery: newGallery, cover_image: newCover })
        .eq("id", hotel.id);
      if (updErr) throw updErr;
      toast.success(t("hotelDash.photosUploaded"));
      onChanged();
    } catch (err: any) {
      toast.error(err.message ?? t("common.error"));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removePhoto(url: string) {
    const newGallery = (hotel.gallery ?? []).filter((u: string) => u !== url);
    const newCover = hotel.cover_image === url ? (newGallery[0] ?? null) : hotel.cover_image;
    const { error } = await supabase.from("hotels").update({ gallery: newGallery, cover_image: newCover }).eq("id", hotel.id);
    if (error) { toast.error(error.message); return; }
    const marker = "/hotel-photos/";
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      const path = url.substring(idx + marker.length);
      await supabase.storage.from("hotel-photos").remove([path]);
    }
    onChanged();
  }

  async function setAsCover(url: string) {
    const { error } = await supabase.from("hotels").update({ cover_image: url }).eq("id", hotel.id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/dashboard/hotel" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> {t("hotelDash.backToHotels")}
        </Link>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-3xl text-primary flex items-center gap-2"><Building2 className="h-7 w-7" /> {hotel.name}</h1>
            <Badge className={hotel.status === "approved" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}>
              {t(`hotelDash.statuses.${hotel.status}`)}
            </Badge>
          </div>
          <div className="mt-1 text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
            <span>{hotel.city}, {hotel.country}</span>
            <span className="flex text-gold">{Array.from({ length: hotel.star_rating ?? 0 }).map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}</span>
          </div>
        </div>
      </div>

      {hotel.status === "pending" && (
        <Card><CardContent className="p-5 bg-accent/40 text-sm">{t("hotelDash.pendingNotice")}</CardContent></Card>
      )}

      <Card><CardContent className="p-5">
        <h2 className="font-display text-xl text-primary">{t("hotelDash.editInfo")}</h2>
        <form onSubmit={saveInfo} className="mt-4 space-y-4">
          <div><Label>{t("hotelDash.fields.name")}</Label><Input required value={name} onChange={e => setName(e.target.value)} maxLength={160} /></div>
          <CountryCitySelect
            countryId={countryId}
            cityId={cityId}
            onChange={({ countryId: c, cityId: ci }) => { setCountryId(c); setCityId(ci); }}
            required
          />
          <div><Label>{t("hotelDash.fields.address")}</Label><Input value={address} onChange={e => setAddress(e.target.value)} maxLength={240} /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("hotelDash.fields.hotelType", { defaultValue: "Hotel type" })} *</Label>
              <Select value={hotelTypeId ?? ""} onValueChange={v => setHotelTypeId(v || null)}>
                <SelectTrigger><SelectValue placeholder={t("common.selectHotelType", { defaultValue: "Select hotel type" })} /></SelectTrigger>
                <SelectContent>
                  {hotelTypes.map(ht => <SelectItem key={ht.id} value={ht.id}>{localized(ht)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("hotelDash.fields.stars")}</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={starRating} onChange={e => setStarRating(e.target.value)}>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div><Label>{t("hotelDash.fields.description")}</Label><Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} /></div>
          <div><Label>{t("hotelDash.fields.amenities")}</Label><Input value={amenities} onChange={e => setAmenities(e.target.value)} placeholder={t("hotelDash.fields.amenitiesPh")} /></div>
          <Button type="submit" variant="gold" disabled={savingInfo}>
            <Save className="h-4 w-4" /> {savingInfo ? t("common.loading") : t("hotelDash.saveInfo")}
          </Button>
        </form>
      </CardContent></Card>

      <Card><CardContent className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-display text-xl text-primary flex items-center gap-2"><ImageIcon className="h-5 w-5" /> {t("hotelDash.photos")}</h2>
          <div>
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={handleUpload} />
            <Button variant="gold" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4" /> {uploading ? t("common.loading") : t("hotelDash.uploadPhotos")}
            </Button>
          </div>
        </div>
        {(hotel.gallery?.length ?? 0) === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">{t("hotelDash.noPhotos")}</div>
        ) : (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(hotel.gallery as string[]).map((url) => (
              <div key={url} className="group relative aspect-video overflow-hidden rounded-md border border-border bg-surface">
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                <div className="absolute inset-0 hidden group-hover:flex items-end justify-between p-2 bg-gradient-to-t from-black/70 to-transparent">
                  <Button size="sm" variant="secondary" onClick={() => setAsCover(url)} disabled={hotel.cover_image === url}>
                    {hotel.cover_image === url ? t("hotelDash.coverBadge") : t("hotelDash.setCover")}
                  </Button>
                  <Button size="icon" variant="destructive" onClick={() => removePhoto(url)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {hotel.cover_image === url && (
                  <div className="absolute top-1 left-1"><Badge className="bg-gold text-primary">{t("hotelDash.coverBadge")}</Badge></div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-5">
        <h2 className="font-display text-xl text-primary">{t("hotelDash.rooms")}</h2>
        <div className="mt-4 grid sm:grid-cols-5 gap-2 items-end">
          <div className="sm:col-span-2"><Label>{t("hotelDash.fields.roomType")}</Label><Input value={roomType} onChange={e => setRoomType(e.target.value)} placeholder="Quad room" /></div>
          <div><Label>{t("hotelDash.fields.capacity")}</Label><Input type="number" min={1} max={20} value={capacity} onChange={e => setCapacity(e.target.value)} /></div>
          <div><Label>{t("hotelDash.fields.count")}</Label><Input type="number" min={0} value={count} onChange={e => setCount(e.target.value)} /></div>
          <div><Label>{t("hotelDash.fields.price")}</Label><Input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} /></div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <select className="flex h-9 rounded-md border border-input bg-background px-3 text-sm" value={currency} onChange={e => setCurrency(e.target.value)}>
            {["USD","EUR","SAR","AED","GBP"].map(c => <option key={c}>{c}</option>)}
          </select>
          <Button variant="gold" size="sm" onClick={() => addRoom.mutate()} disabled={!roomType || !price}>
            <Plus className="h-4 w-4" /> {t("hotelDash.addRoom")}
          </Button>
        </div>
        <div className="mt-5 space-y-2">
          {rooms.length === 0 ? <div className="text-sm text-muted-foreground">{t("hotelDash.noRooms")}</div> :
            rooms.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{r.room_type}</span>
                  <span className="text-muted-foreground"> · {r.capacity} pax · {r.count_available} avail · {r.currency} {Number(r.base_price).toLocaleString()}{t("hotels.perNight")}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => delRoom.mutate(r.id)}><Trash2 className="h-4 w-4 text-error" /></Button>
              </div>
            ))}
        </div>
      </CardContent></Card>
    </div>
  );
}
