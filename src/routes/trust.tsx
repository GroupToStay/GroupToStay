import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Shield, Lock, Database, UserCheck, Cookie, Mail, FileText, Server } from "lucide-react";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Trust & Security — GroupToStay" },
      {
        name: "description",
        content:
          "How GroupToStay handles security, privacy, and data protection for hotels, group organizers, and corporate partners.",
      },
      { property: "og:title", content: "Trust & Security — GroupToStay" },
      {
        property: "og:description",
        content:
          "Security, privacy, and data handling practices for the GroupToStay marketplace.",
      },
    ],
  }),
  component: TrustPage,
});

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Shield;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border rounded-2xl p-6 md:p-8 bg-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-display text-xl md:text-2xl text-primary">{title}</h2>
      </div>
      <div className="text-foreground/80 leading-relaxed space-y-3 text-[15px]">
        {children}
      </div>
    </section>
  );
}

function TrustPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-primary text-primary-foreground">
          <div className="container-page py-14">
            <div className="flex items-center gap-3">
              <Shield className="h-7 w-7" />
              <h1 className="font-display text-4xl md:text-5xl">Trust & Security</h1>
            </div>
            <p className="mt-4 max-w-2xl text-primary-foreground/85 leading-relaxed">
              This page is maintained by GroupToStay to answer common security
              and privacy questions about the GroupToStay marketplace. It
              describes practices currently in effect and is not an independent
              certification.
            </p>
          </div>
        </section>

        <div className="container-page py-12 grid gap-6 md:grid-cols-2">
          <Section icon={UserCheck} title="Authentication & Access">
            <p>
              Access to GroupToStay requires an authenticated account. Roles
              (organizer, hotel partner, administrator) determine which actions
              and records a user can reach. Hotel and company accounts are
              reviewed by GroupToStay administrators before they are activated
              on the marketplace.
            </p>
            <p>
              Sessions are managed by our authentication provider. Passwords
              are never stored in plaintext by GroupToStay.
            </p>
          </Section>

          <Section icon={Server} title="Platform & Hosting">
            <p>
              GroupToStay runs on the Lovable platform, with a managed
              Postgres database provided by Supabase. Database access from the
              application is governed by row-level security policies scoped to
              the signed-in user.
            </p>
            <p>
              Connections between your browser, the application, and the
              database are encrypted in transit using TLS.
            </p>
          </Section>

          <Section icon={Database} title="Data We Collect">
            <p>
              GroupToStay stores the information you provide to operate the
              marketplace: account and company details, hotel profiles, group
              requests (RFQs), quotations, bookings, and messages exchanged
              between organizers and hotels.
            </p>
            <p>
              We do not sell personal data. Payment card details, when
              applicable, are handled by our payment processor and are not
              stored on our servers.
            </p>
          </Section>

          <Section icon={Lock} title="Data Access & Sharing">
            <p>
              Hotels see only the group requests they are invited to and the
              messages and quotations tied to those requests. Organizers see
              only their own requests, the responses they receive, and their
              bookings. Administrators may access records as needed to operate
              and support the platform.
            </p>
            <p>
              Public hotel listings show approved hotels and their published
              details only; internal account identifiers are not exposed to
              anonymous visitors.
            </p>
          </Section>

          <Section icon={Cookie} title="Cookies & Analytics">
            <p>
              GroupToStay uses cookies and local storage strictly necessary to
              keep you signed in and to remember your interface preferences
              (such as language). We do not use third-party advertising
              trackers.
            </p>
          </Section>

          <Section icon={FileText} title="Retention & Deletion">
            <p>
              Account, transaction, and messaging records are retained while
              your account is active and for the period required by applicable
              law or to resolve disputes. To request deletion or export of
              data tied to your account, contact us using the address below.
            </p>
          </Section>

          <Section icon={Shield} title="Shared Responsibility">
            <p>
              Security on GroupToStay is a shared responsibility. GroupToStay
              maintains the application, access controls, and infrastructure
              integrations; account holders are responsible for safeguarding
              their credentials, keeping company information accurate, and
              promptly reporting suspicious activity.
            </p>
          </Section>

          <Section icon={Mail} title="Security Contact">
            <p>
              To report a security concern, suspected vulnerability, or
              privacy request, contact GroupToStay through the{" "}
              <Link to="/contact" className="text-primary underline">
                contact page
              </Link>
              . We aim to acknowledge security reports promptly and will follow
              up with next steps.
            </p>
          </Section>
        </div>

        <div className="container-page pb-16">
          <p className="text-sm text-muted-foreground">
            This page describes current practices and may be updated as the
            platform evolves. It is provided for transparency and does not
            create contractual commitments beyond those in our Terms of
            Service.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
