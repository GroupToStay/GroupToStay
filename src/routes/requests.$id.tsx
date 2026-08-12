"use client";

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { MapPin, Calendar, Users, ArrowLeft, LogIn, Send } from "lucide-react";
import { toast } from "sonner";
import { useApplicationLocale } from "@/lib/application-locale";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { PageHeader } from "@/components/workspace/page-header";
import { WorkspaceSection } from "@/components/workspace/section";
import { StatusBadge } from "@/components/workspace/status-badge";

export const Route = createFileRoute("/requests/$id")({
  head: () => ({ meta: [{ title: i18n.t("rfq.detail.metaTitle") }] }),
  component: Page,
  errorComponent: () => (
    <div className="p-8 text-center text-muted-foreground">{i18n.t("rfq.detail.loadError")}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-muted-foreground">{i18n.t("rfq.detail.notFound")}</div>
  ),
});

export function Page() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isHotel, isOrganizer } = useRoles();

  const { data: rfq, isLoading } = useQuery({
    queryKey: ["public-rfq", id],
    queryFn: async () => {
      const { data } = await supabase.from("rfqs").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return <div className="container-page py-20 text-muted-foreground">{t("common.loading")}</div>;
  }
  if (!rfq) throw notFound();

  const isOwner = user?.id === rfq.organizer_id;
  const canMessage = !!user && (isHotel || isOwner);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container-page py-10 space-y-6">
        <PageHeader
          title={rfq.title}
          eyebrow={
            <Link
              to="/requests"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> {t("rfq.detail.allRequests")}
            </Link>
          }
          description={
            <span className="flex flex-wrap gap-x-4 gap-y-2">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {rfq.destination_city}, {rfq.destination_country}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {rfq.check_in} - {rfq.check_out} (
                {t("rfq.publicRequests.nightsShort", { count: rfq.nights })})
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {rfq.guests_count} {t("dashboard.guests")} /{" "}
                {rfq.rooms_needed} {t("dashboard.rooms")}
              </span>
            </span>
          }
          meta={
            <>
              <StatusBadge status={rfq.status} />
              <Badge variant="outline" className="uppercase">
                {rfq.group_type}
              </Badge>
            </>
          }
          actions={
            user && isHotel && rfq.status === "open" ? (
              <SubmitQuoteForHotel rfq={rfq} userId={user.id} />
            ) : null
          }
        />

        <Card>
          <CardContent className="p-5 grid sm:grid-cols-2 gap-4 text-sm">
            <Detail
              label={t("rfq.detail.details.board")}
              value={t(`rfq.boards.${rfq.board_type}`)}
            />
            <Detail
              label={t("rfq.detail.details.roomPreference")}
              value={rfq.room_type_pref || t("common.notAvailable")}
            />
            <Detail
              label={t("rfq.detail.details.pricing")}
              value={t("rfq.detail.details.pricingValue")}
            />
            <Detail
              label={t("rfq.detail.details.deadline")}
              value={rfq.deadline || t("common.notAvailable")}
            />
            <div className="sm:col-span-2">
              <Detail
                label={t("rfq.detail.details.specialRequirements")}
                value={rfq.special_requirements || t("common.notAvailable")}
              />
            </div>
          </CardContent>
        </Card>

        <WorkspaceSection title={t("rfq.detail.messageOrganizer")}>
          {!user ? (
            <Card>
              <CardContent className="p-6 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-muted-foreground">{t("rfq.detail.hotelSignInPrompt")}</p>
                <Button asChild>
                  <Link to="/auth">
                    <LogIn className="h-4 w-4" /> {t("auth.submitSignIn")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : canMessage ? (
            <Conversation
              rfqId={id}
              rfqOrganizerId={rfq.organizer_id}
              viewerId={user.id}
              isOwner={isOwner}
            />
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                {t("rfq.detail.hotelOnlyContact")}
                {isOrganizer && ` ${t("rfq.detail.signedInAsAgency")}`}
              </CardContent>
            </Card>
          )}
        </WorkspaceSection>
      </main>
      <SiteFooter />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-foreground">{value}</div>
    </div>
  );
}

function Conversation({
  rfqId,
  rfqOrganizerId,
  viewerId,
  isOwner,
}: {
  rfqId: string;
  rfqOrganizerId: string;
  viewerId: string;
  isOwner: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { formatDateTime } = useApplicationLocale();
  const [text, setText] = useState("");
  // If hotel viewer: thread is between this hotel and organizer.
  // If organizer (owner) viewer: show all messages on RFQ; reply to currently selected hotel.
  const { data: msgs = [] } = useQuery({
    queryKey: ["public-rfq-messages", rfqId, viewerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id,body,created_at,sender_id,recipient_id")
        .eq("rfq_id", rfqId)
        .order("created_at");
      return data ?? [];
    },
  });

  // For organizer: list of unique hotel user IDs that have messaged.
  const hotelIds = useMemo(
    () =>
      isOwner
        ? Array.from(
            new Set(
              msgs
                .flatMap((m) => [m.sender_id, m.recipient_id])
                .filter((id) => id !== rfqOrganizerId),
            ),
          )
        : [],
    [isOwner, msgs, rfqOrganizerId],
  );
  const [activeHotelId, setActiveHotelId] = useState<string | null>(null);
  useEffect(() => {
    if (isOwner && !activeHotelId && hotelIds.length > 0) setActiveHotelId(hotelIds[0]);
  }, [isOwner, activeHotelId, hotelIds]);

  const threadMsgs = isOwner
    ? msgs.filter(
        (m) => activeHotelId && (m.sender_id === activeHotelId || m.recipient_id === activeHotelId),
      )
    : msgs.filter((m) => m.sender_id === viewerId || m.recipient_id === viewerId);

  const send = useMutation({
    mutationFn: async () => {
      if (!text.trim()) return;
      const recipient_id = isOwner ? activeHotelId : rfqOrganizerId;
      if (!recipient_id) throw new Error(t("rfq.detail.messages.noRecipient"));
      const { error } = await supabase.from("messages").insert({
        rfq_id: rfqId,
        sender_id: viewerId,
        recipient_id,
        body: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["public-rfq-messages", rfqId, viewerId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        {isOwner && (
          <div className="flex flex-wrap gap-2">
            {hotelIds.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                {t("rfq.detail.messages.noHotelsMessaged")}
              </span>
            ) : (
              hotelIds.map((hid) => (
                <Button
                  key={hid}
                  size="sm"
                  variant={hid === activeHotelId ? "default" : "outline"}
                  onClick={() => setActiveHotelId(hid)}
                >
                  {t("rfq.detail.messages.hotelLabel", { id: hid.slice(0, 8) })}
                </Button>
              ))
            )}
          </div>
        )}

        <div className="space-y-2 max-h-72 overflow-y-auto rounded-md bg-muted/30 p-3 min-h-[80px]">
          {threadMsgs.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6">
              {isOwner ? t("rfq.detail.messages.emptyOwner") : t("rfq.detail.messages.emptyHotel")}
            </div>
          ) : (
            threadMsgs.map((m) => (
              <div
                key={m.id}
                className={`text-sm rounded-md px-3 py-2 max-w-[80%] w-fit ${m.sender_id === viewerId ? "bg-primary text-primary-foreground ms-auto" : "bg-background border border-border"}`}
              >
                {m.body}
                <div
                  className={`text-[10px] mt-1 ${m.sender_id === viewerId ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                >
                  {formatDateTime(m.created_at)}
                </div>
              </div>
            ))
          )}
        </div>

        {(!isOwner || activeHotelId) && (
          <div className="flex gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("rfq.detail.messages.placeholder")}
              rows={2}
              maxLength={1000}
            />
            <Button
              onClick={() => send.mutate()}
              variant="gold"
              disabled={!text.trim() || send.isPending}
            >
              {t("common.send")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubmitQuoteForHotel({ rfq, userId }: { rfq: any; userId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { formatNumber } = useApplicationLocale();
  const [open, setOpen] = useState(false);
  const [hotelId, setHotelId] = useState<string>("");
  const [totalPrice, setTotalPrice] = useState("");
  const [perNight, setPerNight] = useState("");
  const [board, setBoard] = useState<string>(rfq.board_type);
  const [validUntil, setValidUntil] = useState("");
  const [inclusions, setInclusions] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: hotels = [] } = useQuery({
    queryKey: ["my-approved-hotels", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("hotels")
        .select("id, name, status")
        .eq("owner_id", userId)
        .eq("status", "approved");
      return data ?? [];
    },
  });

  const { data: existingQuote } = useQuery({
    queryKey: ["my-quote-for-rfq", rfq.id, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("quotes")
        .select("id, hotel_id, total_price, currency, status, hotels!inner(owner_id)")
        .eq("rfq_id", rfq.id)
        .eq("hotels.owner_id", userId)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!hotelId && hotels[0]) setHotelId(hotels[0].id);
  }, [hotels, hotelId]);

  async function submit() {
    if (!hotelId) {
      toast.error(t("rfq.detail.quote.selectHotel"));
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("quotes").insert({
        rfq_id: rfq.id,
        hotel_id: hotelId,
        total_price: Number(totalPrice),
        price_per_room_night: perNight ? Number(perNight) : null,
        currency: rfq.currency,
        board_included: board as any,
        valid_until: validUntil || null,
        inclusions: inclusions || null,
        notes: notes || null,
      });
      if (error) throw error;
      toast.success(t("rfq.detail.quote.sentToast"));
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["my-quote-for-rfq", rfq.id, userId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (existingQuote) {
    return (
      <div className="text-end">
        <Badge className="bg-gold/20 text-gold-foreground border border-gold/30">
          {t("rfq.detail.quote.submitted")}
        </Badge>
        <div className="mt-1 font-display text-lg text-primary">
          {existingQuote.currency} {formatNumber(existingQuote.total_price)}
        </div>
      </div>
    );
  }

  if (hotels.length === 0) {
    return (
      <div className="text-xs text-muted-foreground max-w-[220px] text-end">
        {t("rfq.detail.quote.approvalRequired")}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gold">
          <Send className="h-4 w-4" /> {t("rfq.detail.quote.submit")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("rfq.detail.quote.dialogTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {hotels.length > 1 && (
            <div>
              <Label htmlFor="quote-hotel">{t("rfq.detail.quote.hotel")}</Label>
              <select
                id="quote-hotel"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={hotelId}
                onChange={(e) => setHotelId(e.target.value)}
              >
                {hotels.map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label htmlFor="quote-total-price">
              {t("rfq.detail.quote.totalPrice")} ({rfq.currency})
            </Label>
            <Input
              id="quote-total-price"
              type="number"
              min={0}
              value={totalPrice}
              onChange={(e) => setTotalPrice(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="quote-per-room-night">
              {t("rfq.detail.quote.perRoomNight")} ({rfq.currency})
            </Label>
            <Input
              id="quote-per-room-night"
              type="number"
              min={0}
              value={perNight}
              onChange={(e) => setPerNight(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="quote-board">{t("rfq.detail.details.board")}</Label>
            <select
              id="quote-board"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={board}
              onChange={(e) => setBoard(e.target.value)}
            >
              {["room_only", "breakfast", "half_board", "full_board"].map((b) => (
                <option key={b} value={b}>
                  {t(`rfq.boards.${b}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="quote-valid-until">{t("rfq.detail.quote.validUntil")}</Label>
            <Input
              id="quote-valid-until"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="quote-inclusions">{t("rfq.detail.quote.inclusions")}</Label>
            <Input
              id="quote-inclusions"
              value={inclusions}
              onChange={(e) => setInclusions(e.target.value)}
              maxLength={500}
            />
          </div>
          <div>
            <Label htmlFor="quote-notes">{t("rfq.detail.quote.notes")}</Label>
            <Textarea
              id="quote-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="gold" onClick={submit} disabled={!totalPrice || submitting}>
            {submitting ? t("rfq.detail.quote.sending") : t("rfq.detail.quote.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
