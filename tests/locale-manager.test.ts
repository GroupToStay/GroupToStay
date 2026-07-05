import { describe, expect, it } from "vitest";

import {
  compareText,
  formatDateKey,
  formatDateValue,
  formatMonthShort,
  formatNumberValue,
  normalizeAppLanguage,
  type AppLanguage,
} from "../src/lib/locale";

describe("locale manager", () => {
  it.each([
    ["en-US", "en"],
    ["en-GB", "en"],
    ["ar", "ar"],
    ["ar-SA", "ar"],
    ["ar-EG", "ar"],
    ["fr", "en"],
    ["de", "en"],
    ["es", "en"],
    ["bad locale tag", "en"],
    [undefined, "en"],
  ] as Array<[unknown, AppLanguage]>)("normalizes %s to %s", (input, expected) => {
    expect(normalizeAppLanguage(input)).toBe(expected);
  });

  it("formats dates and numbers without using the browser default locale", () => {
    const date = new Date(2026, 6, 4, 15, 30);

    expect(formatDateKey(date)).toBe("2026-07-04");
    expect(formatDateValue(date, "en", { month: "2-digit", day: "2-digit", year: "numeric" })).toBe(
      "07/04/2026",
    );
    expect(formatMonthShort(date, normalizeAppLanguage("ar-SA"))).toContain("يوليو");
    expect(formatNumberValue(25000, normalizeAppLanguage("ar-EG"))).toBe("25,000");
  });

  it("sorts text through a safe collator", () => {
    const values = ["City 10", "City 2", "City 1"];
    expect(values.sort((a, b) => compareText(a, b, normalizeAppLanguage("ar-SA")))).toEqual([
      "City 1",
      "City 2",
      "City 10",
    ]);
  });
});
