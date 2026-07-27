import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarCheck, CalendarDays, Hotel, MapPin, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useApplicationLocale } from "@/lib/application-locale";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard/bookings/")({
  head: () => ({ meta: [{ title: i18n.t("dashboard.bookings.metaTitle") }] }),
  component: BookingsPage,
});

function BookingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { formatDate, formatNumber } = useApplicationLocale();

  const {
    data: bookings = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["bookings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("bookings")
        .select(
          "*, rfqs:rfq_id(id, title, destination_city, destination_country, check_in, check_out, guests_count, rooms_needed), quotes:quote_id(id, currency, total_price), hotels:hotel_id(id, name, city, country, cover_image)",
        )
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.bookings.title")}
        description={t("dashboard.bookings.description")}
        icon={CalendarCheck}
      />

      {isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : error ? (
        <EmptyState
          icon={CalendarCheck}
          title={t("dashboard.bookings.loadErrorTitle")}
          description={t("dashboard.bookings.loadErrorDescription")}
        />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={t("dashboard.bookings.emptyTitle")}
          description={t("dashboard.bookings.emptyDescription")}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {bookings.map((booking: any) => {
            const rfq = booking.rfqs;
            const quote = booking.quotes;
            const hotel = booking.hotels;
            return (
              <Link
                key={booking.id}
                to="/dashboard/bookings/$id"
                params={{ id: booking.id }}
                className="block"
              >
                <Card className="h-full transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[var(--shadow-elevated)]">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md bg-primary/5 text-primary">
                            <Hotel className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <h2 className="truncate font-semibold text-foreground">
                              {hotel?.name ?? t("dashboard.bookings.hotelFallback")}
                            </h2>
                            <p className="truncate text-sm text-muted-foreground">
                              {rfq?.title ?? t("dashboard.bookings.requestFallback")}
                            </p>
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={booking.status} />
                    </div>

                    <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                      <span className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        {rfq?.destination_city}, {rfq?.destination_country}
                      </span>
                      <span className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        {rfq?.check_in && rfq?.check_out
                          ? `${formatDate(rfq.check_in)} - ${formatDate(rfq.check_out)}`
                          : t("common.notAvailable")}
                      </span>
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        {t("dashboard.bookings.guestsRooms", {
                          guests: rfq?.guests_count ?? 0,
                          rooms: rfq?.rooms_needed ?? 0,
                        })}
                      </span>
                      <span className="font-semibold text-foreground sm:text-end">
                        {formatNumber(Number(quote?.total_price ?? booking.total_amount), {
                          style: "currency",
                          currency: quote?.currency ?? "SAR",
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
