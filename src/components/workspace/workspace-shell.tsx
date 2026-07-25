import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useApplicationLocale } from "@/lib/application-locale";
import { cn } from "@/lib/utils";

export type WorkspaceNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: ReactNode;
  exact?: boolean;
};

export type WorkspaceNavGroup = {
  label?: string;
  items: WorkspaceNavItem[];
};

function WorkspaceNavigation({
  groups,
  compact = false,
  onNavigate,
}: {
  groups: WorkspaceNavGroup[];
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav className="space-y-5" aria-label={t("common.accessibility.sidebar")}>
      {groups.map((group, groupIndex) => (
        <div key={group.label ?? groupIndex}>
          {!compact && group.label ? (
            <div className="mb-2 px-3 text-xs font-semibold text-muted-foreground">
              {group.label}
            </div>
          ) : null}
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.to
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  title={compact ? item.label : undefined}
                  onClick={onNavigate}
                  className={cn(
                    "group flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    compact && "justify-center px-0",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  {!compact ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
                  {!compact && item.badge ? <span className="shrink-0">{item.badge}</span> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function WorkspaceShell({
  brand,
  identity,
  groups,
  header,
  children,
  wide = false,
}: {
  brand: ReactNode;
  identity: ReactNode;
  groups: WorkspaceNavGroup[];
  header: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useTranslation();
  const { dir } = useApplicationLocale();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
      {header}
      <div
        className={cn(
          "mx-auto grid min-h-[calc(100vh-4rem)] w-full",
          collapsed ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[248px_minmax(0,1fr)]",
          wide ? "max-w-none" : "max-w-[1600px]",
        )}
      >
        <aside className="hidden border-e border-border bg-card lg:flex lg:min-h-full lg:flex-col">
          <div
            className={cn(
              "flex min-h-[84px] items-center border-b border-border p-4",
              collapsed ? "justify-center" : "justify-between gap-3",
            )}
          >
            {!collapsed ? <div className="min-w-0">{identity}</div> : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={t("common.accessibility.toggleSidebar")}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <WorkspaceNavigation groups={groups} compact={collapsed} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  aria-label={t("navigation:nav.menu")}
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side={dir === "rtl" ? "right" : "left"}
                className="w-[min(88vw,320px)] p-0"
              >
                <SheetHeader className="border-b border-border p-5 text-start">
                  <SheetTitle>{brand}</SheetTitle>
                  <SheetDescription asChild>
                    <div>{identity}</div>
                  </SheetDescription>
                </SheetHeader>
                <div className="h-[calc(100vh-112px)] overflow-y-auto p-4">
                  <WorkspaceNavigation groups={groups} onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0 flex-1 truncate">{identity}</div>
          </div>
          <main className="workspace-page">{children}</main>
        </div>
      </div>
    </div>
  );
}
