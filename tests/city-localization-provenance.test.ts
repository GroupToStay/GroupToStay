import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  generateCityLocalizationSql,
  readCityLocalizationSource,
  readProductionCountryMap,
  validateCityLocalizationSource,
  validateProductionCountryMap,
} from "../scripts/city-localization-provenance.mjs";

describe("approved Arabic city localization provenance", () => {
  const source = readCityLocalizationSource();
  const countryMap = readProductionCountryMap();

  it("reproduces all approved live labels with the recorded stable checksum", () => {
    expect(validateCityLocalizationSource(source)).toEqual({
      rowCount: 1583,
      canonicalRowsSha256: "eebc37b6132a04a96cdb9756b0ff6fa823a46bd96c05e76e8eb4b20effd41b9a",
    });
  });

  it("generates deterministic, guarded SQL without remote connectivity", () => {
    const first = generateCityLocalizationSql(source);
    const second = generateCityLocalizationSql(source);

    expect(first).toBe(second);
    expect(first).toContain("CREATE TEMP TABLE approved_city_localization");
    expect(first).toContain("Approved city localization stable-key mismatch");
    expect(first).toContain("country.code = approved.country_code");
    expect(first).toContain("UPDATE public.cities AS city");
    expect(first).not.toContain("supabase.co");
    expect(first).not.toContain("service_role");
  });

  it("resolves every generated Production UUID through a stable country code", () => {
    const mapping = validateProductionCountryMap(countryMap, source);

    expect(mapping.size).toBe(76);
    expect(source.cities.every((city) => mapping.has(city.country_id))).toBe(true);
  });

  it("rejects source data that no longer matches the approved checksum", () => {
    const tampered = structuredClone(source);
    tampered.cities[0].name_ar = "قيمة معدلة";

    expect(() => validateCityLocalizationSource(tampered)).toThrow("checksum does not match");
  });

  it("keeps the executable reconciliation migration deterministic", () => {
    const migration = readFileSync(
      resolve("supabase/migrations/20260808190000_canonical_database_reconciliation.sql"),
      "utf8",
    );

    expect(migration).toBe(generateCityLocalizationSql(source));
    expect(migration).toContain("The snapshot is canonical for the currently approved live state.");
    expect(migration).toContain("Production execution requires separate explicit owner approval.");
  });
});
