import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const metadataPath = resolve(repositoryRoot, ".output/public/build-metadata.json");

let metadata;
try {
  metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
} catch {
  console.error("[provenance] Missing or invalid .output/public/build-metadata.json.");
  process.exit(1);
}

const requiredFields = [
  "version",
  "gitSha",
  "gitBranch",
  "environment",
  "buildTime",
  "nodeVersion",
  "packageManager",
  "source",
];
const missingFields = requiredFields.filter((field) => !metadata[field]);

if (missingFields.length > 0 || !/^[0-9a-f]{40}$/i.test(metadata.gitSha)) {
  console.error(`[provenance] Invalid build metadata: ${missingFields.join(", ") || "gitSha"}.`);
  process.exit(1);
}

console.log(`[provenance] Verified build ${metadata.version} (${metadata.gitSha.slice(0, 12)}).`);
