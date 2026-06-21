import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/make-chat-private")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.updateBucket("chat-attachments", { public: false });
        if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { "content-type": "application/json" } });
        return new Response(JSON.stringify({ ok: true, data }), { headers: { "content-type": "application/json" } });
      },
    },
  },
});
