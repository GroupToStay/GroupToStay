import type { ReactNode } from "react";
import { PublicSiteHeader } from "@/components/public-site-header";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";

export function PublicPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicSiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PublicPageHero({
  title,
  description,
  actions,
  dark = false,
  compact = false,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  dark?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-b border-border",
        dark ? "bg-primary text-primary-foreground" : "bg-surface text-foreground",
        className,
      )}
    >
      <div className={cn("container-page", compact ? "py-10 md:py-12" : "py-14 md:py-18")}>
        <div className="max-w-3xl">
          <h1
            className={cn(
              "font-display text-4xl font-semibold leading-tight md:text-5xl",
              dark ? "text-primary-foreground" : "text-primary",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "mt-4 max-w-2xl text-base leading-7 md:text-lg",
                dark ? "text-primary-foreground/75" : "text-muted-foreground",
              )}
            >
              {description}
            </p>
          ) : null}
          {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}
