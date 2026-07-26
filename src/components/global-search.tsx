import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarCheck,
  FileText,
  Hotel,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";

type SearchResult = {
  id: string;
  label: string;
  description?: string;
  to: string;
  group: "navigation" | "records";
  icon: LucideIcon;
};

function publicNavigation(t: (key: string) => string): SearchResult[] {
  return [
    { id: "home", label: t("nav.home"), to: "/", group: "navigation", icon: LayoutDashboard },
    {
      id: "how",
      label: t("nav.howItWorks"),
      to: "/how-it-works",
      group: "navigation",
      icon: FileText,
    },
    {
      id: "pricing",
      label: t("nav.pricing"),
      to: "/pricing",
      group: "navigation",
      icon: CalendarCheck,
    },
    {
      id: "contact",
      label: t("nav.contact"),
      to: "/contact",
      group: "navigation",
      icon: MessageSquare,
    },
  ];
}

function roleNavigation(
  t: (key: string) => string,
  role: "guest" | "agency" | "hotel" | "admin",
): SearchResult[] {
  if (role === "admin") {
    return [
      {
        id: "admin-home",
        label: t("nav.overview"),
        to: "/admin",
        group: "navigation",
        icon: LayoutDashboard,
      },
      {
        id: "admin-hotels",
        label: t("nav.hotels"),
        to: "/admin/hotel-listings",
        group: "navigation",
        icon: Hotel,
      },
      {
        id: "admin-agencies",
        label: t("nav.agencies"),
        to: "/admin/agency-verifications",
        group: "navigation",
        icon: Building2,
      },
      {
        id: "admin-users",
        label: t("nav.users"),
        to: "/admin/users",
        group: "navigation",
        icon: Users,
      },
      {
        id: "admin-rfqs",
        label: t("nav.groupRequests"),
        to: "/admin/group-requests",
        group: "navigation",
        icon: FileText,
      },
      {
        id: "admin-settings",
        label: t("nav.settings"),
        to: "/admin/settings",
        group: "navigation",
        icon: Settings,
      },
    ];
  }
  if (role === "hotel") {
    return [
      {
        id: "hotel-home",
        label: t("nav.dashboard"),
        to: "/dashboard",
        group: "navigation",
        icon: LayoutDashboard,
      },
      {
        id: "hotel-invitations",
        label: t("nav.openRequests"),
        to: "/dashboard/invitations",
        group: "navigation",
        icon: FileText,
      },
      {
        id: "hotel-bookings",
        label: t("dashboard.bookings.navLabel"),
        to: "/dashboard/bookings",
        group: "navigation",
        icon: CalendarCheck,
      },
      {
        id: "hotel-messages",
        label: t("dashboard.messagesTitle"),
        to: "/dashboard/messages",
        group: "navigation",
        icon: MessageSquare,
      },
      {
        id: "hotel-profile",
        label: t("nav.hotelProfile"),
        to: "/dashboard/hotel",
        group: "navigation",
        icon: Hotel,
      },
    ];
  }
  if (role === "agency") {
    return [
      {
        id: "agency-home",
        label: t("nav.dashboard"),
        to: "/dashboard",
        group: "navigation",
        icon: LayoutDashboard,
      },
      {
        id: "agency-rfqs",
        label: t("nav.myRequests"),
        to: "/dashboard/rfqs",
        group: "navigation",
        icon: FileText,
      },
      {
        id: "agency-quotes",
        label: t("nav.receivedOffers"),
        to: "/dashboard/quotations",
        group: "navigation",
        icon: Building2,
      },
      {
        id: "agency-bookings",
        label: t("dashboard.bookings.navLabel"),
        to: "/dashboard/bookings",
        group: "navigation",
        icon: CalendarCheck,
      },
      {
        id: "agency-messages",
        label: t("dashboard.messagesTitle"),
        to: "/dashboard/messages",
        group: "navigation",
        icon: MessageSquare,
      },
    ];
  }
  return publicNavigation(t);
}

async function searchVisibleRecords(
  query: string,
  role: "agency" | "hotel" | "admin",
): Promise<SearchResult[]> {
  const pattern = `%${query.replace(/[%_,()]/g, " ")}%`;
  const jobs: PromiseLike<{ data: any[] | null }>[] = [
    (supabase as any)
      .from("rfqs")
      .select("id, title, destination_city, destination_country")
      .or(
        `title.ilike.${pattern},destination_city.ilike.${pattern},destination_country.ilike.${pattern}`,
      )
      .limit(8),
    (supabase as any)
      .from("bookings")
      .select("id, status, rfqs:rfq_id(title, destination_city), hotels:hotel_id(name)")
      .limit(12),
    (supabase as any)
      .from("conversations")
      .select("id, rfqs:rfq_id(title), hotels:hotel_id(name), last_message_preview")
      .order("last_message_at", { ascending: false })
      .limit(12),
    (supabase as any)
      .from("quotes")
      .select("id, total_price, currency, rfqs:rfq_id(title), hotels:hotel_id(name)")
      .limit(12),
  ];

  if (role === "admin") {
    jobs.push(
      (supabase as any)
        .from("hotels")
        .select("id, name, city, country")
        .ilike("name", pattern)
        .limit(8),
    );
  }
  if (role === "admin") {
    jobs.push(
      (supabase as any)
        .from("profiles")
        .select("id, full_name, company_name, legal_company_name")
        .or(
          `full_name.ilike.${pattern},company_name.ilike.${pattern},legal_company_name.ilike.${pattern}`,
        )
        .limit(8),
    );
  }

  const settled = await Promise.allSettled(jobs);
  const rows = settled.map((result) =>
    result.status === "fulfilled" ? (result.value.data ?? []) : [],
  );
  const [rfqs, bookings, conversations, quotes, hotels = [], profiles = []] = rows;
  const normalizedQuery = query.toLowerCase();

  return [
    ...rfqs.map((rfq: any) => ({
      id: `rfq-${rfq.id}`,
      label: rfq.title || rfq.destination_city,
      description: [rfq.destination_city, rfq.destination_country].filter(Boolean).join(", "),
      to:
        role === "admin"
          ? "/admin/group-requests"
          : role === "hotel"
            ? "/dashboard/invitations"
            : `/dashboard/rfqs/${rfq.id}`,
      group: "records" as const,
      icon: FileText,
    })),
    ...bookings
      .filter((booking: any) => {
        const text = `${booking.rfqs?.title ?? ""} ${booking.rfqs?.destination_city ?? ""} ${
          booking.hotels?.name ?? ""
        } ${booking.status ?? ""}`.toLowerCase();
        return text.includes(normalizedQuery);
      })
      .map((booking: any) => ({
        id: `booking-${booking.id}`,
        label: booking.rfqs?.title || booking.hotels?.name || booking.id,
        description: booking.hotels?.name || booking.status,
        to: `/dashboard/bookings/${booking.id}`,
        group: "records" as const,
        icon: CalendarCheck,
      })),
    ...quotes
      .filter((quote: any) => {
        const text =
          `${quote.rfqs?.title ?? ""} ${quote.hotels?.name ?? ""} ${quote.total_price ?? ""}`.toLowerCase();
        return text.includes(normalizedQuery);
      })
      .map((quote: any) => ({
        id: `quote-${quote.id}`,
        label: quote.rfqs?.title || quote.hotels?.name || quote.id,
        description: [
          quote.hotels?.name,
          quote.total_price ? `${quote.currency ?? ""} ${quote.total_price}`.trim() : null,
        ]
          .filter(Boolean)
          .join(" - "),
        to:
          role === "admin"
            ? "/admin/group-requests"
            : role === "hotel"
              ? "/dashboard/invitations"
              : "/dashboard/quotations",
        group: "records" as const,
        icon: Building2,
      })),
    ...conversations
      .filter((conversation: any) => {
        const text = `${conversation.rfqs?.title ?? ""} ${conversation.hotels?.name ?? ""} ${
          conversation.last_message_preview ?? ""
        }`.toLowerCase();
        return text.includes(normalizedQuery);
      })
      .map((conversation: any) => ({
        id: `conversation-${conversation.id}`,
        label: conversation.hotels?.name || conversation.rfqs?.title || conversation.id,
        description: conversation.rfqs?.title || conversation.last_message_preview,
        to: `/dashboard/messages/${conversation.id}`,
        group: "records" as const,
        icon: MessageSquare,
      })),
    ...hotels.map((hotel: any) => ({
      id: `hotel-${hotel.id}`,
      label: hotel.name,
      description: [hotel.city, hotel.country].filter(Boolean).join(", "),
      to: role === "admin" ? "/admin/hotel-listings" : `/dashboard/hotel/${hotel.id}`,
      group: "records" as const,
      icon: Hotel,
    })),
    ...profiles.map((profile: any) => ({
      id: `profile-${profile.id}`,
      label: profile.legal_company_name || profile.company_name || profile.full_name || profile.id,
      description: profile.full_name,
      to: "/admin/users",
      group: "records" as const,
      icon: Users,
    })),
  ];
}

export function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isHotel } = useRoles();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const role = !user ? "guest" : isAdmin ? "admin" : isHotel ? "hotel" : "agency";
  const navigation = useMemo(() => roleNavigation(t, role), [role, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { data: records = [], isFetching } = useQuery({
    queryKey: ["global-search", user?.id, role, debouncedQuery],
    enabled: !!user && role !== "guest" && debouncedQuery.length >= 2,
    staleTime: 30_000,
    queryFn: () => searchVisibleRecords(debouncedQuery, role as "agency" | "hotel" | "admin"),
  });

  const select = (to: string) => {
    setOpen(false);
    setQuery("");
    navigate({ to: to as any });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-10 w-10 justify-center gap-2 px-0 text-muted-foreground md:w-48 md:justify-start md:px-3 xl:w-60"
        onClick={() => setOpen(true)}
        aria-label={t("navigation:globalSearch.open")}
      >
        <Search className="h-4 w-4" />
        <span className="hidden truncate md:inline">
          {t("navigation:globalSearch.placeholder")}
        </span>
        <span className="ms-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold md:inline">
          {t("navigation:globalSearch.shortcut")}
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[12vh] max-h-[76vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogTitle className="sr-only">{t("navigation:globalSearch.title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("navigation:globalSearch.description")}
          </DialogDescription>
          <Command shouldFilter>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={t("navigation:globalSearch.placeholder")}
              aria-label={t("navigation:globalSearch.placeholder")}
            />
            <CommandList className="max-h-[min(62vh,520px)]">
              <CommandEmpty>{t("navigation:globalSearch.empty")}</CommandEmpty>
              <CommandGroup heading={t("navigation:globalSearch.navigation")}>
                {navigation.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.label} ${item.description ?? ""}`}
                    onSelect={() => select(item.to)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                    <CommandShortcut>↵</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
              {isFetching ? (
                <>
                  <CommandSeparator />
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </>
              ) : records.length > 0 ? (
                <>
                  <CommandSeparator />
                  <CommandGroup heading={t("navigation:globalSearch.records")}>
                    {records.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={`${item.label} ${item.description ?? ""}`}
                        onSelect={() => select(item.to)}
                      >
                        <item.icon />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{item.label}</span>
                          {item.description ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                        <CommandShortcut>↵</CommandShortcut>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              ) : null}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
