import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultSourcePath = resolve(repositoryRoot, "supabase/reference-data/cities-arabic.json");
const defaultMigrationPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260808190000_canonical_database_reconciliation.sql",
);

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function canonicalizeCityRows(rows) {
  return `${rows
    .map(({ id, country_id: countryId, name_en: nameEn, name_ar: nameAr }) =>
      JSON.stringify([id, countryId, nameEn, nameAr]),
    )
    .join("\n")}\n`;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function validateCityLocalizationSource(source) {
  if (source.schemaVersion !== 1 || !Array.isArray(source.cities)) {
    throw new Error("Unsupported city localization source schema.");
  }

  const seenIds = new Set();
  let previousId = "";
  for (const [index, row] of source.cities.entries()) {
    for (const field of ["id", "country_id", "name_en", "name_ar"]) {
      if (typeof row[field] !== "string" || row[field].trim() === "") {
        throw new Error(`City row ${index} has an invalid ${field}.`);
      }
    }
    if (seenIds.has(row.id)) throw new Error(`Duplicate city id: ${row.id}`);
    if (previousId && row.id.localeCompare(previousId) < 0) {
      throw new Error("City localization rows must be ordered by id.");
    }
    seenIds.add(row.id);
    previousId = row.id;
  }

  const canonicalRows = canonicalizeCityRows(source.cities);
  const canonicalRowsSha256 = sha256(canonicalRows);
  if (source.provenance.rowCount !== source.cities.length) {
    throw new Error("City localization row count does not match provenance metadata.");
  }
  if (source.provenance.canonicalRowsSha256 !== canonicalRowsSha256) {
    throw new Error("City localization checksum does not match provenance metadata.");
  }

  return {
    rowCount: source.cities.length,
    canonicalRowsSha256,
  };
}

export function generateCityLocalizationSql(source) {
  const verification = validateCityLocalizationSource(source);
  const values = source.cities
    .map(
      (row) =>
        `  (${sqlLiteral(row.id)}::uuid, ${sqlLiteral(row.country_id)}::uuid, ${sqlLiteral(row.name_en)}, ${sqlLiteral(row.name_ar)})`,
    )
    .join(",\n");

  return `-- Deterministically generated from supabase/reference-data/cities-arabic.json.
-- Canonical row SHA-256: ${verification.canonicalRowsSha256}
-- The snapshot is canonical for the currently approved live state.
-- The original historical translation provenance is unknown.
-- Production execution requires separate explicit owner approval.
BEGIN;

CREATE TEMP TABLE approved_city_localization (
  id uuid PRIMARY KEY,
  country_id uuid NOT NULL,
  name_en text NOT NULL,
  name_ar text NOT NULL
) ON COMMIT DROP;

INSERT INTO approved_city_localization (id, country_id, name_en, name_ar)
VALUES
${values};

DO $$
BEGIN
  IF (SELECT count(*) FROM approved_city_localization) <> ${verification.rowCount} THEN
    RAISE EXCEPTION 'Approved city localization row count mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM approved_city_localization approved
    LEFT JOIN public.cities live ON live.id = approved.id
    WHERE live.id IS NULL
       OR live.country_id IS DISTINCT FROM approved.country_id
       OR live.name_en IS DISTINCT FROM approved.name_en
  ) THEN
    RAISE EXCEPTION 'Approved city localization identity/source mismatch';
  END IF;
END;
$$;

UPDATE public.cities AS city
SET name_ar = approved.name_ar
FROM approved_city_localization AS approved
WHERE city.id = approved.id
  AND city.name_ar IS DISTINCT FROM approved.name_ar;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM approved_city_localization approved
    JOIN public.cities live USING (id)
    WHERE live.name_ar IS DISTINCT FROM approved.name_ar
  ) THEN
    RAISE EXCEPTION 'Approved city localization verification failed';
  END IF;
END;
$$;

COMMIT;
`;
}

export function readCityLocalizationSource(path = defaultSourcePath) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const source = readCityLocalizationSource();
  if (process.argv.includes("--emit-sql")) {
    process.stdout.write(generateCityLocalizationSql(source));
  } else if (process.argv.includes("--write-migration")) {
    const migration = generateCityLocalizationSql(source);
    writeFileSync(defaultMigrationPath, migration, { encoding: "utf8" });
    process.stdout.write(
      `${JSON.stringify({ path: relative(repositoryRoot, defaultMigrationPath).replaceAll("\\", "/"), sha256: sha256(migration) })}\n`,
    );
  } else if (process.argv.includes("--check")) {
    process.stdout.write(`${JSON.stringify(validateCityLocalizationSource(source))}\n`);
  } else {
    process.stderr.write("Use --check, --emit-sql, or --write-migration.\n");
    process.exitCode = 1;
  }
}
