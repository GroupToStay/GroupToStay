import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, CircleAlert, Inbox, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications, type NotificationRow } from "@/hooks/use-notifications";
import { useApplicationLocale } from "@/lib/application-locale";
import { getSafeNotificationHref } from "@/lib/notification-link";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread" | "read" | "priority";

function isPriority(notification: NotificationRow) {
  const value = String(notification.metadata?.priority ?? "").toLowerCase();
  return value === "high" || value === "urgent" || value === "critical";
}

function relativeTime(iso: string, locale: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (seconds < 60) return formatter.format(-seconds, "second");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return formatter.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatter.format(-hours, "hour");
  return formatter.format(-Math.floor(hours / 24), "day");
}

export function NotificationPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { intlLocale } = useApplicationLocale();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const { items, loading, unreadCount, hasMore, loadMore, markRead, markAllRead, remove } =
    useNotifications(30);

  const filtered = useMemo(
    () =>
      items.filter((notification) => {
        if (filter === "unread") return !notification.read_at;
        if (filter === "read") return !!notification.read_at;
        if (filter === "priority") return isPriority(notification);
        return true;
      }),
    [filter, items],
  );

  const openNotification = async (notification: NotificationRow) => {
    if (!notification.read_at) await markRead(notification.id);
    const href = getSafeNotificationHref(notification.link);
    if (href) {
      setOpen(false);
      navigate({ to: href });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-11 w-11"
          aria-label={t("notifications.title")}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="absolute end-1 top-1 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-gold-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-[min(100vw,440px)] max-w-none flex-col gap-0 p-0 sm:max-w-[440px]"
      >
        <SheetHeader className="border-b border-border px-5 py-5 pe-12 text-start">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SheetTitle>{t("notifications.panel.title")}</SheetTitle>
              <SheetDescription>
                {t("notifications.unreadCount", { count: unreadCount })}
              </SheetDescription>
            </div>
            {unreadCount > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => void markAllRead()}>
                <CheckCheck className="h-4 w-4" />
                {t("notifications.markAllRead")}
              </Button>
            ) : null}
          </div>
        </SheetHeader>

        <div
          className="flex gap-1 overflow-x-auto border-b border-border px-4 py-3"
          aria-label={t("notifications.panel.filters")}
        >
          {(["all", "unread", "read", "priority"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant={filter === value ? "secondary" : "ghost"}
              size="sm"
              className="min-h-10 shrink-0"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {t(`notifications.panel.${value}`)}
            </Button>
          ))}
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto"
          onScroll={(event) => {
            const target = event.currentTarget;
            if (target.scrollHeight - target.scrollTop - target.clientHeight < 160) loadMore();
          }}
        >
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="grid min-h-80 place-items-center px-8 text-center">
              <div>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Inbox className="h-5 w-5" />
                </span>
                <p className="mt-4 font-semibold">{t("notifications.empty")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("notifications.emptyDescription")}
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((notification) => {
                const priority = isPriority(notification);
                return (
                  <li key={notification.id}>
                    <div
                      className={cn(
                        "group flex gap-3 p-4 transition-colors hover:bg-muted/50",
                        !notification.read_at && "bg-brand-blue/[0.035]",
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 rounded-md text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => void openNotification(notification)}
                      >
                        <span className="flex items-start gap-3">
                          <span
                            className={cn(
                              "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md",
                              priority
                                ? "bg-error/10 text-error"
                                : !notification.read_at
                                  ? "bg-brand-blue/10 text-brand-blue"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {priority ? (
                              <CircleAlert className="h-4 w-4" />
                            ) : (
                              <Bell className="h-4 w-4" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-foreground">
                                {notification.title}
                              </span>
                              {!notification.read_at ? (
                                <span className="h-2 w-2 shrink-0 rounded-full bg-brand-blue" />
                              ) : null}
                            </span>
                            {notification.body ? (
                              <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                {notification.body}
                              </span>
                            ) : null}
                            <span className="mt-2 block text-xs text-muted-foreground">
                              {relativeTime(notification.created_at, intlLocale)}
                            </span>
                          </span>
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0 opacity-70 hover:text-destructive"
                        onClick={() => void remove(notification.id)}
                        aria-label={t("notifications.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {hasMore && !loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {t("notifications.panel.loadingMore")}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
