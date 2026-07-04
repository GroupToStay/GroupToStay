import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

export function WaitlistModal({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plan: "professional" | "featured";
}) {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: prefill } = useQuery({
    queryKey: ["waitlist-prefill", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const [{ data: p }, { data: h }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, contact_email, company_name")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase.from("hotels").select("id, name").eq("owner_id", user!.id).limit(1).maybeSingle(),
      ]);
      return { p, h };
    },
  });

  useEffect(() => {
    if (open) {
      setFullName(prefill?.p?.full_name ?? "");
      setEmail(prefill?.p?.contact_email ?? user?.email ?? "");
      setHotelName(prefill?.h?.name ?? prefill?.p?.company_name ?? "");
    }
  }, [open, prefill, user?.email]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from("subscription_interest").insert({
        user_id: user?.id ?? null,
        hotel_id: prefill?.h?.id ?? null,
        full_name: fullName.trim(),
        email: email.trim(),
        hotel_name: hotelName.trim() || null,
        requested_plan: plan,
      });
      if (error) throw error;
      toast.success(
        "You have been added to the subscription waiting list. We will notify you as soon as subscription payments become available.",
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Join Subscription Waitlist</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Requested plan: <span className="font-medium capitalize">{plan} Hotel</span>
          </p>
          <div>
            <Label>Full Name</Label>
            <Input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={160}
            />
          </div>
          <div>
            <Label>Email Address</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
            />
          </div>
          <div>
            <Label>Hotel Name</Label>
            <Input
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              maxLength={160}
            />
          </div>
          <DialogFooter>
            <Button type="submit" variant="gold" disabled={submitting}>
              {submitting ? "Joining…" : "Join Waitlist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
