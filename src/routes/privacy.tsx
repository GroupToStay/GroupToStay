import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [
    { title: "Privacy Policy — GroupToStay" },
    { name: "description", content: "How GroupToStay collects, uses, and protects your personal and business data." },
  ]}),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1 container-page py-12 max-w-3xl prose prose-slate">
        <h1 className="font-display text-4xl text-primary">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}</p>

        <section className="mt-6 space-y-4 text-foreground/90">
          <h2 className="font-display text-2xl text-primary">1. Introduction</h2>
          <p>GroupToStay ("we", "our", "us") operates a B2B marketplace connecting group travel agencies with hotels. This Privacy Policy explains what information we collect, how we use it, and the choices you have.</p>

          <h2 className="font-display text-2xl text-primary">2. Information we collect</h2>
          <ul className="list-disc ps-5 space-y-2">
            <li><strong>Account data:</strong> name, email, phone, country, role (Agency / Hotel), and — for hotels — company name, VAT and CR numbers.</li>
            <li><strong>Business data:</strong> group requests (destinations, dates, guests), quotations, bookings, messages between agencies and hotels.</li>
            <li><strong>Technical data:</strong> device, browser, IP, and log data used for security and analytics.</li>
          </ul>

          <h2 className="font-display text-2xl text-primary">3. How we use your data</h2>
          <ul className="list-disc ps-5 space-y-2">
            <li>To operate the marketplace — match requests to relevant hotels, deliver quotations, and enable messaging.</li>
            <li>To verify hotel companies (KYC-style checks on CR / VAT).</li>
            <li>To secure the platform, prevent abuse, and comply with law.</li>
            <li>To communicate service updates. Marketing emails are opt-in.</li>
          </ul>

          <h2 className="font-display text-2xl text-primary">4. Sharing</h2>
          <p>We share only what is required for the marketplace to function: an agency's group request is visible to eligible hotels, and a hotel's quotation is visible to the requesting agency. We do not sell personal data.</p>

          <h2 className="font-display text-2xl text-primary">5. Data retention</h2>
          <p>We keep account and transactional records while your account is active and for as long as required by law thereafter.</p>

          <h2 className="font-display text-2xl text-primary">6. Your rights</h2>
          <p>Subject to applicable law, you may request access, correction, or deletion of your personal data by writing to <a href="mailto:privacy@grouptostay.com" className="text-primary underline">privacy@grouptostay.com</a>.</p>

          <h2 className="font-display text-2xl text-primary">7. Security</h2>
          <p>Data is stored on managed cloud infrastructure with encryption in transit and at rest. Row-level access controls restrict data to the parties who need it. See our <a href="/trust" className="text-primary underline">Trust &amp; Security</a> page for more.</p>

          <h2 className="font-display text-2xl text-primary">8. Contact</h2>
          <p>Questions about this policy? Email <a href="mailto:privacy@grouptostay.com" className="text-primary underline">privacy@grouptostay.com</a>.</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
