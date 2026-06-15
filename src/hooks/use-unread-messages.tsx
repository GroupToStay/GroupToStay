import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Returns the number of conversations with at least one unread message
 * for the current user. Subscribes to realtime updates.
 */
export function useUnreadMessageCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let cancelled = false;

    async function recompute() {
      // Pull participants + conversations to compute unread.
      const { data: parts } = await (supabase as any)
        .from("conversation_participants")
        .select("conversation_id, last_read_at, conversations:conversation_id(last_message_at)")
        .eq("user_id", user!.id);
      if (cancelled || !parts) return;
      let unread = 0;
      for (const p of parts as any[]) {
        const lastMsg = p.conversations?.last_message_at;
        if (lastMsg && new Date(lastMsg).getTime() > new Date(p.last_read_at).getTime()) {
          unread += 1;
        }
      }
      setCount(unread);
    }

    void recompute();

    const channel = supabase
      .channel(`unread:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => void recompute()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants", filter: `user_id=eq.${user.id}` },
        () => void recompute()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return count;
}
