import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertIsolatedEnvironment,
  classifyMigrationFailure,
  compareGeneratedTypes,
  normalizeGeneratedTypes,
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

  it("classifies only the final migration error, ignoring earlier benign notices", () => {
    const result = classifyMigrationFailure(`
Applying migration 20260712154548_earlier.sql...
NOTICE: policy "example" already exists, skipping
Applying migration 20260808190000_canonical_database_reconciliation.sql...
ERROR: Approved city localization stable-key mismatch (SQLSTATE P0001)
RAISE EXCEPTION 'Approved city localization stable-key mismatch';
`);

    expect(result).toEqual({
      migration: "20260808190000_canonical_database_reconciliation.sql",
      errorClass: "invalid_assumption",
      affectedObject: null,
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

    expect(workflow).toContain("pnpm/action-setup@v4");
    expect(workflow).toContain("version: 11.7.0");
    expect(workflow).toContain("version: 2.113.0");
    expect(workflow).toContain('CI_DATABASE_RECONSTRUCTION: "1"');
    expect(workflow).toContain('"supabase/reference-data/cities-arabic.json"');
    expect(workflow).toContain('"supabase/reference-data/production-country-id-code.json"');
    expect(workflow).toContain('"supabase/tests/**"');
    expect(workflow).not.toMatch(/SUPABASE_(?:ACCESS_TOKEN|DB_PASSWORD|PROJECT_REF):/u);
    expect(runner).toContain('"db", "start"');
    expect(runner).toContain('project_id = "grouptostay_reconstruction"');
    expect(runner).toContain('"supabase/tests/duplicate-trigger-fixtures.sql"');
    expect(runner).toContain('"supabase/tests/organization-membership-fixtures.sql"');
    expect(runner).toContain('"supabase/tests/deal-offer-fixtures.sql"');
    expect(runner).not.toMatch(/\["(?:link|db push|migration repair)"/u);
  });

  it("reports candidate generated-type members without replacing committed types", () => {
    const committed = `  public: {\n    Tables: {\n      profiles: {\n      }\n    Views: {\n    Functions: {\n    Enums: {\n`;
    const candidate = `  public: {\n    Tables: {\n      profiles: {\n      }\n      rfq_lifecycle_events: {\n      }\n    Views: {\n    Functions: {\n      award_quote: {\n      }\n    Enums: {\n`;

    expect(compareGeneratedTypes(candidate, committed)).toMatchObject({
      Tables: { added: ["rfq_lifecycle_events"], removed: [] },
      Functions: { added: ["award_quote"], removed: [] },
    });
  });

  it("normalizes generated-type end-of-file whitespace deterministically", () => {
    expect(normalizeGeneratedTypes("export type Database = {}\n\n")).toBe(
      "export type Database = {}\n",
    );
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
      "application_table_grants",
      "application_column_grants",
      "application_routine_grants",
      "extensions",
    ]) {
      expect(fingerprintSql).toContain(`'${category}'`);
    }
    expect(fingerprintSql).not.toMatch(/FROM\s+public\./iu);
    expect(fingerprintSql).not.toMatch(/FROM\s+auth\.users/iu);
    expect(fingerprintSql).not.toContain("specific_name");
  });

  it("pins the reviewed clean-reconstruction catalog fingerprint", () => {
    const expected = JSON.parse(
      readFileSync(resolve("supabase/tests/expected-candidate-catalog-fingerprint.json"), "utf8"),
    );
    const runner = readFileSync(resolve("scripts/run-database-reconstruction.mjs"), "utf8");

    expect(expected).toHaveLength(12);
    expect(expected.find((entry) => entry.category === "relations")).toEqual({
      category: "relations",
      objectCount: 41,
      definitionMd5: "5c91e7b6039ddd1f478d8f7a1303e14f",
    });
    expect(expected.find((entry) => entry.category === "policies")).toEqual({
      category: "policies",
      objectCount: 159,
      definitionMd5: "ea520e3249e85ddb330c6c1c09e77dd2",
    });
    expect(runner).toContain("schema_fingerprint_mismatch");
    expect(runner).toContain("generated_type_drift");
  });
});
