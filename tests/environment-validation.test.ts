import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const scriptPath = resolve(process.cwd(), "scripts/validate-env.mjs");
const expectedUrl = "https://atxecflhmphaqqkatjlm.supabase.co";
let emptyWorkingDirectory: string;

function runEnvironmentCheck(values: Record<string, string> = {}) {
  const env = { ...process.env };
  delete env.NEXT_PUBLIC_SUPABASE_URL;
  delete env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete env.NEXT_PUBLIC_V3_DEAL_ACTIVATION_ENABLED;

  return spawnSync(process.execPath, [scriptPath], {
    cwd: emptyWorkingDirectory,
    env: { ...env, ...values },
    encoding: "utf8",
  });
}

describe("build environment validation", () => {
  beforeAll(() => {
    emptyWorkingDirectory = mkdtempSync(join(tmpdir(), "grouptostay-env-"));
  });

  afterAll(() => {
    rmSync(emptyWorkingDirectory, { recursive: true, force: true });
  });

  it("fails before compilation when the required Supabase variables are missing", () => {
    const result = runEnvironmentCheck();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(result.stderr).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(result.stderr).toContain("NEXT_PUBLIC_V3_DEAL_ACTIVATION_ENABLED");
  });

  it("accepts the Supabase anonymous key", () => {
    const result = runEnvironmentCheck({
      NEXT_PUBLIC_SUPABASE_URL: expectedUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
      NEXT_PUBLIC_V3_DEAL_ACTIVATION_ENABLED: "true",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("atxecflhmphaqqkatjlm");
  });

  it("accepts the Supabase publishable key as an alternative", () => {
    const result = runEnvironmentCheck({
      NEXT_PUBLIC_SUPABASE_URL: expectedUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-publishable-key",
      NEXT_PUBLIC_V3_DEAL_ACTIVATION_ENABLED: "false",
    });

    expect(result.status).toBe(0);
  });

  it("rejects a different Supabase project", () => {
    const result = runEnvironmentCheck({
      NEXT_PUBLIC_SUPABASE_URL: "https://divgqjlotvmlmkzjtlzw.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
      NEXT_PUBLIC_V3_DEAL_ACTIVATION_ENABLED: "true",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("atxecflhmphaqqkatjlm.supabase.co");
  });

  it("rejects legacy Vite variables instead of producing a misconfigured Next bundle", () => {
    const result = runEnvironmentCheck({
      VITE_SUPABASE_URL: expectedUrl,
      VITE_SUPABASE_ANON_KEY: "legacy-key",
      VITE_V3_DEAL_ACTIVATION_ENABLED: "true",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("rejects an invalid V3 activation flag", () => {
    const result = runEnvironmentCheck({
      NEXT_PUBLIC_SUPABASE_URL: expectedUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
      NEXT_PUBLIC_V3_DEAL_ACTIVATION_ENABLED: "enabled",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must be true or false");
  });
});
