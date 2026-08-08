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

const requiredFields = ["version", "sha", "branch", "environment", "timestamp", "node", "pnpm"];
const missingFields = requiredFields.filter((field) => !metadata[field]);
const extraFields = Object.keys(metadata).filter((field) => !requiredFields.includes(field));
const timestampValid = !Number.isNaN(Date.parse(metadata.timestamp));
const environmentValid = ["Local", "CI", "Development", "Preview", "Production"].includes(
  metadata.environment,
);
const nodeMatch = /^v(\d+)\.(\d+)\.(\d+)$/.exec(metadata.node ?? "");
const nodeParts = nodeMatch?.slice(1).map(Number);
const nodeMinimum = ["Development", "Preview", "Production"].includes(metadata.environment)
  ? [22, 22, 2]
  : [22, 23, 1];
const nodeCompatible =
  nodeParts != null &&
  nodeParts[0] === 22 &&
  nodeParts.every((part, index) => {
    const previousPartsMatch = nodeParts
      .slice(0, index)
      .every((item, offset) => item === nodeMinimum[offset]);
    return !previousPartsMatch || part >= nodeMinimum[index];
  });

if (
  missingFields.length > 0 ||
  extraFields.length > 0 ||
  !/^[0-9a-f]{40}$/i.test(metadata.sha) ||
  !timestampValid ||
  !environmentValid ||
  !nodeCompatible ||
  metadata.pnpm !== "11.7.0"
) {
  console.error(
    `[provenance] Invalid build metadata: ${
      [...missingFields, ...extraFields.map((field) => `unexpected:${field}`)].join(", ") ||
      "sha/timestamp/runtime"
    }.`,
  );
  process.exit(1);
}

console.log(`[provenance] Verified build ${metadata.version} (${metadata.sha.slice(0, 12)}).`);
