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
  });
}

function normalizeSql(value) {
  return value.replace(/\r\n/gu, "\n");
}

export function runDatabaseReconstruction({
  repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  env = process.env,
  cliCommand = process.platform === "win32" ? "supabase.exe" : "supabase",
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
    candidateTypesGenerated: false,
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
