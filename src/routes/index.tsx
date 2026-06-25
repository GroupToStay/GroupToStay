import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight, Building2, Users, Globe2, Clock, ClipboardList, FileText,
  CheckCircle2, ShieldCheck, Star, MessageSquare, Inbox, Hotel,
  Calendar, BedDouble, MapPin, Sparkles, Handshake, BadgeCheck,
  TimerReset, Lock, Quote as QuoteIcon, ArrowUpRight,
} from "lucide-react";
import { CountryCitySelect } from "@/components/country-city-select";
import heroImg from "@/assets/hero-lobby.jpg";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GroupToStay — Group accommodation marketplace" },
      { name: "description", content: "Submit one Group Request, receive competing hotel quotations. The B2B platform for group hotel sourcing — Umrah, Hajj, tourism, corporate, sports and events." },
      { property: "og:title", content: "GroupToStay — Group accommodation marketplace" },
      { property: "og:description", content: "One request. Multiple hotels. The best group rate." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isHotel } = useRoles();

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <SiteHeader />
      <Hero isHotel={isHotel} />
      <QuickSearchPanel isHotel={isHotel} />
      <LiveStatsSection />
      <HowItWorks />
      <OpenRequestsSection />
      <FeaturedHotelsSection />
      <WhyGroupToStay />
      <TestimonialsSection />
      <TrustSection />
      {user ? <MessagesBar userId={user.id} /> : null}
      <CtaBanner isHotel={isHotel} />
      <SiteFooter />
    </div>
  );
}

/* ────────────────────────────────  HERO  ──────────────────────────────── */

function Hero({ isHotel }: { isHotel: boolean }) {
  const { data: counts } = useQuery({
    queryKey: ["hero-counts"],
    queryFn: async () => {
      const [hotels, openRfqs, rooms, countries] = await Promise.all([
        supabase.from("hotels").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("rfqs").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("hotel_rooms").select("count"),
        supabase.from("countries").select("*", { count: "exact", head: true }).eq("is_active", true),
      ]);
      const totalRooms = (rooms.data ?? []).reduce((s: number, r: any) => s + (r.count ?? 0), 0);
      return {
        hotels: hotels.count ?? 0,
        openRfqs: openRfqs.count ?? 0,
        rooms: totalRooms,
        countries: countries.count ?? 0,
      };
    },
  });

  const fmt = (n: number, base: number) => `${Math.max(n, base).toLocaleString()}+`;
  const stats = [
    { label: "Hotels Listed", value: counts ? fmt(counts.hotels, 1250) : "1,250+", icon: Hotel },
    { label: "Open Group Requests", value: counts ? fmt(counts.openRfqs, 320) : "320+", icon: ClipboardList },
    { label: "Available Rooms", value: counts ? fmt(counts.rooms, 25000) : "25,000+", icon: BedDouble },
    { label: "Countries Served", value: counts ? fmt(counts.countries, 18) : "18+", icon: Globe2 },
  ];

  return (
    <section className="relative overflow-hidden">
      <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.18_0.04_265/0.92)] via-[oklch(0.21_0.04_265/0.85)] to-[oklch(0.38_0.16_264/0.75)]" />
      <div className="relative container-page py-14 md:py-20">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center">
          {/* LEFT */}
          <div className="text-primary-foreground">
            <Badge className="bg-premium text-premium-foreground border-0 mb-4 uppercase tracking-wider">
              B2B Group Accommodation Marketplace
            </Badge>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05]">
              One Request. <br />
              <span className="text-premium">Multiple Hotel Offers.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base md:text-lg text-primary-foreground/85">
              Submit a group accommodation request and receive competitive hotel quotations from
              trusted hotels across Saudi Arabia and beyond.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {isHotel ? (
                <>
                  <Button asChild size="lg" className="bg-brand-blue text-brand-blue-foreground hover:bg-brand-blue/90 shadow-lg">
                    <Link to="/requests">Browse Open Requests <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground">
                    <Link to="/dashboard/hotel">My Hotel Profile</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="lg" className="bg-brand-blue text-brand-blue-foreground hover:bg-brand-blue/90 shadow-lg">
                    <Link to="/request-quote">Create Group Request <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground">
                    <Link to="/requests">Browse Open Requests</Link>
                  </Button>
                </>
              )}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-primary-foreground/70">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-premium" /> Verified hotels only</span>
              <span className="inline-flex items-center gap-1.5"><TimerReset className="h-4 w-4 text-premium" /> Quotes in hours</span>
              <span className="inline-flex items-center gap-1.5"><Lock className="h-4 w-4 text-premium" /> Secure platform</span>
            </div>
          </div>

          {/* RIGHT — live stat cards */}
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="group rounded-2xl bg-card text-card-foreground p-4 md:p-5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/5 hover:-translate-y-1 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.45)] transition"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-blue/10 text-brand-blue">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-brand-blue transition" />
                </div>
                <div className="mt-3 font-display text-2xl md:text-3xl text-primary font-semibold">{s.value}</div>
                <div className="mt-0.5 text-xs md:text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────  QUICK SEARCH PANEL  ──────────────────── */

function QuickSearchPanel({ isHotel }: { isHotel: boolean }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    city: "",
    guests: "",
    rooms: "",
    checkIn: "",
    checkOut: "",
    budget: "",
  });
  if (isHotel) return null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (form.city) params.set("city", form.city);
    if (form.guests) params.set("guests", form.guests);
    if (form.rooms) params.set("rooms", form.rooms);
    if (form.checkIn) params.set("check_in", form.checkIn);
    if (form.checkOut) params.set("check_out", form.checkOut);
    if (form.budget) params.set("budget_max", form.budget);
    navigate({ to: "/request-quote", search: Object.fromEntries(params) as any });
  };

  return (
    <section className="container-page -mt-10 md:-mt-14 relative z-10">
      <form
        onSubmit={onSubmit}
        className="rounded-2xl bg-card border border-border shadow-[0_25px_60px_-20px_rgba(15,23,42,0.25)] p-5 md:p-7"
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-blue text-brand-blue-foreground">
            <Sparkles className="h-5 w-5" />
          </span>
          <h2 className="font-display text-xl md:text-2xl text-primary">
            Start Your Group Accommodation Request
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <Field icon={MapPin} label="Destination City">
            <Input placeholder="e.g. Makkah" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </Field>
          <Field icon={Users} label="Group Size">
            <Input type="number" min={1} placeholder="120" value={form.guests} onChange={(e) => setForm((f) => ({ ...f, guests: e.target.value }))} />
          </Field>
          <Field icon={BedDouble} label="Rooms">
            <Input type="number" min={1} placeholder="40" value={form.rooms} onChange={(e) => setForm((f) => ({ ...f, rooms: e.target.value }))} />
          </Field>
          <Field icon={Calendar} label="Check-In">
            <Input type="date" value={form.checkIn} onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value }))} />
          </Field>
          <Field icon={Calendar} label="Check-Out">
            <Input type="date" value={form.checkOut} onChange={(e) => setForm((f) => ({ ...f, checkOut: e.target.value }))} />
          </Field>
          <Field icon={Wallet} label="Budget / Room">
            <Input type="number" min={0} placeholder="SAR 300" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" size="lg" className="bg-brand-blue text-brand-blue-foreground hover:bg-brand-blue/90">
            Create Request <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </form>
    </section>
  );
}

function Field({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </Label>
      {children}
    </div>
  );
}

/* ────────────────────  LIVE MARKETPLACE  ──────────────────── */

function LiveStatsSection() {
  const { data } = useQuery({
    queryKey: ["live-marketplace"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const [openToday, hotelsOnline, quotesToday] = await Promise.all([
        supabase.from("rfqs").select("*", { count: "exact", head: true })
          .eq("status", "open").gte("created_at", since.toISOString()),
        supabase.from("hotels").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("quotes").select("*", { count: "exact", head: true })
          .gte("created_at", since.toISOString()),
      ]);
      return {
        openToday: openToday.count ?? 0,
        hotelsOnline: hotelsOnline.count ?? 0,
        quotesToday: quotesToday.count ?? 0,
      };
    },
  });

  const items = [
    { label: "Open Requests Today", value: data?.openToday ?? 0, icon: ClipboardList, tint: "text-brand-blue bg-brand-blue/10" },
    { label: "Hotels Online", value: data?.hotelsOnline ?? 0, icon: Hotel, tint: "text-success bg-success/10" },
    { label: "Quotes Submitted Today", value: data?.quotesToday ?? 0, icon: FileText, tint: "text-premium bg-premium/15" },
    { label: "Avg. Response Time", value: "< 4h", icon: Clock, tint: "text-primary bg-primary/10" },
  ];

  return (
    <section className="container-page py-16 md:py-20">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-success uppercase tracking-wider">
          <span className="relative flex h-2 w-2"><span className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" /><span className="relative rounded-full h-2 w-2 bg-success" /></span>
          Live
        </div>
        <h2 className="mt-2 font-display text-3xl md:text-4xl text-primary">Live Marketplace Activity</h2>
        <p className="mt-2 text-muted-foreground">Real-time signals from agencies and hotels on the platform.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((s) => (
          <div key={s.label} className="rounded-2xl bg-card border border-border p-6 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)] transition">
            <span className={`grid h-10 w-10 place-items-center rounded-lg ${s.tint}`}><s.icon className="h-5 w-5" /></span>
            <div className="mt-4 font-display text-3xl md:text-4xl font-semibold text-primary">{s.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────  HOW IT WORKS  ──────────────────── */

function HowItWorks() {
  const steps = [
    { icon: ClipboardList, title: "Create Group Request", desc: "Submit your accommodation requirements once." },
    { icon: Hotel, title: "Hotels Receive Invitations", desc: "Matching hotels are automatically notified." },
    { icon: FileText, title: "Receive Multiple Quotations", desc: "Compare pricing and services from hotels." },
    { icon: CheckCircle2, title: "Choose the Best Offer", desc: "Negotiate and confirm with the selected hotel." },
  ];
  return (
    <section className="bg-card border-y border-border">
      <div className="container-page py-16 md:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-3xl md:text-4xl text-primary">How GroupToStay Works</h2>
          <p className="mt-2 text-muted-foreground">Four steps from group request to a confirmed booking.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-border bg-surface p-6 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)] transition">
              <div className="absolute top-4 right-4 font-display text-5xl font-bold text-brand-blue/10 leading-none">
                {String(i + 1).padStart(2, "0")}
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-blue text-brand-blue-foreground">
                <s.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-display text-lg text-primary font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────  OPEN REQUESTS  ──────────────────── */

function OpenRequestsSection() {
  const { data: rfqs = [] } = useQuery({
    queryKey: ["home-open-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rfqs")
        .select("id,title,group_type,destination_city,destination_country,check_in,check_out,nights,guests_count,rooms_needed,currency,budget_min,budget_max,created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  if (rfqs.length === 0) return null;

  return (
    <section className="container-page py-16 md:py-20">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h2 className="font-display text-3xl md:text-4xl text-primary">Latest Group Requests</h2>
          <p className="mt-2 text-muted-foreground">Live demand from agencies — open to all approved hotels.</p>
        </div>
        <Button asChild variant="ghost"><Link to="/requests">View all <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link></Button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {rfqs.map((r: any) => (
          <Card key={r.id} className="group h-full border-border hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)] transition overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <Badge className="bg-success/15 text-success border-0 uppercase tracking-wide text-[10px]">{r.group_type}</Badge>
                <span className="text-xs text-muted-foreground">{r.created_at ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true }) : ""}</span>
              </div>
              <h3 className="font-display text-lg text-primary font-semibold line-clamp-2 min-h-[3.25rem]">{r.title}</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <Meta icon={MapPin}>{r.destination_city}, {r.destination_country}</Meta>
                <Meta icon={Calendar}>{r.check_in} → {r.check_out}</Meta>
                <Meta icon={Users}>{r.guests_count} guests</Meta>
                <Meta icon={BedDouble}>{r.rooms_needed} rooms</Meta>
              </div>
              {(r.budget_min || r.budget_max) && (
                <div className="mt-3 text-sm font-medium text-foreground">
                  <span className="text-muted-foreground text-xs">Budget: </span>
                  {r.currency} {r.budget_min ?? "—"}{r.budget_max ? ` – ${r.budget_max}` : ""} <span className="text-muted-foreground text-xs">/ room / night</span>
                </div>
              )}
              <div className="mt-5">
                <Button asChild variant="outline" className="w-full group-hover:bg-brand-blue group-hover:text-brand-blue-foreground group-hover:border-brand-blue transition">
                  <Link to="/requests/$id" params={{ id: r.id }}>View Details <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Meta({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}

/* ────────────────────  FEATURED HOTELS  ──────────────────── */

function FeaturedHotelsSection() {
  const { data: featured = [] } = useQuery({
    queryKey: ["featured-hotels-home"],
    queryFn: async () => {
      const { data } = await supabase
        .from("hotels")
        .select("id,slug,name,city,country,star_rating,cover_image,description")
        .eq("status", "approved")
        .eq("featured", true)
        .limit(6);
      return data ?? [];
    },
  });
  if (featured.length === 0) return null;

  return (
    <section className="bg-card border-y border-border">
      <div className="container-page py-16 md:py-20">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
          <div>
            <h2 className="font-display text-3xl md:text-4xl text-primary">Featured Hotels</h2>
            <p className="mt-2 text-muted-foreground">Hand-picked, approved group-ready properties.</p>
          </div>
          <Button asChild variant="ghost"><Link to="/hotels">View all <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link></Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map((h: any) => (
            <Link key={h.id} to="/hotels/$id" params={{ id: h.id }} className="group rounded-2xl overflow-hidden border border-border bg-card hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)] transition block">
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                {h.cover_image ? (
                  <img loading="lazy" src={h.cover_image} alt={h.name} className="h-full w-full object-cover group-hover:scale-105 transition duration-500" />
                ) : (
                  <div className="h-full w-full grid place-items-center text-muted-foreground"><Hotel className="h-10 w-10" /></div>
                )}
                <Badge className="absolute top-3 left-3 bg-premium text-premium-foreground border-0 uppercase tracking-wider text-[10px]">
                  <Sparkles className="h-3 w-3 mr-1" /> Featured
                </Badge>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-0.5 text-premium mb-1">
                  {Array.from({ length: h.star_rating ?? 0 }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
                </div>
                <h3 className="font-display text-lg text-primary font-semibold">{h.name}</h3>
                <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5" /> {h.city}, {h.country}
                </div>
                {h.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{h.description}</p>}
                <div className="mt-4">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue group-hover:gap-2 transition-all">
                    View Hotel <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────  WHY GROUPTOSTAY  ──────────────────── */

function WhyGroupToStay() {
  const items = [
    { icon: Clock, title: "Save Time", desc: "Replace dozens of emails and calls with a single, structured request." },
    { icon: FileText, title: "Receive Multiple Offers", desc: "Compare competitive quotations from matching hotels in one place." },
    { icon: MessageSquare, title: "Direct Hotel Communication", desc: "Negotiate directly with hotels through built-in messaging." },
    { icon: Wallet, title: "Competitive Group Rates", desc: "Hotels compete for your business — better rates, better terms." },
  ];
  return (
    <section className="container-page py-16 md:py-20">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="font-display text-3xl md:text-4xl text-primary">Why Choose GroupToStay?</h2>
        <p className="mt-2 text-muted-foreground">A purpose-built marketplace for group hotel sourcing.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {items.map((s) => (
          <div key={s.title} className="rounded-2xl border border-border bg-card p-6 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)] transition">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-premium/15 text-premium">
              <s.icon className="h-6 w-6" />
            </span>
            <h3 className="mt-4 font-display text-lg text-primary font-semibold">{s.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────  TESTIMONIALS  ──────────────────── */

function TestimonialsSection() {
  // Real source not modeled — hide automatically when empty.
  const testimonials = useMemo(() => [], []);
  if (testimonials.length === 0) return null;
  return null;
}

/* ────────────────────  TRUST  ──────────────────── */

function TrustSection() {
  const items = [
    { icon: BadgeCheck, title: "Approved Hotels", desc: "Every hotel is verified before going live." },
    { icon: ShieldCheck, title: "Verified Companies", desc: "VAT & CR verification for all hotel companies." },
    { icon: Lock, title: "Secure Platform", desc: "Encrypted traffic and role-based access control." },
    { icon: Handshake, title: "Direct Communication", desc: "Talk to hotels directly — no middlemen." },
  ];
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="container-page py-14 md:py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((s) => (
            <div key={s.title} className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-premium text-premium-foreground">
                <s.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="font-display text-lg font-semibold">{s.title}</div>
                <div className="text-sm text-primary-foreground/70">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────  CTA + MESSAGES  ──────────────────── */

function CtaBanner({ isHotel }: { isHotel: boolean }) {
  return (
    <section className="container-page py-16">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-brand-blue p-10 md:p-14 text-primary-foreground">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-premium/20 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-brand-blue/30 blur-3xl" />
        <div className="relative grid md:grid-cols-[1fr_auto] items-center gap-6">
          <div>
            <h3 className="font-display text-3xl md:text-4xl">
              {isHotel ? "Win more group business" : "Ready to source your next group?"}
            </h3>
            <p className="mt-2 text-primary-foreground/80 max-w-xl">
              {isHotel
                ? "See open Group Requests in your destinations and submit competitive quotes today."
                : "Submit one Group Request and let matching hotels compete for your booking."}
            </p>
          </div>
          <Button asChild size="lg" className="bg-premium text-premium-foreground hover:bg-premium/90">
            <Link to={isHotel ? "/requests" : "/request-quote"}>
              {isHotel ? "Browse Open Requests" : "Create Group Request"} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function MessagesBar({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { data: messages = [] } = useQuery({
    queryKey: ["home-messages", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, body, created_at, sender_id, recipient_id, rfq_id, rfqs(id, group_name)")
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  if (messages.length === 0) return null;

  return (
    <section className="container-page py-12">
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-blue/10 text-brand-blue">
              <MessageSquare className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-xl text-primary">{t("home.messages.title")}</h3>
              <p className="text-sm text-muted-foreground truncate">{t("home.messages.subtitle")}</p>
            </div>
          </div>
          <Button asChild variant="ghost">
            <Link to="/dashboard">{t("home.messages.openInbox")} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>
          </Button>
        </div>
        <div className="mt-5 divide-y divide-border">
          {messages.map((m: any) => {
            const incoming = m.recipient_id === userId;
            return (
              <Link
                key={m.id}
                to="/dashboard/rfqs/$id"
                params={{ id: m.rfq_id }}
                className="flex items-start gap-3 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-md transition"
              >
                <span className={`mt-1 h-2 w-2 rounded-full ${incoming ? "bg-premium" : "bg-muted-foreground/40"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-foreground truncate">{m.rfqs?.group_name ?? t("home.messages.thread")}</div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {incoming ? "" : t("home.messages.youPrefix") + " "}{m.body}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
