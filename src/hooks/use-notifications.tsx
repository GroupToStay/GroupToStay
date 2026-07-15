import { useCallback, useEffect, useId, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

/**
 * Subscribes to the current user's notifications. Returns the recent
 * notifications, unread count, and helpers to mark them read.
 */
export function useNotifications(limit = 30) {
  const { user } = useAuth();
  const userId = user?.id;
  const subscriptionId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data } = await (supabase as any)
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    setItems((data as NotificationRow[]) ?? []);
    setLoading(false);
  }, [userId, limit]);

  useEffect(() => {
    void load();
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}:${subscriptionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, subscriptionId, load]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const markRead = useCallback(async (id: string) => {
    await (supabase as any)
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await (supabase as any)
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
  }, [userId]);

  const remove = useCallback(async (id: string) => {
    await (supabase as any).from("notifications").delete().eq("id", id);
  }, []);

  return { items, loading, unreadCount, markRead, markAllRead, remove, reload: load };
}
