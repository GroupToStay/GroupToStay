import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [
    { title: "Terms & Conditions — GroupToStay" },
    { name: "description", content: "The terms that govern use of the GroupToStay B2B group hospitality marketplace." },
  ]}),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1 container-page py-12 max-w-3xl">
        <h1 className="font-display text-4xl text-primary">Terms &amp; Conditions</h1>
        <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="mt-6 space-y-4 text-foreground/90">
          <section>
            <h2 className="font-display text-2xl text-primary">1. Acceptance</h2>
            <p>By creating an account or using GroupToStay you agree to these Terms. If you do not agree, do not use the service.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-primary">2. The service</h2>
            <p>GroupToStay is a B2B marketplace where verified travel agencies submit group accommodation requests and verified hotels submit competing quotations. GroupToStay is not the accommodation provider and does not itself contract for the stay.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-primary">3. Accounts &amp; verification</h2>
            <p>Hotels must submit accurate business details (company name, VAT, CR). Approval is required before a hotel can quote or list. Agencies must provide a valid national or Iqama ID number where applicable.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-primary">4. Quotations &amp; bookings</h2>
            <p>A quotation is an offer from a hotel and is binding on the hotel until its stated validity date. Acceptance by an agency creates a booking between the agency and the hotel. Cancellation and modification policies are as stated on the quotation.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-primary">5. Fees</h2>
            <p>Use of the marketplace is free unless otherwise stated in the pricing page or in a written subscription agreement.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-primary">6. Prohibited use</h2>
            <ul className="list-disc ps-5 space-y-2">
              <li>Submitting false company or identity information.</li>
              <li>Attempting to bypass the platform to contract directly and avoid fees where a subscription applies.</li>
              <li>Uploading unlawful, misleading, or infringing content.</li>
            </ul>
          </section>
          <section>
            <h2 className="font-display text-2xl text-primary">7. Liability</h2>
            <p>GroupToStay provides the marketplace "as is". To the maximum extent permitted by law, we are not liable for the acts or omissions of any hotel or agency, or for indirect or consequential loss.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-primary">8. Governing law</h2>
            <p>These Terms are governed by the laws of the Kingdom of Saudi Arabia unless otherwise agreed in writing.</p>
          </section>
          <section>
            <h2 className="font-display text-2xl text-primary">9. Contact</h2>
            <p>legal@grouptostay.com</p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
