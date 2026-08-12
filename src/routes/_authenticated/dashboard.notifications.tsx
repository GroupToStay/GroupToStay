"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { EmptyState } from "@/components/empty-state";
import { useApplicationLocale } from "@/lib/application-locale";
import i18n from "@/lib/i18n";
import { getSafeNotificationHref } from "@/lib/notification-link";
import { PageHeader } from "@/components/workspace/page-header";

export const Route = createFileRoute("/_authenticated/dashboard/notifications")({
  head: () => ({ meta: [{ title: i18n.t("notifications.metaTitle") }] }),
  component: NotificationsPage,
});

export function NotificationsPage() {
  const { t } = useTranslation();
  const { items, loading, unreadCount, markRead, markAllRead, remove } = useNotifications(100);
  const { formatDateTime } = useApplicationLocale();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("notifications.title")}
        icon={Bell}
        meta={
          unreadCount > 0 ? (
            <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold-foreground">
              {t("notifications.unreadCount", { count: unreadCount })}
            </span>
          ) : null
        }
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
              <CheckCheck className="h-4 w-4 me-1" /> {t("notifications.markAllRead")}
            </Button>
          ) : null
        }
      />

      {loading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={t("notifications.empty")}
          description={t("notifications.emptyDescription")}
          actionLabel={t("notifications.goToDashboard")}
          actionTo="/dashboard"
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {items.map((n) => {
            const href = getSafeNotificationHref(n.link);
            const body = (
              <div
                className={`flex items-start gap-3 border-b border-border p-4 transition-colors last:border-b-0 hover:bg-muted/30 ${!n.read_at ? "bg-gold/5" : ""}`}
              >
                <div
                  className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${!n.read_at ? "bg-gold" : "bg-muted"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-primary">{n.title}</div>
                  {n.body && <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>}
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDateTime(n.created_at)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    void remove(n.id);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={t("notifications.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
            return href ? (
              <a
                key={n.id}
                href={href}
                onClick={() => {
                  if (!n.read_at) void markRead(n.id);
                }}
                className="block"
              >
                {body}
              </a>
            ) : (
              <div key={n.id} onClick={() => !n.read_at && void markRead(n.id)}>
                {body}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
