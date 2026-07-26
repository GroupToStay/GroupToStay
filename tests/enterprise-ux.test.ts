import { describe, expect, it } from "vitest";
import { getInitials, normalizeDisplayRole } from "../src/lib/account-identity";

describe("enterprise identity utilities", () => {
  it("creates stable initials for personal and company names", () => {
    expect(getInitials("Mohamed Ramadan")).toBe("MR");
    expect(getInitials("Hilton Madinah")).toBe("HM");
    expect(getInitials("Travel")).toBe("TR");
    expect(getInitials("")).toBe("GS");
  });

  it("normalizes existing role aliases without changing authorization roles", () => {
    expect(normalizeDisplayRole("organizer")).toBe("agency");
    expect(normalizeDisplayRole("agency")).toBe("agency");
    expect(normalizeDisplayRole("hotel")).toBe("hotel");
    expect(normalizeDisplayRole("admin")).toBe("admin");
    expect(normalizeDisplayRole(null)).toBe("visitor");
  });
});
