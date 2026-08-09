import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(root, path), "utf8")) as T;
}

describe("database reconciliation evidence", () => {
  it.each(["policy-export.sql", "grant-export.sql", "function-acl-export.sql"])(
    "%s remains a read-only catalog query",
    (name) => {
      const sql = readFileSync(resolve(root, "supabase/tests", name), "utf8");
      const executableSql = sql.replace(/--.*$/gmu, "").replace(/'(?:''|[^'])*'/gu, "''");
      expect(executableSql).not.toMatch(
        /(^|\s)(?:UPDATE|INSERT|DELETE|ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE)(?:\s|$)/imu,
      );
      expect(sql).toMatch(/\bSELECT\b/iu);
    },
  );

  it("pins exact canonical policy parity after the forward migration", () => {
    const diff = readJson<{
      summary: { onlyCandidate: number; onlyProduction: number; semanticDifferences: number };
      onlyCandidate: Array<{ policy: string; productionDefinition: null }>;
    }>("docs/database/policy-diff-current.json");

    expect(diff.summary).toEqual({
      onlyCandidate: 0,
      onlyProduction: 0,
      semanticDifferences: 0,
    });
    expect(diff.onlyCandidate).toEqual([]);
  });

  it("keeps the forward policy canonicalization narrowly scoped and guarded", () => {
    const sql = readFileSync(
      resolve(
        root,
        "supabase/migrations/20260809120000_canonicalize_production_authorization_baseline.sql",
      ),
      "utf8",
    );
    const executableSql = sql.replace(/--.*$/gmu, "").replace(/'(?:''|[^'])*'/gu, "''");

    expect(sql).toContain("public.rfqs RLS is not enabled");
    expect(sql).toContain("has unexpected semantics");
    expect(sql).toContain("RFQ policy set changed unexpectedly");
    expect(sql.match(/DROP POLICY IF EXISTS/gu)).toHaveLength(2);
    expect(sql).toContain('DROP POLICY IF EXISTS "Admin updates all RFQs" ON public.rfqs;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Admin deletes all RFQs" ON public.rfqs;');
    expect(executableSql).not.toMatch(
      /\b(?:CREATE POLICY|ALTER POLICY|GRANT|REVOKE|INSERT|UPDATE|DELETE|TRUNCATE)\b/iu,
    );
  });

  it("keeps effective column differences linked to table ACL differences", () => {
    const diff = readJson<{
      categories: {
        column: {
          effectiveOnlyCandidate: number;
          effectiveOnlyProduction: number;
          onlyCandidate: Array<{ classification: string }>;
          onlyProduction: Array<{ classification: string }>;
        };
      };
    }>("docs/database/grant-diff-current.json");
    const column = diff.categories.column;

    expect(column.effectiveOnlyCandidate).toBe(108);
    expect(column.effectiveOnlyProduction).toBe(1063);
    expect(
      [...column.onlyCandidate, ...column.onlyProduction].every(
        ({ classification }) => classification === "derived_from_table_acl_difference",
      ),
    ).toBe(true);
  });

  it("accepts only the pinned hosted-default grant baseline", () => {
    const diff = readJson<{
      candidateGrantSha256: string;
      productionGrantSha256: string;
      categories: {
        table: {
          classificationCounts: Record<string, number>;
          onlyCandidate: Array<{ classification: string }>;
          onlyProduction: Array<{ classification: string }>;
        };
      };
    }>("docs/database/grant-diff-current.json");

    expect(diff.candidateGrantSha256).toBe(
      "6fe10d7a4d9819d5cf7455ac9e3e176a9180b70837ce65a4a2740e691de5ed52",
    );
    expect(diff.productionGrantSha256).toBe(
      "0024d8405f899aa0fac51d8c1fbd41b7038d09c3b683606d8fe2a8c422ffe68a",
    );
    expect(diff.categories.table.classificationCounts).toEqual({
      expected_local_stack_difference: 18,
      supabase_hosted_default_acl_difference: 130,
      supabase_managed_environment_difference: 12,
    });
    expect(
      [...diff.categories.table.onlyCandidate, ...diff.categories.table.onlyProduction].some(
        ({ classification }) => classification === "unexplained_blocker",
      ),
    ).toBe(false);
  });

  it("records the deferred trigger-function ACL gap without changing it", () => {
    const diff = readJson<{
      definitionMatch: boolean;
      executeOnlyProduction: Array<{ grantee: string; classification: string }>;
    }>("docs/database/function-acl-diff-current.json");

    expect(diff.definitionMatch).toBe(true);
    expect(diff.executeOnlyProduction).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          grantee: "authenticated",
          classification: "canonical_production_acl_reconstruction_gap",
        }),
        expect.objectContaining({
          grantee: "service_role",
          classification: "supabase_managed_environment_difference",
        }),
      ]),
    );
  });
});
