import { createFileRoute, redirect } from "@tanstack/react-router";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Inbox,
  MapPin,
  Calendar,
  Users,
  Building2,
  ShieldCheck,
  Pencil,
  Undo2,
  XCircle,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { useApplicationLocale } from "@/lib/application-locale";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/invitations")({
  head: () => ({ meta: [{ title: i18n.t("hotelDash.meta.invitations") }] }),
  beforeLoad: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const list = (roles ?? []).map((r) => r.role);
    if (list.includes("admin") || !list.includes("hotel")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: hotels = [] } = useQuery({
    queryKey: ["my-hotels-min", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("hotels")
        .select("id, name, status")
        .eq("owner_id", user!.id);
      return data ?? [];
    },
  });

  const hotelIds = hotels.filter((h: any) => h.status === "approved").map((h: any) => h.id);
  const hotelById = Object.fromEntries(hotels.map((h: any) => [h.id, h]));

  const {
    data: invitations = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["hotel-invitations", hotelIds.join(",")],
    enabled: hotelIds.length > 0,
    queryFn: async () => {
      const { data: invs, error: invErr } = await supabase
        .from("rfq_invitations")
        .select("*, rfqs(*)")
        .in("hotel_id", hotelIds)
        .order("created_at", { ascending: false });
      if (invErr) throw invErr;
      const rows = invs ?? [];
      const rfqIds = rows.map((r: any) => r.rfq_id).filter(Boolean);
      let quotes: any[] = [];
      if (rfqIds.length > 0) {
        const { data: qs } = await supabase
          .from("quotes")
          .select(
            "id, rfq_id, status, hotel_id, total_price, price_per_room_night, currency, board_included, valid_until, inclusions, notes",
          )
          .in("rfq_id", rfqIds)
          .in("hotel_id", hotelIds);
        quotes = qs ?? [];
      }
      return rows.map((inv: any) => ({
        ...inv,
        myQuote: quotes.find((q) => q.rfq_id === inv.rfq_id && q.hotel_id === inv.hotel_id) ?? null,
      }));
    },
  });

  if (error) {
    console.error("Group Requests load error:", error);
  }

  if (hotels.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title={t("hotelDash.needsHotel")}
        description={t("hotelDash.needsHotelDescription")}
        actionLabel={t("hotelDash.addHotelShort")}
        actionTo="/dashboard/hotel"
      />
    );
  }

  const approvedHotels = hotels.filter((h: any) => h.status === "approved");
  if (approvedHotels.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={t("hotelDash.waitingApproval")}
        description={t("hotelDash.profileNotApprovedYet")}
        actionLabel={t("hotelDash.reviewHotelProfile")}
        actionTo="/dashboard/hotel"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("hotelDash.invitations")}
        description={t("hotelDash.invitationsSubtitle")}
        icon={Inbox}
      />

      {isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : invitations.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t("hotelDash.noInvitations")}
          description={t("hotelDash.noInvitationsDescription")}
        />
      ) : (
        <div className="space-y-3">
          {invitations.map((inv: any) => (
            <InvitationCard
              key={inv.id}
              inv={inv}
              hotelName={hotelById[inv.hotel_id]?.name ?? ""}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InvitationCard({ inv, hotelName }: { inv: any; hotelName: string }) {
  const { t } = useTranslation();
  const { formatNumber } = useApplicationLocale();
  const qc = useQueryClient();
  const rfq = inv.rfqs;
  const rfqIsActive = ["open", "quoting", "under_review"].includes(rfq?.status);
  const quoteIsActive =
    inv.myQuote && ["submitted", "viewed", "shortlisted"].includes(inv.myQuote.status);
  const canSubmit = !inv.myQuote && ["pending", "viewed"].includes(inv.status) && rfqIsActive;

  const withdraw = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("quotes")
        .update({ status: "withdrawn" })
        .eq("id", inv.myQuote.id)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("hotelDash.quoteManagement.withdrawnToast"));
      qc.invalidateQueries({ queryKey: ["hotel-invitations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const decline = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("rfq_invitations")
        .update({ status: "declined" })
        .eq("id", inv.id)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("hotelDash.quoteManagement.declinedToast"));
      qc.invalidateQueries({ queryKey: ["hotel-invitations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!rfq) return null;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-lg text-primary">{rfq.title}</h3>
              <StatusBadge status={rfq.status} />
              {inv.myQuote && <StatusBadge status={inv.myQuote.status} />}
            </div>
            {hotelName && (
              <div className="mt-1 text-xs text-muted-foreground">
                {t("hotelDash.forHotel")}:{" "}
                <span className="font-medium text-foreground">{hotelName}</span>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {rfq.destination_city}, {rfq.destination_country}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {rfq.check_in} → {rfq.check_out} ({rfq.nights}{" "}
                {t("dashboard.nights")})
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {rfq.guests_count} {t("dashboard.guests")} ·{" "}
                {rfq.rooms_needed} {t("dashboard.rooms")}
              </span>
            </div>
            {rfq.special_requirements && <p className="mt-2 text-sm">{rfq.special_requirements}</p>}
            <div className="mt-2 text-sm text-muted-foreground">
              {t("rfq.fields.board")}: {t(`rfq.boards.${rfq.board_type}`)}
              {rfq.budget_max && (
                <>
                  {" "}
                  · {t("rfq.fields.budgetMax")}: {rfq.budget_max} {rfq.currency}
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 text-end">
            {inv.myQuote ? (
              <div>
                <div className="font-display text-xl text-primary">
                  {inv.myQuote.currency} {formatNumber(inv.myQuote.total_price)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("hotelDash.quoteSubmitted")}
                </div>
              </div>
            ) : null}
            {quoteIsActive && rfqIsActive ? (
              <div className="flex flex-wrap justify-end gap-2">
                <QuoteDialog rfq={rfq} hotelId={inv.hotel_id} quote={inv.myQuote} />
                <ConfirmationAction
                  icon={Undo2}
                  label={t("hotelDash.quoteManagement.withdraw")}
                  title={t("hotelDash.quoteManagement.withdrawTitle")}
                  description={t("hotelDash.quoteManagement.withdrawDescription")}
                  pending={withdraw.isPending}
                  onConfirm={() => withdraw.mutate()}
                />
              </div>
            ) : canSubmit ? (
              <div className="flex flex-wrap justify-end gap-2">
                <QuoteDialog rfq={rfq} hotelId={inv.hotel_id} />
                <ConfirmationAction
                  icon={XCircle}
                  label={t("hotelDash.quoteManagement.decline")}
                  title={t("hotelDash.quoteManagement.declineTitle")}
                  description={t("hotelDash.quoteManagement.declineDescription")}
                  pending={decline.isPending}
                  onConfirm={() => decline.mutate()}
                />
              </div>
            ) : inv.status === "declined" ? (
              <StatusBadge status="declined" />
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmationAction({
  icon: Icon,
  label,
  title,
  description,
  pending,
  onConfirm,
}: {
  icon: typeof Undo2;
  label: string;
  title: string;
  description: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Icon className="h-4 w-4" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending}>
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function QuoteDialog({ rfq, hotelId, quote }: { rfq: any; hotelId: string; quote?: any }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [totalPrice, setTotalPrice] = useState(String(quote?.total_price ?? ""));
  const [perNight, setPerNight] = useState(String(quote?.price_per_room_night ?? ""));
  const [board, setBoard] = useState<string>(quote?.board_included ?? rfq.board_type);
  const [validUntil, setValidUntil] = useState(quote?.valid_until ?? "");
  const [inclusions, setInclusions] = useState(quote?.inclusions ?? "");
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const editing = !!quote;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setTotalPrice(String(quote?.total_price ?? ""));
      setPerNight(String(quote?.price_per_room_night ?? ""));
      setBoard(quote?.board_included ?? rfq.board_type);
      setValidUntil(quote?.valid_until ?? "");
      setInclusions(quote?.inclusions ?? "");
      setNotes(quote?.notes ?? "");
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      const values = {
        rfq_id: rfq.id,
        hotel_id: hotelId,
        total_price: Number(totalPrice),
        price_per_room_night: perNight ? Number(perNight) : null,
        currency: rfq.currency,
        board_included: board as any,
        valid_until: validUntil || null,
        inclusions: inclusions || null,
        notes: notes || null,
      };
      const { error } = editing
        ? await supabase
            .from("quotes")
            .update({
              total_price: values.total_price,
              price_per_room_night: values.price_per_room_night,
              board_included: values.board_included,
              valid_until: values.valid_until,
              inclusions: values.inclusions,
              notes: values.notes,
            })
            .eq("id", quote.id)
            .select("id")
            .single()
        : await supabase.from("quotes").insert(values);
      if (error) throw error;
      toast.success(
        t(
          editing
            ? "hotelDash.quoteManagement.updatedToast"
            : "hotelDash.quoteManagement.submittedToast",
        ),
      );
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["hotel-invitations"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={editing ? "outline" : "gold"} size="sm">
          {editing ? <Pencil className="h-4 w-4" /> : null}
          {t(
            editing
              ? "hotelDash.quoteManagement.editQuote"
              : "hotelDash.quoteManagement.submitQuote",
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t(
              editing
                ? "hotelDash.quoteManagement.editQuote"
                : "hotelDash.quoteManagement.submitQuote",
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="invitation-total-price">
              {t("hotelDash.fields.totalPrice")} ({rfq.currency})
            </Label>
            <Input
              id="invitation-total-price"
              type="number"
              min={0}
              value={totalPrice}
              onChange={(e) => setTotalPrice(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="invitation-per-night">
              {t("hotelDash.fields.perNight")} ({rfq.currency})
            </Label>
            <Input
              id="invitation-per-night"
              type="number"
              min={0}
              value={perNight}
              onChange={(e) => setPerNight(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="invitation-board">{t("rfq.fields.board")}</Label>
            <select
              id="invitation-board"
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
            <Label htmlFor="invitation-valid-until">{t("hotelDash.fields.validUntil")}</Label>
            <Input
              id="invitation-valid-until"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="invitation-inclusions">{t("hotelDash.fields.inclusions")}</Label>
            <Input
              id="invitation-inclusions"
              value={inclusions}
              onChange={(e) => setInclusions(e.target.value)}
              maxLength={500}
            />
          </div>
          <div>
            <Label htmlFor="invitation-notes">{t("hotelDash.fields.notes")}</Label>
            <Textarea
              id="invitation-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="gold" onClick={submit} disabled={!totalPrice || submitting}>
            {submitting
              ? t("rfq.submitting")
              : t(editing ? "common.save" : "hotelDash.quoteManagement.submitQuote")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
