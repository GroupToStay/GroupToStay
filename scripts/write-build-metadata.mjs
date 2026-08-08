import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(repositoryRoot, ".output/public");
const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));

function git(...args) {
  try {
    return execFileSync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

const gitSha =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  process.env.BUILD_GIT_SHA ??
  git("rev-parse", "HEAD");
const gitBranch =
  process.env.VERCEL_GIT_COMMIT_REF ??
  process.env.GITHUB_REF_NAME ??
  process.env.BUILD_GIT_BRANCH ??
  git("branch", "--show-current");

if (!gitSha || !/^[0-9a-f]{40}$/i.test(gitSha)) {
  console.error("[provenance] Build stopped because no valid Git commit SHA is available.");
  process.exit(1);
}

if (process.env.VERCEL === "1" && !process.env.VERCEL_GIT_COMMIT_SHA) {
  console.error(
    "[provenance] Vercel build stopped because it is not attached to a Git commit deployment.",
  );
  process.exit(1);
}

const shortSha = gitSha.slice(0, 12);
const metadata = {
  version: process.env.RELEASE_VERSION ?? `${packageJson.name}-${shortSha}`,
  gitSha,
  gitBranch: gitBranch || "detached",
  environment:
    process.env.VERCEL_ENV ??
    process.env.BUILD_ENV ??
    (process.env.GITHUB_ACTIONS === "true" || process.env.CI ? "ci" : "local"),
  buildTime: new Date().toISOString(),
  nodeVersion: process.version,
  packageManager: packageJson.packageManager,
  source:
    process.env.VERCEL_GIT_COMMIT_SHA != null
      ? "vercel-git"
      : process.env.GITHUB_SHA != null
        ? "github-actions"
        : process.env.BUILD_GIT_SHA != null
          ? "explicit"
          : "local-git",
  dirty: process.env.CI ? false : Boolean(git("status", "--porcelain")),
};

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  resolve(outputDirectory, "build-metadata.json"),
  `${JSON.stringify(metadata, null, 2)}\n`,
  "utf8",
);

console.log(`[provenance] Build metadata written for ${shortSha}.`);
