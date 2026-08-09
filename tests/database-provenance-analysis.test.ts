import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeTrackedFunctions,
  normalizeSqlTokens,
  semanticReviewFunctions,
} from "../scripts/database-provenance-analysis.mjs";

describe("database provenance analysis", () => {
  it("finds the last tracked definition for every semantic-review function", () => {
    const result = analyzeTrackedFunctions(resolve("supabase/migrations"));

    expect(result.map((entry) => entry.function)).toEqual(semanticReviewFunctions);
    expect(result.every((entry) => /^[a-f0-9]{64}$/u.test(entry.trackedBodySha256))).toBe(true);
    expect(result.every((entry) => /^[a-f0-9]{64}$/u.test(entry.trackedSemanticSha256))).toBe(true);
  });

  it("matches the recorded live semantic hashes without preferring formatting", () => {
    const tracked = analyzeTrackedFunctions(resolve("supabase/migrations"));
    const evidence = JSON.parse(
      readFileSync(resolve("docs/database/function-semantic-evidence.json"), "utf8"),
    );

    for (const trackedFunction of tracked) {
      const liveFunction = evidence.functions.find(
        (entry: { function: string }) => entry.function === trackedFunction.function,
      );
      expect(liveFunction.semanticMatch).toBe(true);
      expect(trackedFunction.trackedSemanticSha256).toBe(liveFunction.liveSemanticSha256);
    }
  });

  it("ignores formatting and keyword case while preserving string contents", () => {
    expect(normalizeSqlTokens("BEGIN\n RETURN 'A  B'; END")).toBe(
      normalizeSqlTokens("begin return 'A  B';end"),
    );
    expect(normalizeSqlTokens("SELECT 'A  B'")).not.toBe(normalizeSqlTokens("SELECT 'A B'"));
  });
});
