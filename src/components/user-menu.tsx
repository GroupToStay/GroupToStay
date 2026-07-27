import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  Languages,
  LayoutDashboard,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AccountAvatar } from "@/components/account-avatar";
import { RoleBadge } from "@/components/role-badge";
import { isAdminDisplayRole, normalizeDisplayRole } from "@/lib/account-identity";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useAccountIdentity } from "@/hooks/use-account-identity";
import { useApplicationLocale } from "@/lib/application-locale";

export function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const { avatarUrl, displayName, role } = useAccountIdentity();
  const { language, setLanguage } = useApplicationLocale();

  if (!user) return null;

  const adminRole = isAdminDisplayRole(normalizeDisplayRole(role));
  const dashboard = adminRole ? "/admin" : "/dashboard";
  const settings = adminRole ? "/admin/settings" : "/dashboard/profile";

  const go = (to: string) => navigate({ to });
  const handleSignOut = async () => {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await signOut();
    } finally {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {
        // Storage cleanup is best-effort during sign out.
      }
      window.location.replace("/");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-11 gap-2 px-1.5 sm:px-2"
          aria-label={t("navigation:accountMenu.open")}
        >
          <AccountAvatar name={displayName} imageUrl={avatarUrl} />
          <span className="hidden max-w-32 truncate text-sm font-semibold xl:block">
            {displayName}
          </span>
          <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,320px)] p-2">
        <DropdownMenuItem
          className="min-h-[76px] cursor-pointer p-2 focus:bg-accent"
          onSelect={() => go("/dashboard/profile")}
          aria-label={t("navigation:accountMenu.openProfile", { name: displayName })}
        >
          <div className="flex items-center gap-3">
            <AccountAvatar name={displayName} imageUrl={avatarUrl} className="h-11 w-11" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{displayName}</div>
              <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
              <RoleBadge role={role} className="mt-2" />
            </div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11" onSelect={() => go(dashboard)}>
          <LayoutDashboard />
          {t("navigation:accountMenu.dashboard")}
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={() => go("/dashboard/profile")}>
          <User />
          {t("navigation:accountMenu.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={() => go(settings)}>
          <Settings />
          {t("navigation:accountMenu.settings")}
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={() => go("/dashboard/notifications")}>
          <Bell />
          {t("navigation:accountMenu.notifications")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-11"
          onSelect={() => void setLanguage(language === "ar" ? "en" : "ar")}
        >
          <Languages />
          {t("navigation:accountMenu.language")}
          <span className="ms-auto text-xs text-muted-foreground">
            {language === "ar"
              ? t("common.languageNames.arabicShort")
              : t("common.languageNames.englishShort")}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={() => go("/contact")}>
          <CircleHelp />
          {t("navigation:accountMenu.help")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-11 text-destructive focus:text-destructive"
          onSelect={() => void handleSignOut()}
        >
          <LogOut />
          {t("navigation:accountMenu.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
