import { describe, expect, it } from "vitest";
import { getPublicHeaderVisibility } from "../src/lib/public-header-visibility";

const resolvedRoleState = {
  authLoading: false,
  rolesLoading: false,
  isAuthenticated: true,
  isOrganizer: false,
  isHotel: false,
  isAdmin: false,
};

describe("public header visibility", () => {
  it("shows guest actions only after authentication initialization", () => {
    expect(
      getPublicHeaderVisibility({
        ...resolvedRoleState,
        authLoading: true,
        isAuthenticated: false,
      }),
    ).toEqual({
      ready: false,
      showSignIn: false,
      showRegister: false,
      showCreateRequest: false,
    });

    expect(
      getPublicHeaderVisibility({
        ...resolvedRoleState,
        isAuthenticated: false,
      }),
    ).toEqual({
      ready: true,
      showSignIn: true,
      showRegister: true,
      showCreateRequest: true,
    });
  });

  it("hides guest actions while an authenticated role is loading", () => {
    expect(
      getPublicHeaderVisibility({
        ...resolvedRoleState,
        rolesLoading: true,
      }),
    ).toEqual({
      ready: false,
      showSignIn: false,
      showRegister: false,
      showCreateRequest: false,
    });
  });

  it("shows only Create Group Request for agencies", () => {
    expect(
      getPublicHeaderVisibility({
        ...resolvedRoleState,
        isOrganizer: true,
      }),
    ).toEqual({
      ready: true,
      showSignIn: false,
      showRegister: false,
      showCreateRequest: true,
    });
  });

  it.each([
    ["hotel", { isHotel: true }],
    ["admin", { isAdmin: true }],
  ])("hides every guest action for %s users", (_role, flags) => {
    expect(
      getPublicHeaderVisibility({
        ...resolvedRoleState,
        ...flags,
      }),
    ).toEqual({
      ready: true,
      showSignIn: false,
      showRegister: false,
      showCreateRequest: false,
    });
  });

  it("keeps privileged roles from inheriting an agency CTA", () => {
    expect(
      getPublicHeaderVisibility({
        ...resolvedRoleState,
        isOrganizer: true,
        isAdmin: true,
      }),
    ).toMatchObject({ showCreateRequest: false });
  });
});
