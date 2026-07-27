import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const scriptPath = resolve(process.cwd(), "scripts/validate-env.mjs");
let emptyWorkingDirectory: string;

function runEnvironmentCheck(values: Record<string, string> = {}) {
  const env = { ...process.env };
  delete env.VITE_SUPABASE_URL;
  delete env.VITE_SUPABASE_ANON_KEY;
  delete env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
    expect(result.stderr).toContain("VITE_SUPABASE_URL");
    expect(result.stderr).toContain("VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY");
  });

  it("accepts the Supabase anonymous key", () => {
    const result = runEnvironmentCheck({
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_ANON_KEY: "public-anon-key",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Required Supabase environment variables are configured");
  });

  it("accepts the Supabase publishable key as an alternative", () => {
    const result = runEnvironmentCheck({
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "public-publishable-key",
    });

    expect(result.status).toBe(0);
  });
});
