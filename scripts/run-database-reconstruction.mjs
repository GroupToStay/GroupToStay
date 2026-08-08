import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalizeCityRows,
  readCityLocalizationSource,
  validateCityLocalizationSource,
} from "./city-localization-provenance.mjs";

const forbiddenRemoteEnvironment = [
  "DATABASE_URL",
  "PGHOST",
  "PGPASSWORD",
  "POSTGRES_URL",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_PROJECT_REF",
];

const migrationPattern = /Applying migration\s+([^\s]+\.sql)/giu;

export function sanitizeReconstructionLog(value, workspace = "") {
  let sanitized = value
    .replace(/postgres(?:ql)?:\/\/[^\s]+/giu, "postgresql://<redacted>")
    .replace(
      /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/gu,
      "<redacted-jwt>",
    )
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/giu, "<redacted-supabase-key>")
    .replace(/((?:password|token|secret|key)\s*[=:]\s*)[^\s]+/giu, "$1<redacted>");

  if (workspace) {
    sanitized = sanitized.split(workspace).join("<workspace>");
  }

  return sanitized;
}

export function classifyMigrationFailure(log) {
  const migrationMatches = [...log.matchAll(migrationPattern)];
  const migration = migrationMatches.at(-1)?.[1] ?? null;

  let errorClass = "other";
  if (/already exists|duplicate_object/iu.test(log)) {
    errorClass = "duplicate_object";
  } else if (/duplicate key|unique constraint/iu.test(log)) {
    errorClass = "replay_migration";
  } else if (/does not exist|undefined_(?:table|function|column|object)/iu.test(log)) {
    errorClass = "missing_prerequisite";
  } else if (/permission denied|must be owner|unsupported extension/iu.test(log)) {
    errorClass = "environment_difference";
  } else if (/syntax error|invalid input|violates .* constraint/iu.test(log)) {
    errorClass = "invalid_assumption";
  }

  const objectMatch = log.match(
    /(?:relation|table|column|function|constraint|type|schema|trigger|policy)\s+["']?([^"'\s,;]+)/iu,
  );

  return {
    migration,
    errorClass,
    affectedObject: objectMatch?.[1] ?? null,
  };
}

export function assertIsolatedEnvironment(env) {
  const present = forbiddenRemoteEnvironment.filter((name) => env[name]?.trim());
  if (present.length > 0) {
    throw new Error(
      `Database reconstruction refuses remote database environment variables: ${present.join(", ")}`,
    );
  }

  if (env.CI_DATABASE_RECONSTRUCTION !== "1") {
    throw new Error(
      "Set CI_DATABASE_RECONSTRUCTION=1 to acknowledge isolated local reconstruction.",
    );
  }
}

function run(command, args, options) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env,
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
    input: options.input,
  });
}

function normalizeSql(value) {
  return value.replace(/\r\n/gu, "\n");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function queryIsolatedDatabase(sql, options) {
  const result = run(
    options.dockerCommand,
    [
      "exec",
      "supabase_db_grouptostay_reconstruction",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-X",
      "-A",
      "-t",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    options,
  );
  if (result.status !== 0) {
    throw new Error(`Isolated catalog query failed: ${result.stderr || result.stdout}`);
  }
  return `${result.stdout ?? ""}`.trim();
}

function extractGeneratedTypeMembers(value, sectionName) {
  const start = value.indexOf(`    ${sectionName}: {`);
  if (start < 0) return [];
  const sectionNames = ["Tables", "Views", "Functions", "Enums", "CompositeTypes"];
  const nextOffsets = sectionNames
    .filter((candidate) => candidate !== sectionName)
    .map((candidate) => value.indexOf(`    ${candidate}: {`, start + 1))
    .filter((offset) => offset > start);
  const end = nextOffsets.length > 0 ? Math.min(...nextOffsets) : value.length;
  const members = [];
  for (const match of value.slice(start, end).matchAll(/^      ([A-Za-z0-9_]+):/gmu)) {
    members.push(match[1]);
  }
  return [...new Set(members)].sort();
}

export function compareGeneratedTypes(candidate, committed) {
  const sections = ["Tables", "Views", "Functions", "Enums"];
  const sectionDiff = {};
  for (const section of sections) {
    const candidateMembers = extractGeneratedTypeMembers(candidate, section);
    const committedMembers = extractGeneratedTypeMembers(committed, section);
    sectionDiff[section] = {
      added: candidateMembers.filter((member) => !committedMembers.includes(member)),
      removed: committedMembers.filter((member) => !candidateMembers.includes(member)),
    };
  }
  return sectionDiff;
}

export function runDatabaseReconstruction({
  repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  env = process.env,
  cliCommand = process.platform === "win32" ? "supabase.exe" : "supabase",
  dockerCommand = process.platform === "win32" ? "docker.exe" : "docker",
} = {}) {
  assertIsolatedEnvironment(env);

  const artifactRoot = resolve(repositoryRoot, "artifacts/database-reconstruction");
  rmSync(artifactRoot, { recursive: true, force: true });
  mkdirSync(artifactRoot, { recursive: true });

  const isolatedRoot = mkdtempSync(join(tmpdir(), "grouptostay-db-reconstruction-"));
  const isolatedSupabase = join(isolatedRoot, "supabase");
  cpSync(resolve(repositoryRoot, "supabase/migrations"), join(isolatedSupabase, "migrations"), {
    recursive: true,
  });
  copyFileSync(
    resolve(repositoryRoot, "supabase/config.toml"),
    join(isolatedSupabase, "config.toml"),
  );

  const isolatedConfigPath = join(isolatedSupabase, "config.toml");
  const isolatedConfig = readFileSync(isolatedConfigPath, "utf8").replace(
    /^project_id\s*=.*$/mu,
    'project_id = "grouptostay_reconstruction"',
  );
  writeFileSync(isolatedConfigPath, isolatedConfig);

  const childEnvironment = { ...env };
  for (const name of forbiddenRemoteEnvironment) delete childEnvironment[name];

  const versionResult = run(cliCommand, ["--version"], {
    cwd: isolatedRoot,
    env: childEnvironment,
  });
  const cliVersion = `${versionResult.stdout ?? ""}`.trim() || "unknown";
  const startResult = run(cliCommand, ["db", "start"], {
    cwd: isolatedRoot,
    env: childEnvironment,
  });

  const rawLog = `${startResult.stdout ?? ""}\n${startResult.stderr ?? ""}`;
  const safeLog = sanitizeReconstructionLog(rawLog, repositoryRoot);
  writeFileSync(join(artifactRoot, "reconstruction.log"), safeLog);

  const report = {
    schemaVersion: 1,
    repositoryBaseline: env.GITHUB_SHA?.trim() || null,
    productionConnectivityUsed: false,
    productionCredentialsUsed: false,
    projectLinkUsed: false,
    isolatedProjectId: "grouptostay_reconstruction",
    supabaseCliVersion: cliVersion,
    command: "supabase db start",
    status: startResult.status === 0 ? "succeeded" : "failed",
    exitCode: startResult.status,
    firstFailure: null,
    schemaFingerprintSha256: null,
    catalogFingerprintSha256: null,
    catalogFingerprintCategories: null,
    referenceData: null,
    candidateTypesGenerated: false,
    candidateTypes: null,
    validationFailure: null,
  };

  if (startResult.status !== 0) {
    report.firstFailure = classifyMigrationFailure(safeLog);
  } else {
    const candidateTypesResult = run(cliCommand, ["gen", "types", "typescript", "--local"], {
      cwd: isolatedRoot,
      env: childEnvironment,
    });
    if (candidateTypesResult.status !== 0) {
      throw new Error("Clean reconstruction succeeded, but candidate type generation failed.");
    }
    writeFileSync(join(artifactRoot, "candidate-types.ts"), candidateTypesResult.stdout);
    report.candidateTypesGenerated = true;

    const committedTypes = readFileSync(
      resolve(repositoryRoot, "src/integrations/supabase/types.ts"),
      "utf8",
    );
    const typeComparison = compareGeneratedTypes(candidateTypesResult.stdout, committedTypes);
    const typeDiffResult = run(
      "git",
      [
        "diff",
        "--no-index",
        "--no-color",
        "--",
        "src/integrations/supabase/types.ts",
        "artifacts/database-reconstruction/candidate-types.ts",
      ],
      { cwd: repositoryRoot, env: childEnvironment },
    );
    const safeTypeDiff = sanitizeReconstructionLog(
      `${typeDiffResult.stdout ?? ""}${typeDiffResult.stderr ?? ""}`,
      repositoryRoot,
    );
    writeFileSync(join(artifactRoot, "candidate-types.diff"), safeTypeDiff);
    report.candidateTypes = {
      candidateSha256: sha256(candidateTypesResult.stdout),
      committedSha256: sha256(committedTypes),
      exactMatch: candidateTypesResult.stdout === committedTypes,
      includesProfilesCityName: /\bcity_name:\s+string\s+\|\s+null/gu.test(
        candidateTypesResult.stdout,
      ),
      includesRfqLifecycleEvents: /\brfq_lifecycle_events:\s*\{/gu.test(
        candidateTypesResult.stdout,
      ),
      sectionDiff: typeComparison,
      diffAddedLines: safeTypeDiff.split("\n").filter((line) => /^\+(?!\+\+)/u.test(line)).length,
      diffRemovedLines: safeTypeDiff.split("\n").filter((line) => /^-(?!--)/u.test(line)).length,
    };

    const schemaDumpPath = join(artifactRoot, "candidate-schema.sql");
    const dumpResult = run(
      cliCommand,
      ["db", "dump", "--local", "--schema", "public,auth,storage", "--file", schemaDumpPath],
      { cwd: isolatedRoot, env: childEnvironment },
    );
    if (dumpResult.status !== 0 || !existsSync(schemaDumpPath)) {
      throw new Error("Clean reconstruction succeeded, but schema fingerprint generation failed.");
    }
    report.schemaFingerprintSha256 = createHash("sha256")
      .update(normalizeSql(readFileSync(schemaDumpPath, "utf8")))
      .digest("hex");
    rmSync(schemaDumpPath, { force: true });

    const catalogSql = readFileSync(
      resolve(repositoryRoot, "supabase/tests/catalog-fingerprint.sql"),
      "utf8",
    );
    const catalogJson = queryIsolatedDatabase(catalogSql, {
      cwd: isolatedRoot,
      env: childEnvironment,
      dockerCommand,
    });
    const catalogCategories = JSON.parse(catalogJson);
    const canonicalCatalog = `${JSON.stringify(catalogCategories)}\n`;
    writeFileSync(join(artifactRoot, "catalog-fingerprint.json"), canonicalCatalog);
    report.catalogFingerprintSha256 = sha256(canonicalCatalog);
    report.catalogFingerprintCategories = catalogCategories;

    const cityRowsJson = queryIsolatedDatabase(
      `SELECT coalesce(json_agg(json_build_object(
        'id', id::text,
        'country_id', country_id::text,
        'name_en', name_en,
        'name_ar', name_ar
      ) ORDER BY id)::text, '[]') FROM public.cities;`,
      { cwd: isolatedRoot, env: childEnvironment, dockerCommand },
    );
    const reconstructedCities = JSON.parse(cityRowsJson);
    const approvedCitySource = readCityLocalizationSource(
      resolve(repositoryRoot, "supabase/reference-data/cities-arabic.json"),
    );
    const approvedCityVerification = validateCityLocalizationSource(approvedCitySource);
    const reconstructedCitySha256 = sha256(canonicalizeCityRows(reconstructedCities));
    report.referenceData = {
      reconstructedRowCount: reconstructedCities.length,
      approvedRowCount: approvedCityVerification.rowCount,
      reconstructedCanonicalRowsSha256: reconstructedCitySha256,
      approvedCanonicalRowsSha256: approvedCityVerification.canonicalRowsSha256,
      exactMatch:
        reconstructedCities.length === approvedCityVerification.rowCount &&
        reconstructedCitySha256 === approvedCityVerification.canonicalRowsSha256,
    };
    if (!report.referenceData.exactMatch) {
      report.status = "failed";
      report.validationFailure = "canonical_reference_data_mismatch";
    }
  }

  writeFileSync(join(artifactRoot, "result.json"), `${JSON.stringify(report, null, 2)}\n`);

  run(cliCommand, ["stop", "--no-backup"], { cwd: isolatedRoot, env: childEnvironment });
  rmSync(isolatedRoot, { recursive: true, force: true });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const report = runDatabaseReconstruction();
    if (report.status !== "succeeded") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
