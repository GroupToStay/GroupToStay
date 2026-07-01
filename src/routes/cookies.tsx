import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/cookies")({
  head: () => ({ meta: [
    { title: "Cookie Policy — GroupToStay" },
    { name: "description", content: "How GroupToStay uses cookies and similar technologies." },
  ]}),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1 container-page py-12 max-w-3xl">
        <h1 className="font-display text-4xl text-primary">Cookie Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="mt-6 space-y-4 text-foreground/90">
          <p>We use a small number of cookies and browser storage items to run the site securely and to remember your preferences. We do not use cookies for advertising.</p>

          <h2 className="font-display text-2xl text-primary">Strictly necessary</h2>
          <ul className="list-disc ps-5 space-y-2">
            <li><strong>Authentication</strong> — set by Supabase Auth to keep you signed in.</li>
            <li><strong>CSRF / session</strong> — protects sensitive requests.</li>
          </ul>

          <h2 className="font-display text-2xl text-primary">Preferences</h2>
          <ul className="list-disc ps-5 space-y-2">
            <li><code>gts_lang</code> — stores your language choice (English by default, Arabic if you switch).</li>
          </ul>

          <h2 className="font-display text-2xl text-primary">Analytics</h2>
          <p>We may use privacy-friendly, aggregate analytics to understand feature usage. No personal profiles are built.</p>

          <h2 className="font-display text-2xl text-primary">Managing cookies</h2>
          <p>You can clear cookies and site storage from your browser settings at any time. Doing so will sign you out and reset your language preference.</p>

          <h2 className="font-display text-2xl text-primary">Contact</h2>
          <p><a href="mailto:privacy@grouptostay.com" className="text-primary underline">privacy@grouptostay.com</a></p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
