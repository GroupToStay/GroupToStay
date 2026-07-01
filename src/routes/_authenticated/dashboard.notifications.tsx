import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNotifications } from "@/hooks/use-notifications";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/dashboard/notifications")({
  head: () => ({ meta: [{ title: "Notifications — GroupToStay" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { items, loading, unreadCount, markRead, markAllRead, remove } = useNotifications(100);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="font-display text-3xl text-primary">Notifications</h1>
          {unreadCount > 0 && (
            <span className="text-xs bg-gold text-primary-foreground rounded-full px-2 py-0.5">
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
            <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
            No notifications yet. We'll let you know when something happens.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((n) => {
            const body = (
              <Card className={`transition hover:border-primary ${!n.read_at ? "border-gold/60 bg-gold/5" : ""}`}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${!n.read_at ? "bg-gold" : "bg-muted"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-primary">{n.title}</div>
                    {n.body && <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>}
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      void remove(n.id);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            );
            return n.link ? (
              <Link
                key={n.id}
                to={n.link}
                onClick={() => {
                  if (!n.read_at) void markRead(n.id);
                }}
                className="block"
              >
                {body}
              </Link>
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
