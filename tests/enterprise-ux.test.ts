import { describe, expect, it } from "vitest";
import { getInitials, getUserAvatarUrl, normalizeDisplayRole } from "../src/lib/account-identity";

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

  it("uses profile photos when present and preserves the initials fallback", () => {
    expect(getUserAvatarUrl({ avatar_url: "data:image/webp;base64,photo" })).toBe(
      "data:image/webp;base64,photo",
    );
    expect(getUserAvatarUrl({ picture: "https://example.com/photo.webp" })).toBe(
      "https://example.com/photo.webp",
    );
    expect(
      getUserAvatarUrl({
        avatar_removed: true,
        picture: "https://example.com/photo.webp",
      }),
    ).toBeNull();
    expect(getUserAvatarUrl(null)).toBeNull();
  });
});
