import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const semanticReviewFunctions = [
  "is_agency_rfq_eligible",
  "record_rfq_lifecycle_event",
  "require_verified_agency_for_rfq",
  "update_updated_at_column",
];

export function normalizeLineEndings(value) {
  return value.replace(/\r\n/gu, "\n");
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeSqlTokens(value) {
  let normalized = "";
  let state = "code";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];

    if (state === "single-quote") {
      normalized += character;
      if (character === "'" && next === "'") {
        normalized += next;
        index += 1;
      } else if (character === "'") {
        state = "code";
      }
      continue;
    }

    if (state === "double-quote") {
      normalized += character;
      if (character === '"' && next === '"') {
        normalized += next;
        index += 1;
      } else if (character === '"') {
        state = "code";
      }
      continue;
    }

    if (character === "'") {
      state = "single-quote";
      normalized += character;
    } else if (character === '"') {
      state = "double-quote";
      normalized += character;
    } else if (!/\s/u.test(character)) {
      normalized += character.toLowerCase();
    }
  }

  if (state !== "code") throw new Error(`Unterminated ${state} in SQL body.`);
  return normalized;
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function extractLatestTrackedFunctionDefinitions(migrationsRoot, functionNames) {
  const files = readdirSync(migrationsRoot)
    .filter((file) => extname(file) === ".sql")
    .sort();
  const definitions = new Map();

  for (const file of files) {
    const sql = readFileSync(resolve(migrationsRoot, file), "utf8");
    for (const functionName of functionNames) {
      const escapedName = escapeRegularExpression(functionName);
      const pattern = new RegExp(
        `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${escapedName}\\s*\\([^;]*?\\bAS\\s+\\$([A-Za-z0-9_]*)\\$([\\s\\S]*?)\\$\\1\\$`,
        "giu",
      );
      for (const match of sql.matchAll(pattern)) {
        definitions.set(functionName, {
          sourceFile: file,
          body: normalizeLineEndings(match[2]),
        });
      }
    }
  }

  return definitions;
}

export function analyzeTrackedFunctions(migrationsRoot, functionNames = semanticReviewFunctions) {
  const definitions = extractLatestTrackedFunctionDefinitions(migrationsRoot, functionNames);
  return functionNames.map((functionName) => {
    const definition = definitions.get(functionName);
    if (!definition) throw new Error(`No tracked definition found for ${functionName}.`);
    return {
      function: functionName,
      sourceFile: definition.sourceFile,
      trackedBodySha256: sha256(definition.body),
      trackedSemanticSha256: sha256(normalizeSqlTokens(definition.body)),
    };
  });
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = analyzeTrackedFunctions(resolve(repositoryRoot, "supabase/migrations"));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
