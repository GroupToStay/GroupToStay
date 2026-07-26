import { describe, expect, it } from "vitest";
import { parseAuthSearch } from "../src/routes/auth";

describe("authentication navigation", () => {
  it.each(["signin", "signup", "forgot"] as const)("preserves the %s mode", (mode) => {
    expect(parseAuthSearch({ mode })).toEqual({ mode, redirect: undefined });
  });

  it("falls back to sign in for an invalid mode", () => {
    expect(parseAuthSearch({ mode: "register" })).toEqual({
      mode: undefined,
      redirect: undefined,
    });
  });

  it("preserves a valid redirect while changing authentication modes", () => {
    expect(parseAuthSearch({ mode: "signup", redirect: "/dashboard/bookings" })).toEqual({
      mode: "signup",
      redirect: "/dashboard/bookings",
    });
  });
});
