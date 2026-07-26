import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  CalendarDays,
  Download,
  FileText,
  Hotel,
  MapPin,
  MessageSquare,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useApplicationLocale } from "@/lib/application-locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/workspace/page-header";
import { WorkspaceSection } from "@/components/workspace/section";
import { StatusBadge } from "@/components/workspace/status-badge";
import i18n from "@/lib/i18n";

type Attachment = { path: string; name: string; size?: number; type?: string };

export const Route = createFileRoute("/_authenticated/dashboard/bookings/$id")({
  head: () => ({ meta: [{ title: i18n.t("dashboard.bookings.detailMetaTitle") }] }),
  component: BookingDetailPage,
});

function BookingDetailPage() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { formatDate, formatDateTime, formatNumber } = useApplicationLocale();

  const { data, isLoading, error } = useQuery({
    queryKey: ["booking", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select(
          "*, rfqs:rfq_id(*), quotes:quote_id(*), hotels:hotel_id(id, name, city, country, address, cover_image, star_rating)",
        )
        .eq("id", id)
        .maybeSingle();
      if (bookingError) throw bookingError;
      if (!booking) return null;

      const [{ data: conversation }, { data: events }, { data: agency }] = await Promise.all([
        supabase
          .from("conversations")
          .select("id")
          .eq("rfq_id", booking.rfq_id)
          .eq("hotel_id", booking.hotel_id)
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from("rfq_lifecycle_events")
          .select("id, event_type, from_status, to_status, created_at")
          .eq("rfq_id", booking.rfq_id)
          .order("created_at", { ascending: true }),
        supabase
          .from("profiles")
          .select("id, legal_company_name, trade_name, company_name, country, website")
          .eq("id", booking.organizer_id)
          .maybeSingle(),
      ]);

      let attachments: Attachment[] = [];
      if (conversation?.id) {
        const { data: messages } = await supabase
          .from("chat_messages")
          .select("attachments")
          .eq("conversation_id", conversation.id);
        attachments = (messages ?? []).flatMap((message: any) =>
          Array.isArray(message.attachments) ? message.attachments : [],
        );
      }

      return {
        booking,
        conversation,
        events: events ?? [],
        agency,
        attachments,
      };
    },
  });

  async function downloadAttachment(attachment: Attachment) {
    const { data: signed, error: signedError } = await supabase.storage
      .from("chat-attachments")
      .createSignedUrl(attachment.path, 60);
    if (signedError || !signed?.signedUrl) {
      toast.error(t("dashboard.bookings.downloadError"));
      return;
    }
    window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (error) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title={t("dashboard.bookings.loadErrorTitle")}
        description={t("dashboard.bookings.loadErrorDescription")}
      />
    );
  }
  if (!data) throw notFound();

  const { booking, conversation, events, agency, attachments } = data;
  const rfq = booking.rfqs as any;
  const quote = booking.quotes as any;
  const hotel = booking.hotels as any;
  const agencyName =
    agency?.legal_company_name ??
    agency?.trade_name ??
    agency?.company_name ??
    t("dashboard.bookings.agencyFallback");

  return (
    <div className="space-y-8">
      <PageHeader
        title={hotel?.name ?? t("dashboard.bookings.detailTitle")}
        eyebrow={
          <Link
            to="/dashboard/bookings"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            {t("dashboard.bookings.backToBookings")}
          </Link>
        }
        description={rfq?.title}
        icon={CalendarCheck}
        meta={<StatusBadge status={booking.status} />}
        actions={
          conversation?.id ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/messages/$id" params={{ id: conversation.id }}>
                <MessageSquare className="h-4 w-4" />
                {t("dashboard.bookings.openMessages")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={MapPin}
          label={t("dashboard.bookings.destination")}
          value={`${rfq?.destination_city ?? ""}, ${rfq?.destination_country ?? ""}`}
        />
        <SummaryCard
          icon={CalendarDays}
          label={t("dashboard.bookings.stayDates")}
          value={
            rfq?.check_in && rfq?.check_out
              ? `${formatDate(rfq.check_in)} - ${formatDate(rfq.check_out)}`
              : t("common.notAvailable")
          }
        />
        <SummaryCard
          icon={Users}
          label={t("dashboard.bookings.group")}
          value={t("dashboard.bookings.guestsRooms", {
            guests: rfq?.guests_count ?? 0,
            rooms: rfq?.rooms_needed ?? 0,
          })}
        />
        <SummaryCard
          icon={CalendarCheck}
          label={t("dashboard.bookings.total")}
          value={formatNumber(Number(quote?.total_price ?? booking.total_amount), {
            style: "currency",
            currency: quote?.currency ?? "SAR",
          })}
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <div className="space-y-8">
          <WorkspaceSection title={t("dashboard.bookings.participants")}>
            <div className="grid gap-4 md:grid-cols-2">
              <ParticipantCard
                icon={Hotel}
                label={t("role.hotel")}
                name={hotel?.name ?? t("dashboard.bookings.hotelFallback")}
                details={[hotel?.city, hotel?.country].filter(Boolean).join(", ")}
              />
              <ParticipantCard
                icon={Building2}
                label={t("role.agency")}
                name={agencyName}
                details={agency?.country ?? t("dashboard.bookings.privateAgencyDetails")}
              />
            </div>
          </WorkspaceSection>

          <WorkspaceSection
            title={t("dashboard.bookings.documentsAttachments")}
            description={t("dashboard.bookings.documentsDescription")}
          >
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {booking.contract_url ? (
                  <a
                    href={booking.contract_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-4 hover:bg-muted/30"
                  >
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="flex-1 font-medium">{t("dashboard.bookings.contract")}</span>
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </a>
                ) : null}
                {attachments.map((attachment, index) => (
                  <button
                    key={`${attachment.path}-${index}`}
                    type="button"
                    onClick={() => void downloadAttachment(attachment)}
                    className="flex w-full items-center gap-3 p-4 text-start hover:bg-muted/30"
                  >
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="flex-1 truncate font-medium">{attachment.name}</span>
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
                {!booking.contract_url && attachments.length === 0 ? (
                  <div className="p-5 text-sm text-muted-foreground">
                    {t("dashboard.bookings.noDocuments")}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </WorkspaceSection>
        </div>

        <WorkspaceSection title={t("dashboard.bookings.timeline")}>
          <Card>
            <CardContent className="p-5">
              <ol className="space-y-5">
                <TimelineItem
                  title={t("dashboard.bookings.bookingCreated")}
                  detail={formatDateTime(booking.created_at)}
                />
                {events.map((event: any) => (
                  <TimelineItem
                    key={event.id}
                    title={t(`dashboard.bookings.events.${event.event_type}`, {
                      defaultValue: event.event_type,
                    })}
                    detail={formatDateTime(event.created_at)}
                  />
                ))}
              </ol>
            </CardContent>
          </Card>
        </WorkspaceSection>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md bg-primary/5 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
          <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ParticipantCard({
  icon: Icon,
  label,
  name,
  details,
}: {
  icon: typeof Hotel;
  label: string;
  name: string;
  details: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md bg-primary/5 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
          <div className="mt-1 font-semibold text-foreground">{name}</div>
          {details ? <div className="mt-1 text-sm text-muted-foreground">{details}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineItem({ title, detail }: { title: string; detail: string }) {
  return (
    <li className="relative flex gap-3 ps-1">
      <span className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-gold ring-4 ring-gold/10" />
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
      </div>
    </li>
  );
}
