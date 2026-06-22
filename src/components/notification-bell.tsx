import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications, type NotificationRow } from "@/hooks/use-notifications";
import { useState } from "react";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead, remove } = useNotifications(15);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleClick = async (n: NotificationRow) => {
    if (!n.read_at) await markRead(n.id);
    setOpen(false);
    if (n.link) navigate({ to: n.link });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-[10px] font-semibold text-primary-foreground grid place-items-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="font-medium text-sm">Notifications</div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void markAllRead()}>
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={`group flex gap-2 px-3 py-2 border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer ${
                  !n.read_at ? "bg-gold/5" : ""
                }`}
                onClick={() => void handleClick(n)}
              >
                <div className={`mt-1 h-2 w-2 rounded-full ${!n.read_at ? "bg-gold" : "bg-transparent"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-primary truncate">{n.title}</div>
                  {n.body && (
                    <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.created_at)} ago</div>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove(n.id);
                  }}
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border p-2">
          <Link
            to="/dashboard/notifications"
            className="block text-center text-xs text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
