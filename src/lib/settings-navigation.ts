export const SETTINGS_TABS = [
  "profile",
  "account",
  "notifications",
  "language",
  "security",
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export function parseSettingsSearch(search: Record<string, unknown>): { tab: SettingsTab } {
  const tab = search.tab;
  return {
    tab:
      typeof tab === "string" && SETTINGS_TABS.includes(tab as SettingsTab)
        ? (tab as SettingsTab)
        : "profile",
  };
}
