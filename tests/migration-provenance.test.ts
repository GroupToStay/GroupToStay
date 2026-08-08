import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const provenance = JSON.parse(
  readFileSync(resolve("docs/database/migration-provenance.json"), "utf8"),
);

function normalizedSha256(path: string) {
  const value = readFileSync(path, "utf8").replace(/\r\n/gu, "\n");
  return createHash("sha256").update(value).digest("hex");
}

describe("Production migration provenance map", () => {
  it("maps every ledger row in execution order", () => {
    expect(provenance.entries).toHaveLength(60);
    expect(
      provenance.entries.map((entry: { executionOrder: number }) => entry.executionOrder),
    ).toEqual(Array.from({ length: 60 }, (_, index) => index + 1));
    expect(
      new Set(
        provenance.entries.map(
          (entry: { productionLedgerVersion: string }) => entry.productionLedgerVersion,
        ),
      ).size,
    ).toBe(60);
  });

  it("proves every mapped repository file has its recorded normalized SHA-256", () => {
    for (const entry of provenance.entries) {
      expect(entry.repositoryFilename).toBeTruthy();
      expect(
        normalizedSha256(resolve("supabase/migrations", entry.repositoryFilename)),
        entry.repositoryFilename,
      ).toBe(entry.normalizedSqlSha256);
    }
  });

  it("restores the global migration exactly from the trusted ledger payload", () => {
    const entry = provenance.entries.find(
      (candidate: { productionLedgerVersion: string }) =>
        candidate.productionLedgerVersion === "20260729180000",
    );
    const migration = readFileSync(
      resolve("supabase/migrations/20260729180000_global_country_city_experience.sql"),
      "utf8",
    );

    expect(entry.classification).toBe("ledger_source_restored_exact_sql");
    expect(entry.normalizedSqlSha256).toBe(entry.ledgerPayloadSha256);
    expect(entry.normalizedSqlSha256).toBe(
      "0b37a1ed8a8bd402696b1618959160852f651bd6b68abb8f7125d01c06cff6f9",
    );
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS city_name text");
    expect(migration).toContain("profiles_city_name_length_check");
  });
});
