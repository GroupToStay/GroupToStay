import { describe, expect, it } from "vitest";
import {
  parseSettingsSearch,
  SETTINGS_TABS,
  type SettingsTab,
} from "../src/lib/settings-navigation";

describe("settings navigation", () => {
  it.each(SETTINGS_TABS)("preserves the %s tab in the URL", (tab: SettingsTab) => {
    expect(parseSettingsSearch({ tab })).toEqual({ tab });
  });

  it("opens Profile when no tab is provided", () => {
    expect(parseSettingsSearch({})).toEqual({ tab: "profile" });
  });

  it("falls back to Profile for unsupported deep links", () => {
    expect(parseSettingsSearch({ tab: "billing" })).toEqual({ tab: "profile" });
  });
});
