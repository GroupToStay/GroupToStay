import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Plus, Trash2, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/hotel")({
  head: () => ({ meta: [{ title: "My hotel — GroupToStay" }] }),
  component: Page,
});

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function Page() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: hotel, isLoading } = useQuery({
    queryKey: ["my-hotel", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("hotels").select("*").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
  });

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!hotel) return <CreateHotelForm onCreated={() => qc.invalidateQueries({ queryKey: ["my-hotel", user?.id] })} />;
  return <ManageHotel hotel={hotel} />;
}

function CreateHotelForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  const [starRating, setStarRating] = useState("4");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [amenities, setAmenities] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("hotels").insert({
        owner_id: user.id,
        name, city, country, address: address || null,
        slug: `${slugify(name)}-${Date.now().toString(36)}`,
        star_rating: Number(starRating),
        description: description || null,
        cover_image: coverImage || null,
        amenities: amenities.split(",").map(s => s.trim()).filter(Boolean),
        status: "pending",
      });
      if (error) throw error;
      toast.success(t("hotelDash.createdToast"));
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-primary">{t("hotelDash.createTitle")}</h1>
      <p className="mt-1 text-muted-foreground">{t("hotelDash.createSubtitle")}</p>
      <Card className="mt-6"><CardContent className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <div><Label>{t("hotelDash.fields.name")}</Label><Input required value={name} onChange={e => setName(e.target.value)} maxLength={160} /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label>{t("hotelDash.fields.city")}</Label><Input required value={city} onChange={e => setCity(e.target.value)} maxLength={80} /></div>
            <div><Label>{t("hotelDash.fields.country")}</Label><Input required value={country} onChange={e => setCountry(e.target.value)} maxLength={80} /></div>
          </div>
          <div><Label>{t("hotelDash.fields.address")}</Label><Input value={address} onChange={e => setAddress(e.target.value)} maxLength={240} /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label>{t("hotelDash.fields.stars")}</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={starRating} onChange={e => setStarRating(e.target.value)}>
                {[3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div><Label>{t("hotelDash.fields.coverImage")}</Label><Input type="url" value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="https://…" /></div>
          </div>
          <div><Label>{t("hotelDash.fields.description")}</Label><Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} /></div>
          <div><Label>{t("hotelDash.fields.amenities")}</Label><Input value={amenities} onChange={e => setAmenities(e.target.value)} placeholder={t("hotelDash.fields.amenitiesPh")} /></div>
          <Button type="submit" variant="gold" disabled={submitting}>{submitting ? t("rfq.submitting") : t("hotelDash.createSubmit")}</Button>
        </form>
      </CardContent></Card>
    </div>
  );
}

function ManageHotel({ hotel }: { hotel: any }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
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

  return (
    <div className="space-y-6">
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
