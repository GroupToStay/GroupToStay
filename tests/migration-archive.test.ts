import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
  readFileSync(resolve("supabase/migration-archive/manifest.json"), "utf8"),
);

function sha256(path: string, normalizeLineEndings = false) {
  const value = normalizeLineEndings
    ? readFileSync(path, "utf8").replace(/\r\n/gu, "\n")
    : readFileSync(path);
  return createHash("sha256").update(value).digest("hex");
}

describe("non-executable migration archive", () => {
  it("keeps exactly the 11 approved pure replay bundles outside the executable path", () => {
    expect(manifest.entries).toHaveLength(11);
    expect(
      new Set(manifest.entries.map((entry: { filename: string }) => entry.filename)).size,
    ).toBe(11);

    for (const entry of manifest.entries) {
      expect(entry.classification).toBe("pure_replay_import_bundle");
      expect(entry.disposition).toBe("archived_non_executable");
      expect(entry.productionLedgerVersion).toBeNull();
      expect(existsSync(resolve(entry.originalPath)), entry.originalPath).toBe(false);
      expect(existsSync(resolve(entry.archivePath)), entry.archivePath).toBe(true);
      expect(entry.archivePath.startsWith("supabase/migration-archive/")).toBe(true);
    }
  });

  it("preserves byte identity and normalized SQL hashes", () => {
    for (const entry of manifest.entries) {
      const archivePath = resolve(entry.archivePath);
      expect(statSync(archivePath).size, entry.filename).toBe(entry.bytes);
      expect(sha256(archivePath), entry.filename).toBe(entry.byteSha256);
      expect(sha256(archivePath, true), entry.filename).toBe(entry.normalizedSqlSha256);
    }
  });

  it("is linked from the Production provenance map without changing ledger entries", () => {
    const provenance = JSON.parse(
      readFileSync(resolve("docs/database/migration-provenance.json"), "utf8"),
    );
    expect(provenance.archivedReplayManifest).toBe("supabase/migration-archive/manifest.json");
    expect(provenance.archivedReplayCount).toBe(11);
    expect(provenance.entries).toHaveLength(60);
  });
});
