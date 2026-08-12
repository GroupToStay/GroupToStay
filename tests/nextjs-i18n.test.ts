import { afterAll, describe, expect, it } from "vitest";
import i18n from "../src/lib/i18n";
import { getTextDirection } from "../src/lib/locale";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

afterAll(async () => {
  await i18n.changeLanguage("en");
});

describe("Next.js internationalization", () => {
  it("resolves namespace-qualified English keys", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("navigation:globalSearch.open")).toBe("Open global search");
    expect(i18n.t("navigation:globalSearch.placeholder")).toBe("Search workspace...");
    expect(i18n.t("navigation:globalSearch.shortcut")).toBe("Ctrl K");
  });

  it("resolves Arabic catalogs without exposing raw keys", async () => {
    await i18n.changeLanguage("ar");
    const translated = i18n.t("navigation:globalSearch.open");
    expect(translated).not.toBe("globalSearch.open");
    expect(translated).not.toBe("navigation:globalSearch.open");
    expect(translated).not.toBe("Open global search");
    expect(getTextDirection("ar")).toBe("rtl");
  });

  it("keeps default merged keys available for existing screens", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("common.brand.name")).toBe("GroupToStay");
    expect(i18n.t("nav.dashboard")).not.toBe("nav.dashboard");
  });

  it("creates a request-local translation instance for hydration", () => {
    const providers = readFileSync(resolve("src/app/providers.tsx"), "utf8");
    expect(providers).toContain("baseI18n.cloneInstance");
    expect(providers).not.toContain("void i18n.changeLanguage(initialLanguage)");
  });
});
