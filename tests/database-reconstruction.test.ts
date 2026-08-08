import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertIsolatedEnvironment,
  classifyMigrationFailure,
  compareGeneratedTypes,
  sanitizeReconstructionLog,
} from "../scripts/run-database-reconstruction.mjs";

describe("database reconstruction evidence", () => {
  it("records the first failing migration and duplicate object", () => {
    const result = classifyMigrationFailure(`
Applying migration 20260712153351_replay.sql...
ERROR: relation "profiles" already exists (SQLSTATE 42P07)
`);

    expect(result).toEqual({
      migration: "20260712153351_replay.sql",
      errorClass: "duplicate_object",
      affectedObject: "profiles",
    });
  });

  it("uses the last applying marker when earlier migrations succeeded", () => {
    const result = classifyMigrationFailure(`
Applying migration 20260613080917_initial.sql...
Applying migration 20260613081054_profiles.sql...
ERROR: function public.required_helper() does not exist
`);

    expect(result).toEqual({
      migration: "20260613081054_profiles.sql",
      errorClass: "missing_prerequisite",
      affectedObject: "public.required_helper()",
    });
  });

  it("redacts credentials and connection strings from public-safe logs", () => {
    const sanitized = sanitizeReconstructionLog(
      "postgresql://postgres:private@localhost:5432/postgres token=private sb_secret_private",
    );

    expect(sanitized).toBe("postgresql://<redacted> token=<redacted> <redacted-supabase-key>");
    expect(sanitized).not.toContain("private");
  });

  it("rejects any remote database credential or project context", () => {
    expect(() =>
      assertIsolatedEnvironment({
        CI_DATABASE_RECONSTRUCTION: "1",
        SUPABASE_PROJECT_REF: "remote-project",
      }),
    ).toThrow("refuses remote database environment variables: SUPABASE_PROJECT_REF");
  });

  it("requires explicit isolated reconstruction acknowledgement", () => {
    expect(() => assertIsolatedEnvironment({})).toThrow("Set CI_DATABASE_RECONSTRUCTION=1");
  });

  it("pins an isolated workflow with no remote database command or Production secret", () => {
    const workflow = readFileSync(resolve(".github/workflows/database-reconstruction.yml"), "utf8");
    const runner = readFileSync(resolve("scripts/run-database-reconstruction.mjs"), "utf8");

    expect(workflow).toContain("version: 2.113.0");
    expect(workflow).toContain('CI_DATABASE_RECONSTRUCTION: "1"');
    expect(workflow).toContain('"supabase/reference-data/cities-arabic.json"');
    expect(workflow).toContain('"supabase/tests/**"');
    expect(workflow).not.toMatch(/SUPABASE_(?:ACCESS_TOKEN|DB_PASSWORD|PROJECT_REF):/u);
    expect(runner).toContain('"db", "start"');
    expect(runner).toContain('project_id = "grouptostay_reconstruction"');
    expect(runner).not.toMatch(/\["(?:link|db push|migration repair)"/u);
  });

  it("reports candidate generated-type members without replacing committed types", () => {
    const committed = `    Tables: {\n      profiles: {\n      }\n    Views: {\n    Functions: {\n    Enums: {\n`;
    const candidate = `    Tables: {\n      profiles: {\n      }\n      rfq_lifecycle_events: {\n      }\n    Views: {\n    Functions: {\n      award_quote: {\n      }\n    Enums: {\n`;

    expect(compareGeneratedTypes(candidate, committed)).toMatchObject({
      Tables: { added: ["rfq_lifecycle_events"], removed: [] },
      Functions: { added: ["award_quote"], removed: [] },
    });
  });

  it("uses a catalog-only fingerprint query with no application-row selection", () => {
    const fingerprintSql = readFileSync(resolve("supabase/tests/catalog-fingerprint.sql"), "utf8");

    for (const category of [
      "relations",
      "columns",
      "constraints",
      "indexes",
      "enums",
      "functions",
      "triggers",
      "policies",
      "table_grants",
      "column_grants",
      "routine_grants",
      "extensions",
    ]) {
      expect(fingerprintSql).toContain(`'${category}'`);
    }
    expect(fingerprintSql).not.toMatch(/FROM\s+public\./iu);
    expect(fingerprintSql).not.toMatch(/FROM\s+auth\.users/iu);
  });
});
